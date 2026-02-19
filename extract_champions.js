const fs = require('fs');
const path = require('path');

// Configuration — keep in sync with extract_items.js
const VERSION = "16.3.1";
const LANGUAGES = ["fr_FR", "en_US", "es_ES", "de_DE", "ko_KR"];
const DD_BASE = `https://ddragon.leagueoflegends.com/cdn/${VERSION}`;

async function runExtraction() {
    const dir = './locales';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    console.log(`🚀 Début de l'extraction des champions (Patch ${VERSION})`);

    for (const lang of LANGUAGES) {
        try {
            console.log(`  ⏬ Téléchargement [${lang}]...`);

            // champion.json gives us the list with localized names & titles
            const response = await fetch(`${DD_BASE}/data/${lang}/champion.json`);
            if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);

            const data = await response.json();
            const formattedChampions = formatChampions(data.data, lang);

            const filePath = path.join(dir, `champions_${lang}.json`);
            fs.writeFileSync(filePath, JSON.stringify(formattedChampions, null, 2), 'utf-8');

            console.log(`  ✅ Fichier généré : ${filePath} (${formattedChampions.length} champions)`);
        } catch (error) {
            console.error(`  ❌ Erreur sur la langue ${lang}:`, error.message);
        }
    }

    console.log(`\n✨ Terminé ! Tous les fichiers sont dans le dossier /locales`);
}

function formatChampions(championsData, lang) {
    const list = [];

    for (const [id, champ] of Object.entries(championsData)) {
        list.push({
            id: champ.id,           // Internal English key (e.g. "MissFortune") — used for images
            name: champ.name,       // Localized display name (e.g. "Miss Fortune" / "미스 포츈")
            title: champ.title,     // Localized title (e.g. "la Chasseresse de Primes")
            img: `${DD_BASE}/img/champion/${champ.id}.png`
        });
    }

    // Sort alphabetically by localized name for cleaner autocomplete
    list.sort((a, b) => a.name.localeCompare(b.name));

    return list;
}

runExtraction();