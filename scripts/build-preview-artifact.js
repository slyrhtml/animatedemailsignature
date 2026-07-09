const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GIF = path.join(ROOT, 'assets', 'gif');
const FONTS = path.join(ROOT, 'assets', 'fonts');

function b64(filePath) {
  return fs.readFileSync(filePath).toString('base64');
}

const assets = {
  logo: `data:image/gif;base64,${b64(path.join(GIF, 'logo-animated.gif'))}`,
  web: `data:image/gif;base64,${b64(path.join(GIF, 'web-icon-animated.gif'))}`,
  insta: `data:image/gif;base64,${b64(path.join(GIF, 'insta-icon-animated.gif'))}`,
  linkedin: `data:image/gif;base64,${b64(path.join(GIF, 'linkedin-icon-animated.gif'))}`,
  facebook: `data:image/gif;base64,${b64(path.join(GIF, 'facebook-icon-animated.gif'))}`,
  youtube: `data:image/gif;base64,${b64(path.join(GIF, 'youtube-icon-animated.gif'))}`,
  photo: `data:image/gif;base64,${b64(path.join(GIF, 'profile-animated.gif'))}`,
  contact: `data:image/gif;base64,${b64(path.join(GIF, 'contact-text-animated.gif'))}`,
  cardbg: `data:image/gif;base64,${b64(path.join(GIF, 'card-bg-animated.gif'))}`,
  border: `data:image/gif;base64,${b64(path.join(GIF, 'border-animated.gif'))}`,
};

const fonts = {
  plexSans: `data:font/woff2;base64,${b64(path.join(FONTS, 'plexsans.woff2'))}`,
  plexMono400: `data:font/woff2;base64,${b64(path.join(FONTS, 'plexmono-400.woff2'))}`,
  plexMono500: `data:font/woff2;base64,${b64(path.join(FONTS, 'plexmono-500.woff2'))}`,
};

function fileSizeKB(p) {
  return (fs.statSync(p).size / 1024).toFixed(1);
}

const sizes = {
  logo: fileSizeKB(path.join(GIF, 'logo-animated.gif')),
  web: fileSizeKB(path.join(GIF, 'web-icon-animated.gif')),
  insta: fileSizeKB(path.join(GIF, 'insta-icon-animated.gif')),
  linkedin: fileSizeKB(path.join(GIF, 'linkedin-icon-animated.gif')),
  facebook: fileSizeKB(path.join(GIF, 'facebook-icon-animated.gif')),
  youtube: fileSizeKB(path.join(GIF, 'youtube-icon-animated.gif')),
  photo: fileSizeKB(path.join(GIF, 'profile-animated.gif')),
  contact: fileSizeKB(path.join(GIF, 'contact-text-animated.gif')),
  cardbg: fileSizeKB(path.join(GIF, 'card-bg-animated.gif')),
  cardbgstatic: fileSizeKB(path.join(GIF, 'card-bg-static.png')),
  border: fileSizeKB(path.join(GIF, 'border-animated.gif')),
};

const totalKB = Object.values(sizes).reduce((a, b) => a + parseFloat(b), 0).toFixed(1);

let template = fs.readFileSync(path.join(__dirname, 'preview-template.html'), 'utf8');

for (const [key, val] of Object.entries(assets)) {
  template = template.split(`__ASSET_${key.toUpperCase()}__`).join(val);
}
for (const [key, val] of Object.entries(fonts)) {
  template = template.split(`__FONT_${key.toUpperCase()}__`).join(val);
}
for (const [key, val] of Object.entries(sizes)) {
  template = template.split(`__SIZE_${key.toUpperCase()}__`).join(val);
}
template = template.split('__TOTAL_KB__').join(totalKB);

fs.writeFileSync(path.join(ROOT, 'build', 'preview-hosted.html'), template);
console.log('written, total asset KB:', totalKB);
