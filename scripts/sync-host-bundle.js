const fs = require('fs');
const path = require('path');
const ASSETS = require('./signature-assets');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'gif');
const BUNDLE_DIR = path.join(ROOT, 'build', 'host-upload', 'signature');
const SIGNATURE_HTML = path.join(ROOT, 'build', 'signature.html');
const BUNDLE_HTML = path.join(ROOT, 'build', 'host-upload', 'signature.html');

fs.mkdirSync(BUNDLE_DIR, { recursive: true });

let copied = 0;
for (const file of ASSETS) {
  const from = path.join(SRC, file);
  if (!fs.existsSync(from)) {
    console.error(`Missing build output: ${from}`);
    console.error('Run: node scripts/build-gifs.js (and build-background.js if needed)');
    process.exit(1);
  }
  fs.copyFileSync(from, path.join(BUNDLE_DIR, file));
  copied += 1;
}

if (!fs.existsSync(SIGNATURE_HTML)) {
  console.error(`Missing ${SIGNATURE_HTML}`);
  process.exit(1);
}
fs.copyFileSync(SIGNATURE_HTML, BUNDLE_HTML);

console.log(`Synced ${copied} asset(s) to build/host-upload/signature/`);
console.log(`Copied build/signature.html -> build/host-upload/signature.html`);
