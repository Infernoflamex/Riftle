const fs = require('fs');
const path = require('path');

// Configuration — keep in sync with extract_champions.js
const VERSION = "16.3.1";
const LANGUAGES = ["fr_FR", "en_US"];
const DD_BASE = `https://ddragon.leagueoflegends.com/cdn/${VERSION}`;

// ⚠️ When updating to a new patch:
//    1. Update VERSION above
//    2. Run: node buildExclusions.js <NEW_VERSION>
//    3. Copy the output EXCLUDED_ITEMS into the constant below
//    4. Run: node extract_items.js

// ─────────────────────────────────────────────────────────────────────────────
// Stat key → { label, icon, percent }
// Used for numeric stats in DDragon's item.stats object
// ─────────────────────────────────────────────────────────────────────────────
const STAT_MAP = {
  FlatPhysicalDamageMod:    { label: 'AD',          icon: '⚔️',  percent: false },
  rFlatPhysicalDamageMod:   { label: 'AD',          icon: '⚔️',  percent: false },
  FlatMagicDamageMod:       { label: 'AP',          icon: '✨',  percent: false },
  FlatHPPoolMod:            { label: 'HP',          icon: '❤️',  percent: false },
  FlatMPPoolMod:            { label: 'Mana',        icon: '💙',  percent: false },
  FlatArmorMod:             { label: 'AR',          icon: '🛡️',  percent: false },
  FlatSpellBlockMod:        { label: 'MR',          icon: '🔮',  percent: false },
  PercentAttackSpeedMod:    { label: 'Atk Speed',   icon: '⚡',  percent: true  },
  FlatCritChanceMod:        { label: 'Crit Chance', icon: '🎯',  percent: true  },
  FlatCritDamageMod:        { label: 'Crit Dmg',    icon: '💥',  percent: true  },
  FlatMovementSpeedMod:     { label: 'Speed',       icon: '👟',  percent: false },
  PercentMovementSpeedMod:  { label: 'Speed',       icon: '👟',  percent: true  },
  PercentLifeStealMod:      { label: 'Lifesteal',   icon: '🩸',  percent: true  },
  FlatHPRegenMod:           { label: 'HP Regen',    icon: '💚',  percent: false },
  FlatMPRegenMod:           { label: 'Mana Regen',  icon: '🔵',  percent: false },
  rFlatArmorPenetrationMod: { label: 'Lethality',   icon: '🗡️',  percent: false },
  FlatMagicPenetrationMod:  { label: 'Magic Pen',   icon: '🌀',  percent: false },
  rFlatMagicPenetrationMod: { label: 'Magic Pen',   icon: '🌀',  percent: false },
  PercentHPPoolMod:         { label: 'Bonus HP',    icon: '❤️',  percent: true  },
  FlatEXPBonus:             { label: 'XP Bonus',    icon: '⭐',  percent: false },
  rFlatTimeDeadMod:         { label: 'Death Timer', icon: '💀',  percent: false },
  FlatCooldownMod:          { label: 'AH',          icon: '⏱️',  percent: false },
  AbilityHasteMod:          { label: 'AH',          icon: '⏱️',  percent: false },
  PercentBaseHPRegenMod:    { label: 'HP Regen%',   icon: '💚',  percent: true  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-language description patterns
// NOTE: DDragon wraps stat values in XML-like tags (<attention>, <rarityMythic>, etc.)
// After stripping tags, a stat like "10% ability haste" may appear as "10 % ability haste"
// (space before %). So patterns use \s* between number and %, and no leading \+ required.
// ─────────────────────────────────────────────────────────────────────────────
const DESC_PATTERNS = {
  fr_FR: [
    { re: /\+?(\d+(?:[,.]\d+)?)\s*dégâts d['']attaque\b/i,                           label: 'AD',           icon: '⚔️',  percent: false },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*puissance magique\b/i,                              label: 'AP',           icon: '✨',  percent: false },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*pv\b(?!\s*(?:max|manquants))/i,                    label: 'HP',           icon: '❤️',  percent: false },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*mana\b(?!\s*rég)/i,                                label: 'Mana',         icon: '💙',  percent: false },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*(?:points?\s+d[''])?armure\b/i,                    label: 'AR',           icon: '🛡️',  percent: false },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*résistance magique\b/i,                             label: 'MR',           icon: '🔮',  percent: false },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*%\s*vitesse d['']attaque\b/i,                      label: 'Atk Speed',    icon: '⚡',  percent: true  },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*%\s*chance de critique\b/i,                        label: 'Crit Chance',  icon: '🎯',  percent: true  },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*%\s*dégâts critiques\b/i,                          label: 'Crit Dmg',     icon: '💥',  percent: true  },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*vitesse de déplacement\b/i,                        label: 'Speed',        icon: '👟',  percent: false },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*%\s*vol de vie\b/i,                                label: 'Lifesteal',    icon: '🩸',  percent: true  },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*létalité\b/i,                                      label: 'Lethality',    icon: '🗡️',  percent: false },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*pénétration magique\b/i,                           label: 'Magic Pen',    icon: '🌀',  percent: false },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*accélération de compétence\b/i,                    label: 'AH',           icon: '⏱️',  percent: false },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*%\s*d['']?omnivamp(?:irisme)?\b/i,                label: 'Omnivamp',     icon: '💜',  percent: true  },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*régénération de pv\b/i,                            label: 'HP Regen',     icon: '💚',  percent: false },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*régénération de mana\b/i,                          label: 'Mana Regen',   icon: '🔵',  percent: false },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*%\s*de\s*ténacité\b/i,                               label: 'Tenacity',     icon: '🔰',  percent: true  },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*%\s*d[''']?efficacité des soins et (?:de )?boucliers\b/i,  label: 'Heal & Shield',icon: '💊',  percent: true  },
    { re: /\+?(\d+(?:[,.]\d+)?)\s*%\s*(?:de\s+)?régénération de base du\s*(?:mana|pv)\b/i,   label: 'Mana Regen%',  icon: '🔵',  percent: true  },
  ],
  en_US: [
    { re: /(\d+(?:[,.]\d+)?)\s*attack damage\b/i,                                    label: 'AD',           icon: '⚔️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*ability power\b/i,                                    label: 'AP',           icon: '✨',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*health\b(?!\s*regen)/i,                               label: 'HP',           icon: '❤️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*mana\b(?!\s*regen)/i,                                 label: 'Mana',         icon: '💙',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*armor\b/i,                                            label: 'AR',           icon: '🛡️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*magic resist(?:ance)?\b/i,                            label: 'MR',           icon: '🔮',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*attack speed\b/i,                                 label: 'Atk Speed',    icon: '⚡',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*critical strike chance\b/i,                       label: 'Crit Chance',  icon: '🎯',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*critical strike damage\b/i,                       label: 'Crit Dmg',     icon: '💥',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*move(?:ment)?\s*speed\b/i,                            label: 'Speed',        icon: '👟',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*life\s*steal\b/i,                                 label: 'Lifesteal',    icon: '🩸',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*lethality\b/i,                                        label: 'Lethality',    icon: '🗡️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*magic\s*penetration\b/i,                              label: 'Magic Pen',    icon: '🌀',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*ability\s*haste\b/i,                                  label: 'AH',           icon: '⏱️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*omnivamp\b/i,                                     label: 'Omnivamp',     icon: '💜',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*health\s*regen(?:eration)?\b/i,                       label: 'HP Regen',     icon: '💚',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*mana\s*regen(?:eration)?\b/i,                         label: 'Mana Regen',   icon: '🔵',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*tenacity\b/i,                                     label: 'Tenacity',     icon: '🔰',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*heal(?:ing)?\s*and\s*shield\s*power\b/i,         label: 'Heal & Shield',icon: '💊',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*base\s*mana\s*regen(?:eration)?\b/i,             label: 'Mana Regen%',  icon: '🔵',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*base\s*health\s*regen(?:eration)?\b/i,           label: 'HP Regen%',    icon: '💚',  percent: true  },
  ],
  es_ES: [
    { re: /(\d+(?:[,.]\d+)?)\s*daño de ataque\b/i,                label: 'AD',          icon: '⚔️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*poder mágico\b/i,                   label: 'AP',          icon: '✨',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*vida\b/i,                           label: 'HP',          icon: '❤️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*maná\b/i,                           label: 'Mana',        icon: '💙',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*armadura\b/i,                       label: 'AR',          icon: '🛡️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*resistencia mágica\b/i,             label: 'MR',          icon: '🔮',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*letalidad\b/i,                      label: 'Lethality',   icon: '🗡️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*penetración mágica\b/i,             label: 'Magic Pen',   icon: '🌀',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*celeridad de habilidades\b/i,       label: 'AH',          icon: '⏱️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*omnivampirismo\b/i,             label: 'Omnivamp',    icon: '💜',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*tenacidad\b/i,                  label: 'Tenacity',    icon: '🔰',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*poder de curación y escudo\b/i, label: 'Heal & Shield',icon:'💊', percent: true  },
  ],
  de_DE: [
    { re: /(\d+(?:[,.]\d+)?)\s*angriffsschaden\b/i,                label: 'AD',          icon: '⚔️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*fähigkeitsstärke\b/i,               label: 'AP',          icon: '✨',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*leben\b/i,                          label: 'HP',          icon: '❤️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*mana\b/i,                           label: 'Mana',        icon: '💙',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*rüstung\b/i,                        label: 'AR',          icon: '🛡️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*magieresistenz\b/i,                 label: 'MR',          icon: '🔮',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*letalität\b/i,                      label: 'Lethality',   icon: '🗡️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*magiedurchdringung\b/i,             label: 'Magic Pen',   icon: '🌀',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*fähigkeitshast\b/i,                 label: 'AH',          icon: '⏱️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*omnivamp\b/i,                   label: 'Omnivamp',    icon: '💜',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*zähigkeit\b/i,                  label: 'Tenacity',    icon: '🔰',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*heil- und schildstärke\b/i,     label: 'Heal & Shield',icon:'💊',  percent: true  },
  ],
  ko_KR: [
    { re: /(\d+(?:[,.]\d+)?)\s*물리 공격력/,   label: 'AD',           icon: '⚔️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*주문력/,        label: 'AP',           icon: '✨',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*체력\b/,        label: 'HP',           icon: '❤️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*마나\b/,        label: 'Mana',         icon: '💙',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*방어력\b/,      label: 'AR',           icon: '🛡️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*마법 저항력\b/, label: 'MR',           icon: '🔮',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*치명타 확률/, label: 'Crit Chance',icon: '🎯',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*치명타 피해/, label: 'Crit Dmg',   icon: '💥',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*쿨다운 감소/,   label: 'AH',           icon: '⏱️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*흡혈/,      label: 'Omnivamp',     icon: '💜',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*강인함/,    label: 'Tenacity',     icon: '🔰',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*회복 및 보호막 강화/, label: 'Heal & Shield', icon: '💊', percent: true },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────

async function runExtraction() {
  const dir = './locales';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  console.log(`🚀 Début de l'extraction des objets (Patch ${VERSION})`);

  for (const lang of LANGUAGES) {
    try {
      console.log(`  ⬇ Téléchargement [${lang}]...`);
      const response = await fetch(`${DD_BASE}/data/${lang}/item.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const formattedItems = formatItems(data.data, lang);

      const filePath = path.join(dir, `items_${lang}.json`);
      fs.writeFileSync(filePath, JSON.stringify(formattedItems, null, 2), 'utf-8');
      console.log(`  ✅ ${filePath} (${formattedItems.length} objets)`);
    } catch (error) {
      console.error(`  ❌ [${lang}]:`, error.message);
    }
  }

  // Post-process: copy missing stats from English -> French for stability
  try {
    const enPath = path.join(dir, `items_en_US.json`);
    const frPath = path.join(dir, `items_fr_FR.json`);
    if (fs.existsSync(enPath) && fs.existsSync(frPath)) {
      const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
      const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));

      const enById = new Map(en.map(i => [i.id, i]));
      let patched = 0;

      for (const f of fr) {
        const e = enById.get(f.id);
        if (!e || !e.stats) continue;
        if (!f.stats) f.stats = {};
        for (const [label, val] of Object.entries(e.stats)) {
          if (!(label in f.stats)) {
            f.stats[label] = val;
            patched++;
          }
        }
      }

      if (patched > 0) {
        fs.writeFileSync(frPath, JSON.stringify(fr, null, 2), 'utf8');
        console.log(`\n🔧 Post-process: copied ${patched} missing stat(s) en_US → fr_FR`);
      }
    }
  } catch (err) {
    console.error('Post-process merge failed:', err.message);
  }
  console.log(`\n✨ Terminé !`);
}

// ── Parse stats from DDragon item.stats numeric object ────────────────────────
function parseStatsFromObject(statsObj) {
  const result = {};
  if (!statsObj) return result;
  for (const [key, value] of Object.entries(statsObj)) {
    const def = STAT_MAP[key];
    if (!def) continue;
    const { label, icon, percent } = def;
    if (label in result) continue;
    result[label] = {
      value: percent ? Math.round(value * 100) + '%' : value,
      icon,
      percent
    };
  }
  return result;
}

// ── Parse stats from description HTML (captures what DDragon misses) ──────────
// DDragon uses custom XML tags like <attention>, <rarityMythic>, <scaleAD>, etc.
// After stripping tags, stats appear as plain "65 dégâts d'attaque" or "10 % AH".
// We scan the FULL text (no line-start restriction) to catch everything.
function parseStatsFromDesc(html, lang) {
  if (!html) return {};

  // Strip all HTML/XML tags, normalize whitespace
  const text = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')          // remove all tags
    .replace(/&#160;|&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')              // collapse whitespace
    .trim();

  const patterns = DESC_PATTERNS[lang] || DESC_PATTERNS['en_US'];
  const result = {};

  // Single pass — scan full text for every pattern
  for (const { re, label, icon, percent } of patterns) {
    if (label in result) continue;
    const m = text.match(re);
    if (m) {
      // m[1] is the captured group (number)
      const raw = parseFloat((m[1] || m[0]).replace(',', '.'));
      if (!isNaN(raw) && raw > 0) {
        result[label] = { value: percent ? raw + '%' : raw, icon, percent };
      }
    }
  }
  return result;
}

// ── Keep only the passive/active flavour text, strip stat lines ───────────────
function cleanPassiveDesc(html) {
  if (!html) return '';
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#160;|&nbsp;/gi, ' ');

  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => {
      // Remove lines that are just stats (number + stat keywords)
      return l && !l.match(/^\+?\d+\.?\d*\s*(%|pv|mana|ad|ap|ar|mr|armure|dégâts|puissance|résistance|létalité|accélération|omnivamp|ténacité|speed|vitesse|haste|crit|heal|regen|hp|health|damage|strength|ability)/i);
    })
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Items WHITELISTED from lolshop.gg (all items on the official shop)
// Quest variants (Celestial Opposition, Dream Maker, etc.) are excluded
// Auto-generated by buildWhitelist.js — do NOT edit manually
// To update for a new patch:
//   1. Update VERSION above
//   2. Run: node buildWhitelist.js <NEW_VERSION>
//   3. Copy the WHITELISTED_ITEMS constant below from the generated file
//   4. Run: node extract_items.js
// ─────────────────────────────────────────────────────────────────────────────

const WHITELISTED_ITEMS = new Set([
  1001, // Boots
  1004, // Faerie Charm
  1006, // Rejuvenation Bead
  1018, // Cloak of Agility
  1026, // Blasting Wand
  1027, // Sapphire Crystal
  1028, // Ruby Crystal
  1029, // Cloth Armor
  1031, // Chain Vest
  1033, // Null-Magic Mantle
  1036, // Long Sword
  1037, // Pickaxe
  1038, // B. F. Sword
  1042, // Dagger
  1043, // Recurve Bow
  1052, // Amplifying Tome
  1053, // Vampiric Scepter
  1057, // Negatron Cloak
  1058, // Needlessly Large Rod
  1082, // Dark Seal
  1083, // Cull
  1101, // Scorchclaw Pup
  1102, // Gustwalker Hatchling
  1103, // Mosstomper Seedling
  1105, // Mosstomper Seedling
  1106, // Gustwalker Hatchling
  1107, // Scorchclaw Pup
  2003, // Health Potion
  2019, // Steel Sigil
  2020, // The Brutalizer
  2021, // Tunneler
  2022, // Glowing Mote
  2031, // Refillable Potion
  2138, // Elixir of Iron
  2139, // Elixir of Sorcery
  2140, // Elixir of Wrath
  2502, // Unending Despair
  2503, // Blackfire Torch
  2504, // Kaenic Rookern
  2508, // Fated Ashes
  2510, // Dusk and Dawn
  2512, // Fiendhunter Bolts
  2517, // Endless Hunger
  2520, // Bastionbreaker
  2522, // Actualizer
  2523, // Hexoptics C44
  2524, // Bandlepipes
  2525, // Protoplasm Harness
  2526, // Whispering Circlet
  2530, // Diadem of Songs
  3002, // Trailblazer
  3004, // Manamune
  3009, // Boots of Swiftness
  3010, // Symbiotic Soles
  3013, // Synchronized Souls
  3024, // Glacial Buckler
  3026, // Guardian Angel
  3031, // Infinity Edge
  3032, // Yun Tal Wildarrows
  3033, // Mortal Reminder
  3035, // Last Whisper
  3044, // Phage
  3046, // Phantom Dancer
  3047, // Plated Steelcaps
  3051, // Hearthbound Axe
  3057, // Sheen
  3065, // Spirit Visage
  3066, // Winged Moonplate
  3067, // Kindlegem
  3068, // Sunfire Aegis
  3070, // Tear of the Goddess
  3071, // Black Cleaver
  3072, // Bloodthirster
  3073, // Experimental Hexplate
  3074, // Ravenous Hydra
  3075, // Thornmail
  3076, // Bramble Vest
  3077, // Tiamat
  3078, // Trinity Force
  3084, // Heartsteel
  3086, // Zeal
  3087, // Statikk Shiv
  3094, // Rapid Firecannon
  3100, // Lich Bane
  3105, // Aegis of the Legion
  3107, // Redemption
  3108, // Fiendish Codex
  3110, // Frozen Heart
  3113, // Aether Wisp
  3114, // Forbidden Idol
  3118, // Malignance
  3121, // Fimbulwinter
  3134, // Serrated Dirk
  3135, // Void Staff
  3137, // Cryptbloom
  3139, // Mercurial Scimitar
  3140, // Quicksilver Sash
  3145, // Hextech Alternator
  3146, // Hextech Gunblade
  3147, // Haunting Guise
  3152, // Hextech Rocketbelt
  3153, // Blade of The Ruined King
  3155, // Hexdrinker
  3156, // Maw of Malmortius
  3158, // Ionian Boots of Lucidity
  3161, // Spear of Shojin
  3165, // Morellonomicon
  3170, // Swiftmarch
  3171, // Crimson Lucidity
  3172, // Gunmetal Greaves
  3173, // Chainlaced Crushers
  3174, // Armored Advance
  3176, // Forever Forward
  3179, // Umbral Glaive
  3181, // Hullbreaker
  3190, // Locket of the Iron Solari
  3302, // Terminus
  3504, // Ardent Censer
  3508, // Essence Reaver
  3748, // Titanic Hydra
  3801, // Crystalline Bracer
  3802, // Lost Chapter
  3803, // Catalyst of Aeons
  3814, // Edge of Night
  3865, // World Atlas
  3916, // Oblivion Orb
  4005, // Imperial Mandate
  4401, // Force of Nature
  4628, // Horizon Focus
  4629, // Cosmic Drive
  4630, // Blighting Jewel
  4632, // Verdant Barrier
  4633, // Riftmaker
  4638, // Watchful Wardstone
  4642, // Bandleglass Mirror
  4643, // Vigilant Wardstone
  4645, // Shadowflame
  4646, // Stormsurge
  6035, // Silvermere Dawn
  6609, // Chempunk Chainsword
  6610, // Sundered Sky
  6616, // Staff of Flowing Water
  6617, // Moonstone Renewer
  6620, // Echoes of Helia
  6621, // Dawncore
  6631, // Stridebreaker
  6657, // Rod of Ages
  6662, // Iceborn Gauntlet
  6664, // Hollow Radiance
  6670, // Noonquiver
  6672, // Kraken Slayer
  6673, // Immortal Shieldbow
  6675, // Navori Flickerblade
  6676, // The Collector
  6690, // Rectrix
  6692, // Eclipse
  6696, // Axiom Arc
  6697, // Hubris
  6698, // Profane Hydra
  6699, // Voltaic Cyclosword
  6701, // Opportunity
  8020, // Abyssal Mask
  126697, // Hubris
  221026, // Blasting Wand
  221031, // Chain Vest
  221038, // B. F. Sword
  221043, // Recurve Bow
  221053, // Vampiric Scepter
  221057, // Negatron Cloak
  221058, // Needlessly Large Rod
  222022, // Glowing Mote
  222502, // Unending Despair
  222503, // Blackfire Torch
  222504, // Kaenic Rookern
  222510, // Dusk and Dawn
  222512, // Fiendhunter Bolts
  222517, // Endless Hunger
  222522, // Actualizer
  222523, // Hexoptics C44
  222524, // Bandlepipes
  222525, // Protoplasm Harness
  222526, // Whispering Circlet
  222530, // Diadem of Songs
  223002, // Trailblazer
  223004, // Manamune
  223009, // Boots of Swiftness
  223026, // Guardian Angel
  223031, // Infinity Edge
  223032, // Yun Tal Wildarrows
  223033, // Mortal Reminder
  223046, // Phantom Dancer
  223047, // Plated Steelcaps
  223057, // Sheen
  223065, // Spirit Visage
  223067, // Kindlegem
  223068, // Sunfire Aegis
  223071, // Black Cleaver
  223072, // Bloodthirster
  223073, // Experimental Hexplate
  223074, // Ravenous Hydra
  223075, // Thornmail
  223078, // Trinity Force
  223084, // Heartsteel
  223087, // Statikk Shiv
  223094, // Rapid Firecannon
  223100, // Lich Bane
  223105, // Aegis of the Legion
  223107, // Redemption
  223110, // Frozen Heart
  223118, // Malignance
  223121, // Fimbulwinter
  223135, // Void Staff
  223137, // Cryptbloom
  223139, // Mercurial Scimitar
  223146, // Hextech Gunblade
  223152, // Hextech Rocketbelt
  223153, // Blade of The Ruined King
  223156, // Maw of Malmortius
  223158, // Ionian Boots of Lucidity
  223161, // Spear of Shojin
  223165, // Morellonomicon
  223181, // Hullbreaker
  223190, // Locket of the Iron Solari
  223302, // Terminus
  223504, // Ardent Censer
  223508, // Essence Reaver
  223748, // Titanic Hydra
  223814, // Edge of Night
  224005, // Imperial Mandate
  224401, // Force of Nature
  224628, // Horizon Focus
  224629, // Cosmic Drive
  224633, // Riftmaker
  224645, // Shadowflame
  224646, // Stormsurge
  226035, // Silvermere Dawn
  226609, // Chempunk Chainsword
  226610, // Sundered Sky
  226616, // Staff of Flowing Water
  226617, // Moonstone Renewer
  226620, // Echoes of Helia
  226621, // Dawncore
  226631, // Stridebreaker
  226657, // Rod of Ages
  226662, // Iceborn Gauntlet
  226664, // Hollow Radiance
  226672, // Kraken Slayer
  226673, // Immortal Shieldbow
  226676, // The Collector
  226692, // Eclipse
  226696, // Axiom Arc
  226697, // Hubris
  226698, // Profane Hydra
  226699, // Voltaic Cyclosword
  226701, // Opportunity
  228020, // Abyssal Mask
  322526, // Whispering Circlet
  322530, // Diadem of Songs
  323002, // Trailblazer
  323004, // Manamune
  323070, // Tear of the Goddess
  323075, // Thornmail
  323107, // Redemption
  323110, // Frozen Heart
  323121, // Fimbulwinter
  323190, // Locket of the Iron Solari
  323504, // Ardent Censer
  324005, // Imperial Mandate
  326616, // Staff of Flowing Water
  326617, // Moonstone Renewer
  326620, // Echoes of Helia
  326621, // Dawncore
  326657, // Rod of Ages
  328020, // Abyssal Mask
  663146, // Hextech Gunblade
  667666, // The Collector
]);

function shouldExcludeItem(item, itemId) {
  if (!item || !item.name) return true;
  // Only include items in the whitelist
  return !WHITELISTED_ITEMS.has(parseInt(itemId));
}

// ─────────────────────────────────────────────────────────────────────────────
function formatItems(itemsData, lang) {
  const list = [];
  const seenNames = new Set();

  for (const [id, item] of Object.entries(itemsData)) {
    // Skip: unpurchasable, Ornn upgrades, 0 gold
    if (!item.gold || !item.gold.purchasable || item.requiredAlly) continue;
    if (item.gold.total <= 0) continue;

    // Skip excluded items (arena, aram, consumables, deleted)
    if (shouldExcludeItem(item, id)) continue;

    // Dedup by name
    const nameLower = item.name.toLowerCase().trim();
    if (seenNames.has(nameLower)) continue;
    seenNames.add(nameLower);

    // Merge stats: DDragon object first (authoritative), then description fills gaps
    const objStats  = parseStatsFromObject(item.stats);
    const descStats = parseStatsFromDesc(item.description, lang);

    const mergedStats = { ...objStats };
    for (const [key, val] of Object.entries(descStats)) {
      if (!(key in mergedStats)) {
        // Only add from description if NOT already in objStats with same value
        mergedStats[key] = val;
      } else {
        // If it's in objStats, check if the value from desc matches exactly
        // If so, skip it (avoid duplication of the same stat)
        const objVal = mergedStats[key].value;
        const descVal = val.value;
        // Compare as strings after normalization
        if (String(objVal) !== String(descVal)) {
          // Different values, could be a more detailed description stat, but keep objStats
          // as the authoritative source (first extracted is usually more accurate)
        }
      }
    }

    // Skip items with truly no stats (purely utility/consumable)
    if (Object.keys(mergedStats).length === 0) continue;

    // Build components
    const components = (item.from || []).map(compId => {
      const comp = itemsData[compId];
      return {
        name:  comp ? comp.name : 'Unknown',
        price: comp ? comp.gold.total : 0,
        img:   `${DD_BASE}/img/item/${compId}.png`
      };
    });

    list.push({
      id:         parseInt(id),
      name:       item.name,
      price:      item.gold.total,
      desc:       cleanPassiveDesc(item.description),
      stats:      mergedStats,
      components,
      img:        `${DD_BASE}/img/item/${id}.png`
    });
  }

  return list;
}

runExtraction();
