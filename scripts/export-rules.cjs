const fs=require('node:fs');const html=fs.readFileSync('public/game.js','utf8');
function fn(name){const start=html.indexOf('function '+name+'(');return html.slice(start,html.indexOf('\n}',start)+2)}
const constants=html.slice(html.indexOf('const RARITIES ='),html.indexOf('const quests ='));
fs.writeFileSync('backend/rules.mjs','// Stats and item rules extracted from stable 0.47.2.\n'+constants+'\n'+['makeItem','makePlayer','recalc'].map(fn).join('\n')+'\nexport {makeItem,makePlayer,recalc};\n');
