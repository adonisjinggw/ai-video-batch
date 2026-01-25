const fs = require('fs');
const path = require('path');

function pad2(n) {
    return String(n).padStart(2, '0');
}

function buildStamp(d = new Date()) {
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    return `${y}${m}${day}${hh}${mm}`;
}

function readJson(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

function writeTextIfChanged(filePath, next) {
    const prev = fs.readFileSync(filePath, 'utf8');
    if (prev === next) return false;
    fs.writeFileSync(filePath, next, 'utf8');
    return true;
}

function main() {
    const root = path.resolve(__dirname, '..');
    const pkgPath = path.join(root, 'package.json');
    const indexPath = path.join(root, 'index.html');
    const batchPath = path.join(root, 'js', 'batch.js');

    const pkg = readJson(pkgPath);
    const version = String(pkg.version || '').trim();
    if (!version) {
        console.error('Missing package.json version');
        process.exit(1);
    }

    const displayVersion = `V${version}`;
    const stamp = buildStamp();

    const indexPrev = fs.readFileSync(indexPath, 'utf8');
    let indexNext = indexPrev;
    indexNext = indexNext.replace(/(<title>\s*RollRoll\s*-\s*让创意转动\s*)V[0-9]+(?:\.[0-9]+){1,3}(\s*<\/title>)/i, `$1${displayVersion}$2`);
    indexNext = indexNext.replace(/(css\/style\.css\?v=)[^"\s>]+/i, `$1${version}`);
    indexNext = indexNext.replace(/(js\/batch\.js\?v=)[^&"\s>]+(&t=)[^"\s>]+/i, `$1${version}$2${stamp}`);

    const batchPrev = fs.readFileSync(batchPath, 'utf8');
    let batchNext = batchPrev;
    batchNext = batchNext.replace(/(const\s+APP_VERSION\s*=\s*')V[0-9]+(?:\.[0-9]+){1,3}('\s*;)/, `$1${displayVersion}$2`);

    const indexChanged = writeTextIfChanged(indexPath, indexNext);
    const batchChanged = writeTextIfChanged(batchPath, batchNext);

    if (indexChanged || batchChanged) {
        console.log(`Synced version -> ${displayVersion} (t=${stamp})`);
    } else {
        console.log(`No changes needed (version ${displayVersion})`);
    }
}

main();
