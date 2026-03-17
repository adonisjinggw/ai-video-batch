const https = require('https');
const fs = require('fs');

// 部署列表 - 截图中17h-19h前的部署（可能是功能最全的版本）
const deployments = [
  { id: '5ahkjr2aq', age: '17h', commit: 'd9aba09 集成电脑版提示词工场' },
  { id: 'h3yi58n26', age: '17h', commit: 'f439b93 修复移动端功能问题' },
  { id: '8scavzyq2', age: '18h', commit: 'f439b93 修复QUOTA_COSTS' },
  { id: 'cywvztrvh', age: '18h', commit: '0bba636 添加grok-video-3-15s' },
  { id: '3fw54gdw1', age: '18h', commit: '0bba636 添加grok-video-3-15s' },
  { id: '8eotlptdm', age: '19h', commit: '0bba636 添加grok-video-3-15s' },
  { id: 'hpkma367q', age: '19h', commit: '0bba636 添加grok-video-3-15s' },
  { id: 'b9mphyuvt', age: '19h', commit: '0bba636 修复手机版' },
  { id: 'hmswgrfbb', age: '19h', commit: '0bba636 修复手机版' },
  { id: '9usgnammnk', age: '19h', commit: '0bba636' },
];

// 要搜索的关键特征
const FEATURES = {
  'mobile.html': ['混元3D', 'gemini-3', '长篇小说', 'novel', '配音', 'dubbingx', '角色图', '场景图'],
  'index.html': ['混元3D', 'gemini-3', 'grok'],
  'chat.html': ['agent-team', 'skill-system', 'video-merge'],
  'writing.html': ['novel-engine', 'novel-features'],
  'js/skill-presets.js': ['hunyuan3d', 'gemini-3', '论文'],
  'js/api-core.js': ['dubbingx', 'pollVodTask', 'ensureMinImageSize'],
  'js/batch.js': ['grok', 'wan2.6'],
  'banana.html': ['gemini-3', 'seedream'],
  'voice.html': ['dubbingx'],
};

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function checkJS(code) {
  try { new Function(code); return null; }
  catch (e) { return e.message; }
}

function checkHTML(html) {
  const re = /<script>([\s\S]*?)<\/script>/gi;
  let m, errors = [];
  while (m = re.exec(html)) {
    const err = checkJS(m[1]);
    if (err) errors.push(err);
  }
  return errors;
}

async function main() {
  const results = {};

  for (const file of Object.keys(FEATURES)) {
    console.log(`\n=== ${file} ===`);
    results[file] = null;
    const keywords = FEATURES[file];

    for (const dep of deployments) {
      const url = `https://ai-video-batch-${dep.id}-adonisjinggws-projects.vercel.app/${file}`;
      try {
        const res = await fetch(url);
        if (res.status !== 200) continue;

        const lines = res.data.split('\n').length;

        // 检查语法
        let syntaxOK;
        if (file.endsWith('.js')) {
          syntaxOK = !checkJS(res.data);
        } else {
          syntaxOK = checkHTML(res.data).length === 0;
        }

        // 检查功能关键词
        const found = keywords.filter(k => res.data.toLowerCase().includes(k.toLowerCase()));
        const missing = keywords.filter(k => !res.data.toLowerCase().includes(k.toLowerCase()));

        const status = syntaxOK ? '✓语法OK' : '✗语法ERR';
        const featStatus = missing.length === 0 ? '✓全部功能' : `缺少:${missing.join(',')}`;

        console.log(`  ${dep.id} (${dep.age}): ${lines}行 ${status} | 找到${found.length}/${keywords.length}个特征 ${featStatus}`);

        if (syntaxOK && missing.length === 0 && !results[file]) {
          results[file] = { id: dep.id, age: dep.age, lines };
          console.log(`  >>> 最佳版本: ${dep.id} (${dep.age})`);
          break;
        }

        // 即使语法有错但功能全的也记录
        if (missing.length === 0 && !results[file]) {
          results[file] = { id: dep.id, age: dep.age, lines, syntaxErr: !syntaxOK };
          if (!syntaxOK) console.log(`  >>> 功能最全但语法有错: ${dep.id}`);
        }
      } catch (e) {
        // skip
      }
    }
  }

  console.log('\n\n========== 最终结果 ==========');
  for (const [file, best] of Object.entries(results)) {
    const localLines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').length : 0;
    if (best) {
      const warn = best.syntaxErr ? ' ⚠语法有错需修复' : '';
      console.log(`${file}: 最佳=${best.id} (${best.age}, ${best.lines}行)${warn} | 本地=${localLines}行`);
    } else {
      console.log(`${file}: ❌ 未找到完整版本 | 本地=${localLines}行`);
    }
  }

  // 生成下载命令
  console.log('\n\n========== 下载命令 ==========');
  for (const [file, best] of Object.entries(results)) {
    if (best) {
      const safeName = file.replace(/\//g, '_');
      console.log(`# ${file} -> best_${safeName}`);
    }
  }
}

main().catch(console.error);
