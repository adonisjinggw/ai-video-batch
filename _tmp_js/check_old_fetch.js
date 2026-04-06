const cp = require('child_process');

const old = cp.execSync('git show 561a2bd:api/banana2.js', {encoding:'utf8', maxBuffer:50*1024*1024});
const lines = old.split('\n');
// Find fetchWithFallback
let inFFF = false;
let braceCount = 0;
let start = -1;
for(let i=0;i<lines.length;i++){
    if(lines[i].includes('async function fetchWithFallback') || lines[i].includes('function fetchWithFallback')){
        inFFF = true;
        start = i;
        braceCount = 0;
    }
    if(inFFF){
        braceCount += (lines[i].match(/{/g)||[]).length;
        braceCount -= (lines[i].match(/}/g)||[]).length;
        if(braceCount === 0 && start < i){
            // End of function
            console.log('=== fetchWithFallback (561a2bd) lines', start+1, 'to', i+1, '===');
            for(let j=start;j<=i;j++){
                console.log(String(j+1).padStart(4), lines[j]);
            }
            break;
        }
    }
}
