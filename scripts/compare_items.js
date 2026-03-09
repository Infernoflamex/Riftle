const path = require('path');
const A = require(path.resolve('locales/items_fr_FR.json'));
const B = require(path.resolve('locales/items_en_US.json'));
const idsA = new Set(A.map(i=>i.id));
const idsB = new Set(B.map(i=>i.id));
const onlyA = A.filter(i=>!idsB.has(i.id)).map(i=>({id:i.id,name:i.name}));
const onlyB = B.filter(i=>!idsA.has(i.id)).map(i=>({id:i.id,name:i.name}));
console.log('FR count:', A.length);
console.log('EN count:', B.length);
console.log('\nOnly in FR ('+onlyA.length+'):\n');
onlyA.forEach(i=>console.log(i.id+' — '+i.name));
console.log('\nOnly in EN ('+onlyB.length+'):\n');
onlyB.forEach(i=>console.log(i.id+' — '+i.name));
// Exit code 0
