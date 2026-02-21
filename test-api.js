const https = require('https');

function testApi(action, body = {}) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            apiType: 'public-api',
            action,
            ...body
        });

        const options = {
            hostname: 'lossloop.cn',
            port: 443,
            path: '/api/proxy',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                try {
                    const result = JSON.parse(Buffer.concat(chunks).toString());
                    console.log(`✅ ${action} - 状态码: ${res.statusCode}`);
                    console.log(JSON.stringify(result, null, 2));
                    resolve(result);
                } catch (e) {
                    console.error(`❌ ${action} - 解析失败:`, e.message);
                    reject(e);
                }
            });
        });

        req.on('error', (error) => {
            console.error(`❌ ${action} - 请求失败:`, error.message);
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

async function main() {
    console.log('🚀 开始测试API...\n');

    await testApi('health');
    console.log('\n' + '='.repeat(50) + '\n');

    await testApi('skills');
    console.log('\n' + '='.repeat(50) + '\n');

    await testApi('proxy', {
        targetApi: 'banana2',
        prompt: '一只可爱的猫咪',
        aspectRatio: '1:1'
    });
}

main().catch(console.error);
