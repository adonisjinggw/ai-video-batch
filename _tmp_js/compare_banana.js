const fs = require('fs');
const cp = require('child_process');

// Get old version content from git
let old;
try {
    old = cp.execSync('git show 561a2bd:api/banana2.js', {encoding:'utf8', maxBuffer:50*1024*1024});
} catch(e) {
    console.log('Failed to get old version:', e.message);
    process.exit(1);
}

const ne = fs.readFileSync('api/banana2.js', 'utf8');

// Extract FILM_COST section
const oldCost = old.match(/const FILM_COST = \{[\s\S]*?\n\};/);
const newCost = ne.match(/const FILM_COST = \{[\s\S]*?\n\};/);
console.log('=== OLD FILM_COST ===');
console.log(oldCost ? oldCost[0] : 'NOT FOUND');
console.log('\n=== NEW FILM_COST ===');
console.log(newCost ? newCost[0] : 'NOT FOUND');

// Check key differences
console.log('\n=== KEY DIFFERENCES ===');
console.log('OLD has gemini-3.1 in FILM_COST?', oldCost && oldCost[0].includes('gemini-3.1'));
console.log('NEW has gemini-3.1 in FILM_COST?', newCost && newCost[0].includes('gemini-3.1'));

// Check if fetchWithFallback uses json parsing timeout
const oldJsonTimeout = old.match(/response\.json\(\)/);
const newJsonTimeout = ne.match(/response\.json\(\)/);
console.log('\nOLD response.json() count:', (old.match(/response\.json\(\)/g)||[]).length);
console.log('NEW response.json() count:', (ne.match(/response\.json\(\)/g)||[]).length);

// Check __uploadBase64ToStorage
console.log('\nOLD storage fetch has timeout?', old.includes('fetchWithTimeout') && old.match(/fetch\(uploadUrl[\s\S]{0,200}timeoutMs/s) ? 'YES' : 'NO+MAYBE');
console.log('NEW storage fetch has timeout?', ne.includes('fetchWithTimeout') && ne.match(/fetch\(uploadUrl[\s\S]{0,200}timeoutMs/s) ? 'YES' : 'NO+MAYBE');

// Find where response.json() is called in fetchWithFallback
const oldLines = old.split('\n');
const newLines = ne.split('\n');
console.log('\n=== fetchWithFallback response handling ===');
for(let i=0;i<oldLines.length;i++){
    if(oldLines[i].includes('response.json()')){
        console.log('OLD line', i+1, ':', oldLines[i].trim());
    }
}
for(let i=0;i<newLines.length;i++){
    if(newLines[i].includes('response.json()')){
        console.log('NEW line', i+1, ':', newLines[i].trim());
    }
}
