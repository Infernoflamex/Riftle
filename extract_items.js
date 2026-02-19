const fs = require('fs');
const path = require('path');

// Configuration — keep in sync with extract_champions.js
const VERSION = "16.3.1";
const LANGUAGES = ["fr_FR", "en_US", "es_ES", "de_DE", "ko_KR"];
const DD_BASE = `https://ddragon.leagueoflegends.com/cdn/${VERSION}`;

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
    { re: /(\d+(?:[,.]\d+)?)\s*dégâts d['']attaque\b/i,                              label: 'AD',           icon: '⚔️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*puissance magique\b/i,                                 label: 'AP',           icon: '✨',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*pv\b(?!\s*(?:max|manquants))/i,                       label: 'HP',           icon: '❤️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*mana\b(?!\s*rég)/i,                                   label: 'Mana',         icon: '💙',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*(?:points?\s+d[''])?armure\b/i,                       label: 'AR',           icon: '🛡️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*résistance magique\b/i,                                label: 'MR',           icon: '🔮',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*vitesse d['']attaque\b/i,                         label: 'Atk Speed',    icon: '⚡',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*chance de critique\b/i,                           label: 'Crit Chance',  icon: '🎯',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*dégâts critiques\b/i,                             label: 'Crit Dmg',     icon: '💥',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*vitesse de déplacement\b/i,                           label: 'Speed',        icon: '👟',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*vol de vie\b/i,                                   label: 'Lifesteal',    icon: '🩸',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*létalité\b/i,                                         label: 'Lethality',    icon: '🗡️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*pénétration magique\b/i,                              label: 'Magic Pen',    icon: '🌀',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*accélération de compétence\b/i,                       label: 'AH',           icon: '⏱️',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*d['']?omnivamp(?:irisme)?\b/i,                   label: 'Omnivamp',     icon: '💜',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*régénération de pv\b/i,                               label: 'HP Regen',     icon: '💚',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*régénération de mana\b/i,                             label: 'Mana Regen',   icon: '🔵',  percent: false },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*ténacité\b/i,                                    label: 'Tenacity',     icon: '🔰',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*puissance de soins et de bouclier\b/i,           label: 'Heal & Shield',icon: '💊',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*mana de base\b/i,                                label: 'Mana Regen%',  icon: '🔵',  percent: true  },
    { re: /(\d+(?:[,.]\d+)?)\s*%\s*pv de base\b/i,                                  label: 'HP Regen%',    icon: '💚',  percent: true  },
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
    .filter(l => l && !l.match(/^\+?\d+\s*(%|pv|mana|ad|ap|ar|mr|armure|dégâts|puissance|résistance|létalité|accélération|omnivamp|ténacité)/i))
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
function formatItems(itemsData, lang) {
  const list = [];
  const seenNames = new Set();

  for (const [id, item] of Object.entries(itemsData)) {
    // Skip: unpurchasable, Ornn upgrades, 0 gold
    if (!item.gold || !item.gold.purchasable || item.requiredAlly) continue;
    if (item.gold.total <= 0) continue;

    // Dedup by name
    const nameLower = item.name.toLowerCase().trim();
    if (seenNames.has(nameLower)) continue;
    seenNames.add(nameLower);

    // Merge stats: DDragon object first (authoritative), then description fills gaps
    const objStats  = parseStatsFromObject(item.stats);
    const descStats = parseStatsFromDesc(item.description, lang);

    const mergedStats = { ...objStats };
    for (const [key, val] of Object.entries(descStats)) {
      if (!(key in mergedStats)) mergedStats[key] = val;
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
