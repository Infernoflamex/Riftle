#!/usr/bin/env node

/**
 * buildWhitelist.js
 * 
 * Creates a whitelist of items from lolshop.gg
 * Fetches lolshop.gg, extracts all item names, matches with DDragon, 
 * and excludes support quest variants.
 * 
 * Usage:
 *   node buildWhitelist.js [VERSION]
 *   node buildWhitelist.js 16.3.1
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Get VERSION from extract_items.js or use provided argument
const args = process.argv.slice(2);
let VERSION = args[0];

if (!VERSION) {
  const extractPath = path.join(__dirname, 'extract_items.js');
  if (fs.existsSync(extractPath)) {
    const content = fs.readFileSync(extractPath, 'utf8');
    const match = content.match(/const VERSION = "([^"]+)"/);
    if (match) VERSION = match[1];
  }
}

if (!VERSION) {
  console.error('❌ VERSION not specified. Usage: node buildWhitelist.js [VERSION]');
  process.exit(1);
}

console.log(`🔍 Fetching lolshop.gg item list...`);

// Fetch lolshop.gg
https.get('https://lolshop.gg/', (res) => {
  let html = '';
  
  res.on('data', chunk => html += chunk);
  res.on('end', () => {
    // Extract all item names from lolshop.gg using data-item-name attribute
    const itemNameRegex = /data-item-name="([^"]+)"/g;
    const lolshopItems = new Set();
    let match;
    
    while ((match = itemNameRegex.exec(html)) !== null) {
      const name = match[1].trim();
      if (name && name.length > 0) {
        lolshopItems.add(name);
      }
    }
    
    console.log(`✅ Found ${lolshopItems.size} items on lolshop.gg`);
    
    // Quest variants to exclude even if on lolshop
    const questVariants = new Set([
      'Celestial Opposition',
      'Dream Maker',
      "Zaz'Zak's Realmspike",
      'Solstice Sleigh',
      'Bloodsong',
    ]);
    
    console.log(`🔍 Fetching DDragon item data for patch ${VERSION}...`);
    
    // Now fetch DDragon and match
    const url = `https://ddragon.leagueoflegends.com/cdn/${VERSION}/data/en_US/item.json`;
    https.get(url, (ddRes) => {
      let ddData = '';
      
      ddRes.on('data', chunk => ddData += chunk);
      ddRes.on('end', () => {
        try {
          const json = JSON.parse(ddData);
          const items = json.data;
          
          const whitelistedIds = [];
          const notFound = [];
          
          // Match lolshop items with DDragon
          for (const [id, item] of Object.entries(items)) {
            const name = item.name;
            
            // Check if this item is in lolshop
            if (lolshopItems.has(name)) {
              // Exclude quest variants
              if (!questVariants.has(name)) {
                whitelistedIds.push({ id: parseInt(id), name });
              }
            }
          }
          
          // Sort by ID
          whitelistedIds.sort((a, b) => a.id - b.id);
          
          console.log(`\n✅ Matched items:`);
          console.log(`  • Total lolshop items: ${lolshopItems.size}`);
          console.log(`  • Quest variants excluded: ${questVariants.size}`);
          console.log(`  • Whitelisted from DDragon: ${whitelistedIds.length}`);
          
          // Find items not found in DDragon
          const foundNames = new Set(whitelistedIds.map(x => x.name));
          const questVariantNames = Array.from(questVariants);
          const missing = Array.from(lolshopItems).filter(
            name => !foundNames.has(name) && !questVariantNames.includes(name)
          );
          
          if (missing.length > 0) {
            console.log(`\n⚠️  Items on lolshop but not in DDragon:`);
            missing.forEach(name => console.log(`  • ${name}`));
          }
          
          // Generate the whitelist constant
          let output = `// AUTO-GENERATED: buildWhitelist.js from lolshop.gg for patch ${VERSION}\n`;
          output += `// DO NOT EDIT MANUALLY - regenerate with: node buildWhitelist.js ${VERSION}\n`;
          output += `// Whitelisted items are those available on lolshop.gg, excluding quest variants\n\n`;
          output += `const WHITELISTED_ITEMS = new Set([\n`;
          
          for (const item of whitelistedIds) {
            output += `  ${item.id}, // ${item.name}\n`;
          }
          
          output += `]);\n`;
          
          console.log('\n' + output);
          
          // Save to file
          const outputFile = path.join(__dirname, `WHITELISTED_ITEMS_${VERSION}.js`);
          fs.writeFileSync(outputFile, output);
          console.log(`\n📝 Saved to: ${outputFile}`);
          console.log(`\n💡 To use this whitelist in extract_items.js:`);
          console.log(`   1. Copy the WHITELISTED_ITEMS constant`);
          console.log(`   2. Replace shouldExcludeItem() with a whitelist check`);
          console.log(`   3. Change: if (!WHITELISTED_ITEMS.has(parseInt(id))) continue;`);
          
        } catch (err) {
          console.error('❌ Error parsing DDragon data:', err.message);
          process.exit(1);
        }
      });
    }).on('error', (err) => {
      console.error(`❌ Failed to fetch ${url}`);
      console.error(`   ${err.message}`);
      process.exit(1);
    });
  });
}).on('error', (err) => {
  console.error('❌ Failed to fetch lolshop.gg');
  console.error(`   ${err.message}`);
  process.exit(1);
});
