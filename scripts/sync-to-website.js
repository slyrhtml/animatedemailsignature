const fs = require('fs');
const path = require('path');
const ASSETS = require('./signature-assets');

const ROOT = path.join(__dirname, '..');
const BUNDLE_DIR = path.join(ROOT, 'build', 'host-upload', 'signature');
const SIGNATURE_HTML = path.join(ROOT, 'build', 'signature.html');
const WEBSITE_ROOT = process.env.WEBSITE_ROOT
  ? path.resolve(process.env.WEBSITE_ROOT)
  : path.join(__dirname, '..', '..', 'digitxllinkfinal');
const DEST = path.join(WEBSITE_ROOT, 'assets', 'signature');
const PREVIEW_PATH = path.join(WEBSITE_ROOT, 'signature-preview.html');

if (!fs.existsSync(WEBSITE_ROOT)) {
  console.error(`Website folder not found: ${WEBSITE_ROOT}`);
  console.error('Set WEBSITE_ROOT to your digitxllinkfinal path if it lives elsewhere.');
  process.exit(1);
}

if (!fs.existsSync(BUNDLE_DIR)) {
  console.error(`Bundle folder not found: ${BUNDLE_DIR}`);
  console.error('Run: npm run sync:bundle');
  process.exit(1);
}

fs.mkdirSync(DEST, { recursive: true });

let copied = 0;
for (const file of ASSETS) {
  const from = path.join(BUNDLE_DIR, file);
  if (!fs.existsSync(from)) {
    console.error(`Missing bundle file: ${from}`);
    console.error('Run: npm run sync:bundle');
    process.exit(1);
  }
  fs.copyFileSync(from, path.join(DEST, file));
  copied += 1;
}

// Remove files on the website that are not in the canonical bundle.
const allowed = new Set(ASSETS);
for (const entry of fs.readdirSync(DEST)) {
  if (!allowed.has(entry)) {
    fs.unlinkSync(path.join(DEST, entry));
    console.log(`Removed extra file: ${entry}`);
  }
}

const sigHtml = fs.readFileSync(SIGNATURE_HTML, 'utf8');
const preview = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Email Signature Preview — DigitxlLink</title>
  <style>
    body { margin: 0; font-family: Inter, Arial, sans-serif; background: #f3f6fa; color: #111; }
    main { max-width: 900px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { font-size: 1.5rem; margin: 0 0 8px; }
    p { margin: 0 0 20px; color: #444; line-height: 1.5; }
    .panel { background: #fff; border: 1px solid #e2e2e2; border-radius: 8px; padding: 24px; }
  </style>
</head>
<body>
  <main>
    <h1>Email signature preview</h1>
    <p>Exact copy of <code>build/signature.html</code> using <code>/assets/signature/</code> — same files as <code>build/host-upload/signature/</code>.</p>
    <div class="panel">
${sigHtml}
    </div>
  </main>
</body>
</html>
`;
fs.writeFileSync(PREVIEW_PATH, preview);

console.log(`Copied ${copied} file(s) from build/host-upload/signature/ -> ${DEST}`);
console.log(`Wrote ${PREVIEW_PATH}`);
console.log('Live URL base: https://thedigitxllink.com/assets/signature/');
