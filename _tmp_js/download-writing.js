const https = require('https');
const fs = require('fs');

const url = 'https://ai-video-batch-kqllerdmm-adonisjinggws-projects.vercel.app/writing.html';
const outputPath = 'j:\\123pan\\13998416173\\NanoNoPort\\ai-video-batch\\writing.html';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        fs.writeFileSync(outputPath, data, 'utf-8');
        console.log('Downloaded writing.html successfully!');
        console.log('File saved to:', outputPath);
        console.log('File size:', data.length, 'bytes');
    });
}).on('error', (e) => console.error('Error:', e.message));
