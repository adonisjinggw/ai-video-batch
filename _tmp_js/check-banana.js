const https = require('https');

const url = 'https://ai-video-batch-hds3jt8i6-adonisjinggws-projects.vercel.app/mobile.html';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        // 查找option中的banana模型
        const optionMatches = data.match(/<option[^>]*value="nano-banana[^"]*"[^>]*>[^<]*<\/option>/g);
        if (optionMatches) {
            console.log('Found banana models in mobile.html options:');
            optionMatches.forEach(x => console.log(' ', x));
        } else {
            console.log('No banana models found in mobile.html options');
        }
    });
}).on('error', (e) => console.error('Error:', e.message));
