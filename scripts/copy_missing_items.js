const fs = require('fs');
const path = require('path');
const enPath = path.resolve('locales/items_en_US.json');
const frPath = path.resolve('locales/items_fr_FR.json');
if (!fs.existsSync(enPath) || !fs.existsSync(frPath)) {
  console.error('Missing locale files.'); process.exit(2);
}
const en = JSON.parse(fs.readFileSync(enPath,'utf8'));
const fr = JSON.parse(fs.readFileSync(frPath,'utf8'));
const enById = new Map(en.map(i=>[i.id,i]));
const frIds = new Set(fr.map(i=>i.id));
const missing = en.filter(i=>!frIds.has(i.id));
if (!missing.length) { console.log('No missing items to copy.'); process.exit(0); }
// Copy missing items (append)
for (const m of missing) fr.push(m);
fs.writeFileSync(frPath, JSON.stringify(fr, null, 2), 'utf8');
console.log('Copied', missing.length, 'item(s) into', frPath);
console.log(missing.map(i=>i.id+' — '+i.name).join('\n'));
