/**
 * fix_skins_communitydragon.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Recrée locales/skins.json en utilisant les URLs de splash art de
 * CommunityDragon (raw.communitydragon.org) — qui fonctionne SANS restriction
 * CORS contrairement à DDragon.
 *
 * Source des données :
 *   https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/{id}.json
 *
 * Format de l'URL splash :
 *   /lol-game-data/assets/ASSETS/Characters/{ChampId}/Skins/Skin{N}/...splasharts/{ChampId}loadscreen_{N}.jpg
 *   → mappé vers :
 *   https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/characters/{champId_lower}/skins/skin{N}/{champId_lower}loadscreen_{N}.jpg
 *
 * Ou plus simplement, l'URL splash la plus fiable :
 *   https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/characters/{champId_lower}/skins/skin{N}/{champId_lower}splashuncentered_{N}.jpg
 *
 * Lance : node fix_skins_communitydragon.js
 * Dépendances : aucune (Node 18+ avec fetch natif)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs   = require('fs');
const path = require('path');

const CDragon_BASE = 'https://raw.communitydragon.org/latest';
const DD_BASE      = 'https://ddragon.leagueoflegends.com/cdn/16.3.1';
const OUT_DIR      = './locales';
const OUT_FILE     = path.join(OUT_DIR, 'skins.json');
const CLASSIC_FR   = 'Classique';
const DELAY_MS     = 100; // délai entre requêtes pour ne pas surcharger le CDN

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Retry helper ──────────────────────────────────────────────────────────────
async function fetchJSON(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(500 * attempt);
    }
  }
}

// ── Construire l'URL splash depuis le chemin CommunityDragon ─────────────────
// Les JSONs CommunityDragon contiennent un champ "splashPath" ou "uncenteredSplashPath"
// Format: "/lol-game-data/assets/ASSETS/Characters/Aatrox/Skins/Skin01/aatroxsplashuncentered_1.jpg"
// → "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/characters/aatrox/skins/skin01/aatroxsplashuncentered_1.jpg"
function cdragonPath(lolPath) {
  if (!lolPath) return null;
  const lower = lolPath
    .replace('/lol-game-data/assets/', '')
    .toLowerCase();
  return `${CDragon_BASE}/plugins/rcp-be-lol-game-data/global/default/${lower}`;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('🚀 Reconstruction de skins.json via CommunityDragon');
  console.log('   (URLs sans CORS — fonctionnent directement dans le navigateur)\n');

  // ── Étape 1 : liste des champions depuis DDragon ────────────────────────────
  console.log('⬇  Récupération liste champions [DDragon en_US]…');
  const listData = await fetchJSON(`${DD_BASE}/data/en_US/champion.json`);
  if (!listData) throw new Error('Impossible de charger champion.json depuis DDragon');
  
  // Trier alphabétiquement
  const champEntries = Object.values(listData.data).sort((a, b) => a.id.localeCompare(b.id));
  console.log(`   ✅ ${champEntries.length} champions trouvés\n`);

  // ── Étape 2 : récupérer l'ID numérique depuis DDragon pour CommunityDragon ──
  // CommunityDragon utilise l'ID numérique du champion (ex: Aatrox = 266)
  const allSkins = [];
  let champDone = 0;
  let skinsTotal = 0;

  for (const champ of champEntries) {
    champDone++;
    const champId  = champ.id;   // ex: "Aatrox"
    const champKey = champ.key;  // ex: "266" (ID numérique)
    const champNameEN = champ.name;

    await sleep(DELAY_MS);

    // Charger le JSON CommunityDragon pour ce champion
    const cdData = await fetchJSON(
      `${CDragon_BASE}/plugins/rcp-be-lol-game-data/global/default/v1/champions/${champKey}.json`
    );

    if (!cdData) {
      console.warn(`  ⚠  [${champDone}/${champEntries.length}] ${champId} (key=${champKey}) : JSON CDragon introuvable`);
      // Fallback : utiliser le format DDragon standard
      const ddData = await fetchJSON(`${DD_BASE}/data/en_US/champion/${champId}.json`);
      if (ddData) {
        const skins = ddData.data[champId]?.skins || [];
        for (const skin of skins) {
          const name = skin.name === 'default' ? `${champNameEN} ${CLASSIC_FR}` : skin.name;
          allSkins.push({
            championId:   champId,
            championName: champNameEN,
            skinNum:      skin.num,
            name,
            imgUrl:       `${DD_BASE}/img/champion/splash/${champId}_${skin.num}.jpg`,
          });
          skinsTotal++;
        }
      }
      continue;
    }

    // CommunityDragon a un tableau "skins" avec les données complètes
    const skins = cdData.skins || [];

    for (const skin of skins) {
      // skin.id format: 266000 = Aatrox base, 266001 = Justicar, etc.
      // skin.num = 0, 1, 2... (index DDragon)
      const skinNum = skin.id % 1000; // Extraire le numéro du skin depuis l'ID
      
      const skinName = skin.isBase
        ? `${champNameEN} ${CLASSIC_FR}`
        : (skin.name || `${champNameEN} Skin ${skinNum}`);

      // Priorité : uncenteredSplashPath > splashPath > fallback DDragon
      let imgUrl = null;
      
      if (skin.uncenteredSplashPath) {
        imgUrl = cdragonPath(skin.uncenteredSplashPath);
      } else if (skin.splashPath) {
        imgUrl = cdragonPath(skin.splashPath);
      }
      
      // Fallback si CommunityDragon n'a pas l'URL
      if (!imgUrl) {
        imgUrl = `${DD_BASE}/img/champion/splash/${champId}_${skinNum}.jpg`;
      }

      allSkins.push({
        championId:   champId,
        championName: champNameEN,
        skinNum,
        name:         skinName,
        imgUrl,
      });
      skinsTotal++;
    }

    // Afficher la progression toutes les 20 entrées ou pour le dernier
    if (champDone % 20 === 0 || champDone === champEntries.length) {
      console.log(`  ✅ [${String(champDone).padStart(3)}/${champEntries.length}] ${champId.padEnd(20)} — ${skinsTotal} skins collectés`);
    }
  }

  // ── Étape 3 : tri et sauvegarde ──────────────────────────────────────────────
  allSkins.sort((a, b) =>
    a.championId.localeCompare(b.championId) || a.skinNum - b.skinNum
  );

  // Dédoublonnage (au cas où)
  const seen = new Set();
  const deduped = allSkins.filter(s => {
    const key = `${s.championId}_${s.skinNum}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });

  fs.writeFileSync(OUT_FILE, JSON.stringify(deduped, null, 2), 'utf-8');

  console.log(`\n✨ Terminé !`);
  console.log(`   📄 ${OUT_FILE}`);
  console.log(`   🎨 ${deduped.length} skins pour ${champEntries.length} champions`);
  console.log(`\n   Exemples d'URLs générées (sans CORS) :`);
  deduped.slice(0, 5).forEach(s =>
    console.log(`   [${s.championId} skin ${s.skinNum}] ${s.name}`)
  );
  console.log('   ...');
  console.log(`\n   ⚠  Certains skins utilisent encore DDragon comme fallback`);
  
  const cdragonCount = deduped.filter(s => s.imgUrl.includes('communitydragon')).length;
  const ddCount = deduped.filter(s => s.imgUrl.includes('ddragon')).length;
  console.log(`   CommunityDragon : ${cdragonCount} skins`);
  console.log(`   DDragon (fallback) : ${ddCount} skins`);
}

main().catch(err => {
  console.error('\n❌ Erreur fatale :', err.message);
  process.exit(1);
});