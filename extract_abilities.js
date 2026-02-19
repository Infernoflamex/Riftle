const fs = require('fs');
const path = require('path');

// Configuration — keep in sync with extract_champions.js / extract_items.js
const VERSION = "16.3.1";
const LANGUAGES = ["fr_FR", "en_US", "es_ES", "de_DE", "ko_KR"];
const DD_BASE = `https://ddragon.leagueoflegends.com/cdn/${VERSION}`;

/**
 * extract_abilities.js
 * --------------------
 * Génère locales/abilities_LANG.json pour chaque langue.
 *
 * Format de sortie par entrée :
 * {
 *   "championId": "Ahri",          // clé interne EN (pour images)
 *   "name": "Orbe de Tromperie",   // nom localisé du sort
 *   "key": "Q",                    // touche (P / Q / W / E / R)
 *   "ratio": "...",                // texte du ratio extrait de la description
 *   "rawDesc": "...",              // description brute nettoyée
 *   "img": "https://..."           // URL icône DDragon
 * }
 *
 * ⚠️  DDragon ne fournit PAS les ratios sous forme de données structurées.
 *     Ce script extrait les valeurs brutes de la description (tooltipExtended).
 *     Pour des ratios ultra-précis, il faut passer par le CDN communautaire
 *     ou les compléter manuellement.
 */

const SPELL_KEYS = ['P', 'Q', 'W', 'E', 'R'];
// Map spellIndex (0-3) -> key letter (spells[0]=Q, spells[1]=W, spells[2]=E, spells[3]=R)
// passive is separate
const SPELL_INDEX_TO_KEY = ['Q', 'W', 'E', 'R'];

async function runExtraction() {
  const dir = './locales';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  console.log(`🚀 Début de l'extraction des capacités (Patch ${VERSION})`);

  for (const lang of LANGUAGES) {
    try {
      console.log(`  ⬇ Téléchargement liste champions [${lang}]...`);
      const listResp = await fetch(`${DD_BASE}/data/${lang}/champion.json`);
      if (!listResp.ok) throw new Error(`champion.json ${lang} → HTTP ${listResp.status}`);
      const listData = await listResp.json();

      const champIds = Object.keys(listData.data); // e.g. ["Aatrox", "Ahri", ...]
      const abilities = [];

      console.log(`  📚 ${champIds.length} champions à traiter...`);

      for (const champId of champIds) {
        try {
          // Individual champion JSON has full spell data
          const resp = await fetch(`${DD_BASE}/data/${lang}/champion/${champId}.json`);
          if (!resp.ok) { console.warn(`    ⚠ ${champId} introuvable`); continue; }
          const data = await resp.json();
          const champ = data.data[champId];

          // --- Passive ---
          if (champ.passive) {
            abilities.push({
              championId: champId,
              name: champ.passive.name,
              key: 'P',
              ratio: extractRatio(champ.passive.description),
              rawDesc: cleanHtml(champ.passive.description),
              img: `${DD_BASE}/img/passive/${champ.passive.image.full}`
            });
          }

          // --- Q / W / E / R ---
          (champ.spells || []).forEach((spell, idx) => {
            const key = SPELL_INDEX_TO_KEY[idx] || `S${idx}`;
            abilities.push({
              championId: champId,
              name: spell.name,
              key,
              ratio: extractRatio(spell.description),
              rawDesc: cleanHtml(spell.description),
              img: `${DD_BASE}/img/spell/${spell.image.full}`
            });
          });

        } catch (champErr) {
          console.warn(`    ⚠ Erreur sur ${champId}:`, champErr.message);
        }
      }

      const filePath = path.join(dir, `abilities_${lang}.json`);
      fs.writeFileSync(filePath, JSON.stringify(abilities, null, 2), 'utf-8');
      console.log(`  ✅ ${filePath} — ${abilities.length} capacités`);

    } catch (err) {
      console.error(`  ❌ Erreur [${lang}]:`, err.message);
    }
  }

  console.log(`\n✨ Terminé ! Fichiers dans /locales/abilities_LANG.json`);
  console.log(`   ℹ️  Les ratios sont extraits automatiquement depuis les descriptions.`);
  console.log(`   ℹ️  Tu peux les affiner manuellement dans le JSON si besoin.`);
}

/**
 * Nettoie le HTML d'une description DDragon.
 */
function cleanHtml(html) {
  if (!html) return '';
  return html
    .replace(/<(br|BR)\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Tente d'extraire un ratio depuis la description brute.
 * DDragon encode les ratios comme {{ e1 }} ou (+ XX% AP) etc.
 * On extrait les patterns courants en texte lisible.
 */
function extractRatio(html) {
  if (!html) return 'Voir description';

  const clean = cleanHtml(html);

  // Chercher des patterns de ratio courants:
  // (+ X% AP), (+ X% AD), (+ X AD), (+ X AP), etc.
  const ratioPatterns = clean.match(/\(\+\s*[\d.,]+\s*%?\s*(?:AP|AD|bonus AD|AD total|PV max|PV manquants|Mana|armor|MR)[^)]*\)/gi);
  if (ratioPatterns && ratioPatterns.length > 0) {
    return ratioPatterns.join(' + ');
  }

  // DDragon uses {{ e1 }} placeholders — extract surrounding context
  // Try to find damage/scaling sentences
  const scalingMatch = clean.match(/(?:inflige|deals|deal|dégâts|damage)[^.]{0,120}/i);
  if (scalingMatch) return scalingMatch[0].slice(0, 120);

  // Fallback: first 100 chars of description
  return clean.slice(0, 100) + (clean.length > 100 ? '…' : '');
}

runExtraction();
