const fs = require('fs');

// knolling.html select options count
const h = fs.readFileSync('knolling.html', 'utf8');
const start = h.indexOf('fillTemplateSelect');
const end = h.indexOf('</select>', start);
const section = h.substring(start, end);
const opts = section.match(/value="[^"]+"/g);
console.log('knolling select options:', opts ? opts.length : 0);

// knolling fillTemplates JS object count
const ftMatch = h.match(/const fillTemplates = \{/);
if (ftMatch) {
    const ftStart = ftMatch.index;
    const ftSection = h.substring(ftStart, ftStart + 50000);
    const ftKeys = ftSection.match(/^\s{12}(\w+):\s*\{/gm);
    console.log('knolling fillTemplates keys:', ftKeys ? ftKeys.length : 0);
}

// prompt-templates.js key count  
const pt = fs.readFileSync('js/prompt-templates.js', 'utf8');
const ptKeys = pt.match(/^\s+(\w+):\s*\{/gm);
console.log('prompt-templates.js keys:', ptKeys ? ptKeys.length : 0);

// prompt-fill.html TEMPLATES count
const pf = fs.readFileSync('prompt-fill.html', 'utf8');
const pfKeys = pf.match(/^\s+(\w+):\s*\{/gm);
console.log('prompt-fill.html TEMPLATES keys (approx):', pfKeys ? pfKeys.length : 0);
