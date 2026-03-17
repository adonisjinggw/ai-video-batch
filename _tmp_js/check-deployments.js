const https = require('https');
const http = require('http');
const fs = require('fs');

// 部署列表（从vercel ls获取，从新到旧）
const deployments = [
  { id: 'hfd7dn8rl', age: '30m' },
  { id: '4sxrtvlso', age: '7h' },
  { id: 'f0uezqnsj', age: '7h' },
  { id: 'd2pfyl395', age: '7h' },
  { id: 'gycitbl6q', age: '9h' },
  { id: 'k7539usnx', age: '9h' },
  { id: '4b37cuyp1', age: '9h' },
  { id: '5dxtj06ct', age: '10h' },
  { id: 'hds3jt8i6', age: '10h' },
  { id: '1ve6oxe8x', age: '10h' },
  { id: 'pt15od3nn', age: '11h' },
  { id: '19r9ib8g4', age: '11h' },
  { id: 'j1l3wn1uv', age: '11h' },
  { id: '8r32d9pgx', age: '11h' },
  { id: 'mi33z58ef', age: '11h' },
  { id: '5xe2s0mi6', age: '16h' },
  { id: 'kl7ibexim', age: '16h' },
  { id: 'bbkdi8zrd', age: '16h' },
  { id: 'kqllerdmm', age: '16h' },
  { id: '8mogej8ur', age: '17h' },
];

const files = [
  'mobile.html',
  'index.html', 
  'chat.html',
  'banana.html',
  'voice.html',
  'writing.html',
  'js/api-core.js',
  'js/batch.js',
  'js/skill-presets.js',
];

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

function checkJS(code) {
  try { new Function(code); return null; }
  catch (e) { return e.message; }
}

function checkHTML(html) {
  const re = /<script>([\s\S]*?)<\/script>/gi;
  let m, i = 0, errors = [];
  while (m = re.exec(html)) {
    i++;
    const err = checkJS(m[1]);
    if (err) errors.push(`script#${i}: ${err}`);
  }
  return { total: i, errors };
}

async function main() {
  // 只检查前5个部署（最新的），对每个文件找到第一个无错版本
  const bestVersions = {};
  
  for (const file of files) {
    console.log(`\n=== Checking: ${file} ===`);
    bestVersions[file] = null;
    
    for (const dep of deployments) {
      const url = `https://ai-video-batch-${dep.id}-adonisjinggws-projects.vercel.app/${file}`;
      try {
        const res = await fetch(url);
        if (res.status !== 200) {
          console.log(`  ${dep.id} (${dep.age}): HTTP ${res.status}`);
          continue;
        }
        
        const lines = res.data.split('\n').length;
        let isOK = false;
        
        if (file.endsWith('.js')) {
          const err = checkJS(res.data);
          isOK = !err;
          console.log(`  ${dep.id} (${dep.age}): ${lines} lines, JS ${isOK ? 'OK' : 'ERR: ' + err}`);
        } else {
          const result = checkHTML(res.data);
          isOK = result.errors.length === 0;
          console.log(`  ${dep.id} (${dep.age}): ${lines} lines, ${result.total} scripts, ${isOK ? 'ALL OK' : 'ERRORS: ' + result.errors.join('; ')}`);
        }
        
        if (isOK && !bestVersions[file]) {
          bestVersions[file] = { id: dep.id, age: dep.age, lines };
          console.log(`  >>> BEST VERSION FOUND: ${dep.id} (${dep.age}) ${lines} lines`);
          break; // 找到最新无错版本就停
        }
      } catch (e) {
        console.log(`  ${dep.id} (${dep.age}): FETCH ERROR: ${e.message}`);
      }
    }
  }
  
  console.log('\n\n========== SUMMARY ==========');
  for (const [file, best] of Object.entries(bestVersions)) {
    const localLines = fs.readFileSync(file, 'utf8').split('\n').length;
    if (best) {
      console.log(`${file}: BEST=${best.id} (${best.age}, ${best.lines} lines) | LOCAL=${localLines} lines`);
    } else {
      console.log(`${file}: NO CLEAN VERSION FOUND IN DEPLOYMENTS | LOCAL=${localLines} lines`);
    }
  }
}

main().catch(console.error);
