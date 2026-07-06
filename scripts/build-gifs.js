const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'assets', 'source');
const OUT = path.join(__dirname, '..', 'assets', 'gif');
const WHITE = { r: 255, g: 255, b: 255 };

async function buildLogoGif() {
  const canvasW = 240, canvasH = 96;
  const logoW = 220;
  const src = await sharp(path.join(SRC, 'logo.png')).resize({ width: logoW }).toBuffer();
  const logoMeta = await sharp(src).metadata();
  const left = Math.round((canvasW - logoMeta.width) / 2);
  const baseTop = Math.round((canvasH - logoMeta.height) / 2);

  // [opacity, yOffset(px, positive = lower/starting position), delayMs]
  const steps = [
    [0.00, 10, 40],
    [0.18, 9, 40],
    [0.38, 7, 40],
    [0.58, 5, 40],
    [0.76, 3, 40],
    [0.90, 1, 40],
    [1.00, 0, 40],
    [1.00, 0, 100],
  ];

  const frames = [];
  const delays = [];
  for (const [opacity, yOff, delay] of steps) {
    const faded = await sharp(src)
      .ensureAlpha()
      .linear([1, 1, 1, opacity], [0, 0, 0, 0])
      .toBuffer();
    const frame = await sharp({
      create: { width: canvasW, height: canvasH, channels: 3, background: WHITE },
    })
      .composite([{ input: faded, left, top: baseTop + yOff }])
      .png()
      .toBuffer();
    frames.push(frame);
    delays.push(delay);
  }

  await sharp(frames, { join: { animated: true, pageHeight: canvasH } })
    .gif({ delay: delays, loop: 1 })
    .toFile(path.join(OUT, 'logo-animated.gif'));
}

async function buildIconGif(name, staggerMs) {
  const canvas = 34;
  const restWidth = 28;
  const scales = [1.0, 1.0, 1.18, 1.08, 0.94, 1.03, 1.0];
  const delays = [Math.max(staggerMs, 20), 50, 60, 60, 60, 60, 120];

  const frames = [];
  for (const scale of scales) {
    const targetW = Math.max(1, Math.round(restWidth * scale));
    const resized = await sharp(path.join(SRC, `${name}.png`))
      .resize({ width: targetW, fit: 'contain' })
      .toBuffer();
    const meta = await sharp(resized).metadata();
    const left = Math.round((canvas - meta.width) / 2);
    const top = Math.round((canvas - meta.height) / 2);
    const frame = await sharp({
      create: { width: canvas, height: canvas, channels: 3, background: WHITE },
    })
      .composite([{ input: resized, left, top }])
      .png()
      .toBuffer();
    frames.push(frame);
  }

  await sharp(frames, { join: { animated: true, pageHeight: canvas } })
    .gif({ delay: delays, loop: 1 })
    .toFile(path.join(OUT, `${name}-animated.gif`));
}

async function main() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  await buildLogoGif();
  console.log('logo done');

  const icons = ['web-icon', 'insta-icon', 'linkedin-icon', 'facebook-icon', 'youtube-icon'];
  for (let i = 0; i < icons.length; i++) {
    await buildIconGif(icons[i], i * 150);
    console.log(icons[i], 'done');
  }

  console.log('\nOutput sizes:');
  for (const f of fs.readdirSync(OUT)) {
    const size = fs.statSync(path.join(OUT, f)).size;
    console.log(' ', f, (size / 1024).toFixed(1) + 'KB');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
