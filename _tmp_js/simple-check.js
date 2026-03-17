const fs = require('fs');

console.log('Step 1: Reading files...');
const batchContent = fs.readFileSync('./js/batch.js', 'utf8');
const mobileContent = fs.readFileSync('./mobile.html', 'utf8');

console.log('Step 2: Finding PROMPT_TEMPLATES in batch.js...');
const batchStart = batchContent.indexOf('const PROMPT_TEMPLATES = {');
console.log('batchStart:', batchStart);

if (batchStart !== -1) {
  let braceCount = 0;
  let batchEnd = batchStart;
  for (let i = batchStart; i < batchContent.length; i++) {
    if (batchContent[i] === '{') braceCount++;
    if (batchContent[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        batchEnd = i + 1;
        break;
      }
    }
  }
  console.log('batchEnd:', batchEnd);
  const batchObjStr = batchContent.substring(batchStart, batchEnd);
  console.log('Batch object length:', batchObjStr.length);
  
  const batchKeys = [];
  const keyRe = /^\s*([a-zA-Z_][a-zA-Z0-9_]*):\s*\{/gm;
  let m;
  while ((m = keyRe.exec(batchObjStr)) !== null) {
    if (!m[1].startsWith('//')) {
      batchKeys.push(m[1]);
    }
  }
  console.log('Batch keys found:', batchKeys.length);
}

console.log('\nStep 3: Finding fillTemplates in mobile.html...');
const mobileStart = mobileContent.indexOf('const fillTemplates = {');
console.log('mobileStart:', mobileStart);

if (mobileStart !== -1) {
  let braceCount = 0;
  let mobileEnd = mobileStart;
  for (let i = mobileStart; i < mobileContent.length; i++) {
    if (mobileContent[i] === '{') braceCount++;
    if (mobileContent[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        mobileEnd = i + 1;
        break;
      }
    }
  }
  console.log('mobileEnd:', mobileEnd);
  const mobileObjStr = mobileContent.substring(mobileStart, mobileEnd);
  console.log('Mobile object length:', mobileObjStr.length);
  
  const mobileKeys = [];
  const keyRe = /^\s*([a-zA-Z_][a-zA-Z0-9_]*):\s*\{/gm;
  let m;
  while ((m = keyRe.exec(mobileObjStr)) !== null) {
    if (!m[1].startsWith('//')) {
      mobileKeys.push(m[1]);
    }
  }
  console.log('Mobile keys found:', mobileKeys.length);
}

console.log('\nDone!');
