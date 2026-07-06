const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'assets', 'gif');
const WEBSITE_ROOT = process.env.WEBSITE_ROOT
  ? path.resolve(process.env.WEBSITE_ROOT)
  : path.join(__dirname, '..', '..', 'digitxllinkfinal');
const DEST = path.join(WEBSITE_ROOT, 'assets', 'signature');

const ASSETS = [
  'card-bg-animated.gif',
  'card-bg-static.png',
  'contact-text-animated.gif',
  'facebook-icon-animated.gif',
  'insta-icon-animated.gif',
  'linkedin-icon-animated.gif',
  'logo-static.png',
  'logo-animated.gif',
  'profile-animated.gif',
  'web-icon-animated.gif',
  'youtube-icon-animated.gif',
];

if (!fs.existsSync(WEBSITE_ROOT)) {
  console.error(`Website folder not found: ${WEBSITE_ROOT}`);
  console.error('Set WEBSITE_ROOT to your digitxllinkfinal path if it lives elsewhere.');
  process.exit(1);
}

fs.mkdirSync(DEST, { recursive: true });

let copied = 0;
for (const file of ASSETS) {
  const from = path.join(SRC, file);
  if (!fs.existsSync(from)) {
    console.warn(`skip (missing): ${file}`);
    continue;
  }
  fs.copyFileSync(from, path.join(DEST, file));
  copied += 1;
}

console.log(`Copied ${copied} file(s) to ${DEST}`);
console.log('Live URL base: https://thedigitxllink.com/assets/signature/');
