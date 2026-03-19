const fs = require('fs');

function findDuplicateIds(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const lines = content.split('\n');
  const idMap = new Map();
  const issues = [];

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const idMatches = line.match(/id=["']([^"']+)["']/g);
    if (idMatches) {
      idMatches.forEach(match => {
        const id = match.match(/id=["']([^"']+)["']/)[1];
        // Skip template IDs with ${...}
        if (id.includes('${')) return;

        if (idMap.has(id)) {
          issues.push({
            id: id,
            firstLine: idMap.get(id),
            duplicateLine: lineNum
          });
        } else {
          idMap.set(id, lineNum);
        }
      });
    }
  });

  return issues;
}

function findUnclosedTags(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const lines = content.split('\n');
  const tagStack = [];
  const issues = [];

  // Simple tag matching (not perfect but catches obvious issues)
  const selfClosing = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr']);

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const tagRegex = /<(\/?)([\w-]+)(?:\s[^>]*)?\/?>/g;
    let match;

    while ((match = tagRegex.exec(line)) !== null) {
      const isClosing = match[1] === '/';
      const tagName = match[2].toLowerCase();
      const isSelfClosing = match[0].endsWith('/>') || selfClosing.has(tagName);

      if (isClosing) {
        if (tagStack.length === 0) {
          issues.push({ line: lineNum, msg: `Closing tag </${tagName}> without opening` });
        } else {
          const last = tagStack.pop();
          if (last.tag !== tagName) {
            issues.push({ line: lineNum, msg: `Tag mismatch: expected </${last.tag}>, got </${tagName}>` });
          }
        }
      } else if (!isSelfClosing && tagName !== 'script' && tagName !== 'style') {
        tagStack.push({ tag: tagName, line: lineNum });
      }
    }
  });

  return { unclosed: tagStack, mismatches: issues };
}

function checkJSSyntax(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const lines = content.split('\n');
  const issues = [];
  let inScript = false;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    if (line.includes('<script')) inScript = true;
    if (line.includes('</script>')) inScript = false;

    if (inScript) {
      // Check for common syntax errors
      if (line.match(/\bif\s*\([^)]*\)\s*$/)) {
        issues.push({ line: lineNum, msg: 'if statement without body' });
      }

      // Check for undefined getElementById references
      const getByIdMatch = line.match(/getElementById\(['"]([^'"]+)['"]\)/);
      if (getByIdMatch) {
        const id = getByIdMatch[1];
        if (!content.includes(`id="${id}"`) && !content.includes(`id='${id}'`)) {
          issues.push({ line: lineNum, msg: `getElementById('${id}') - ID not found in document` });
        }
      }
    }
  });

  return issues;
}

const files = ['writing.html', 'index.html', 'chat.html', 'banana.html', 'mobile.html'];

files.forEach(file => {
  console.log(`\n========== ${file} ==========`);

  // Check duplicate IDs
  const dupIds = findDuplicateIds(file);
  if (dupIds.length > 0) {
    console.log(`\n[DUPLICATE IDs]`);
    dupIds.slice(0, 5).forEach(dup => {
      console.log(`  ID '${dup.id}': Line ${dup.firstLine} and Line ${dup.duplicateLine}`);
    });
    if (dupIds.length > 5) console.log(`  ... and ${dupIds.length - 5} more duplicates`);
  }

  // Check unclosed tags
  const tagIssues = findUnclosedTags(file);
  if (tagIssues.mismatches.length > 0) {
    console.log(`\n[TAG MISMATCHES]`);
    tagIssues.mismatches.slice(0, 5).forEach(issue => {
      console.log(`  Line ${issue.line}: ${issue.msg}`);
    });
  }

  if (tagIssues.unclosed.length > 0) {
    console.log(`\n[UNCLOSED TAGS]`);
    tagIssues.unclosed.slice(0, 5).forEach(tag => {
      console.log(`  <${tag.tag}> opened at line ${tag.line} never closed`);
    });
  }

  // Check JS syntax
  const jsIssues = checkJSSyntax(file);
  if (jsIssues.length > 0) {
    console.log(`\n[JAVASCRIPT ISSUES]`);
    jsIssues.slice(0, 10).forEach(issue => {
      console.log(`  Line ${issue.line}: ${issue.msg}`);
    });
    if (jsIssues.length > 10) console.log(`  ... and ${jsIssues.length - 10} more issues`);
  }

  if (dupIds.length === 0 && tagIssues.mismatches.length === 0 && tagIssues.unclosed.length === 0 && jsIssues.length === 0) {
    console.log('\n✓ No major issues detected');
  }
});
