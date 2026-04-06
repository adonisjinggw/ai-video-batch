const cp = require('child_process');

const old = cp.execSync('git show 561a2bd:mobile.html', {encoding:'utf8', maxBuffer:100*1024*1024});
const lines = old.split('\n');

// Find generateImageWithModel
for(let i=0;i<lines.length;i++){
    if(lines[i].includes('generateImageWithModel') && lines[i].includes('async function')){
        console.log('Found at line', i+1, ':', lines[i].trim());
        // Print next 80 lines
        for(let j=i;j<i+80 && j<lines.length;j++){
            console.log(String(j+1).padStart(5), lines[j]);
        }
        break;
    }
}
