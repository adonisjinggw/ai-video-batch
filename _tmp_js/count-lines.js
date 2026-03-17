const fs = require('fs');
const content = fs.readFileSync('j:\\123pan\\13998416173\\NanoNoPort\\ai-video-batch\\mobile.html', 'utf-8');
const lines = content.split('\n');
console.log(`总行数: ${lines.length}`);
console.log(`最后5行:`);
for (let i = Math.max(0, lines.length - 5); i < lines.length; i++) {
    console.log(`${i + 1}: ${lines[i].substring(0, 100)}`);
}
