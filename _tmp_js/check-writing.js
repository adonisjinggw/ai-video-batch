const https = require('https');

const url = process.argv[2] || 'https://ai-video-batch-bl4yihbk8-adonisjinggws-projects.vercel.app/writing.html';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const matches = data.match(/data-type="[^"]+"/g);
        if (matches) {
            console.log('Found writing types:');
            matches.forEach(m => console.log('  ' + m));
        } else {
            console.log('No types found');
        }
    });
}).on('error', (e) => console.error('Error:', e.message));
