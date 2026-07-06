const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.join(__dirname, '..', 'assets', 'source');
const OUT = path.join(__dirname, '..', 'build', 'host-upload', 'signature-hq');
const BG_W = 432;
const BG_H = 240;
const CYCLE_MS = 8000;
const HOLD1_MS = 3800;
const FADE_MS = 400;
const DARK_MS = 1000;
const FRAME_COUNT = 60;
const BASE_DELAY = Math.round(CYCLE_MS / FRAME_COUNT);
const WHITE = { r: 255, g: 255, b: 255 };
const BLUE = { r: 111, g: 168, b: 220 };
const DARK = { r: 24, g: 35, b: 48 };
const DARKEN_MAX = 0.62;
const SIGMA = 0.55;
const BREATH_PERIOD_MS = 2000;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(t) {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
}

function glowPeak(t) {
  const osc = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / BREATH_PERIOD_MS);
  return 0.55 + osc * 0.45;
}

function darkenAmount(t) {
  const fadeOutStart = HOLD1_MS;
  const fadeOutEnd = HOLD1_MS + FADE_MS;
  const fadeInStart = fadeOutEnd + DARK_MS;
  const fadeInEnd = fadeInStart + FADE_MS;
  if (t < fadeOutStart) return 0;
  if (t < fadeOutEnd) return smoothstep((t - fadeOutStart) / FADE_MS);
  if (t < fadeInStart) return 1;
  if (t < fadeInEnd) return 1 - smoothstep((t - fadeInStart) / FADE_MS);
  return 0;
}

function textAlpha(t) {
  const darkStart = HOLD1_MS + FADE_MS;
  const darkEnd = darkStart + DARK_MS;
  const textFadeMs = 150;
  if (t < darkStart) return 0;
  if (t < darkStart + textFadeMs) return smoothstep((t - darkStart) / textFadeMs);
  if (t < darkEnd - textFadeMs) return 1;
  if (t < darkEnd) return 1 - smoothstep((t - (darkEnd - textFadeMs)) / textFadeMs);
  return 0;
}

async function renderTextLayer() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${BG_W}" height="${BG_H}">
    <rect x="56" y="92" width="320" height="56" rx="28" fill="#0f1720" opacity="0.18"/>
    <text x="${BG_W / 2}" y="${BG_H / 2 + 10}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" letter-spacing="0" fill="#ffffff" text-anchor="middle">thedigitxllink.com</text>
  </svg>`;
  return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function buildBaseFrame(t) {
  const peak = glowPeak(t);
  const dk = darkenAmount(t) * DARKEN_MAX;
  const buf = Buffer.alloc(BG_W * BG_H * 3);
  const maxDist = Math.sqrt(2);

  for (let y = 0; y < BG_H; y++) {
    for (let x = 0; x < BG_W; x++) {
      const dx = x / BG_W;
      const dy = y / BG_H;
      const d = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const falloff = Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
      const tt = clamp01(falloff * peak);
      let r = lerp(WHITE.r, BLUE.r, tt);
      let g = lerp(WHITE.g, BLUE.g, tt);
      let b = lerp(WHITE.b, BLUE.b, tt);
      r = lerp(r, DARK.r, dk);
      g = lerp(g, DARK.g, dk);
      b = lerp(b, DARK.b, dk);
      const idx = (y * BG_W + x) * 3;
      buf[idx] = Math.round(r);
      buf[idx + 1] = Math.round(g);
      buf[idx + 2] = Math.round(b);
    }
  }

  return buf;
}

async function buildBackgroundGif() {
  const textLayer = await renderTextLayer();
  const frames = [];
  const delays = [];

  for (let f = 0; f < FRAME_COUNT; f++) {
    const t = f * BASE_DELAY;
    const basePng = await sharp(buildBaseFrame(t), { raw: { width: BG_W, height: BG_H, channels: 3 } }).png().toBuffer();
    const alpha = textAlpha(t);
    let framePng = basePng;

    if (alpha > 0.01) {
      const textBuf = Buffer.from(textLayer.data);
      for (let i = 3; i < textBuf.length; i += 4) {
        textBuf[i] = Math.round(textBuf[i] * alpha);
      }
      const textPng = await sharp(textBuf, { raw: { width: BG_W, height: BG_H, channels: 4 } }).png().toBuffer();
      framePng = await sharp(basePng).composite([{ input: textPng, left: 0, top: 0 }]).png().toBuffer();
    }

    frames.push(framePng);
    delays.push(BASE_DELAY);
  }

  const activeMs = delays.reduce((sum, delay) => sum + delay, 0);
  delays[delays.length - 1] += CYCLE_MS - activeMs;

  await sharp(frames, { join: { animated: true, pageHeight: BG_H } })
    .gif({ delay: delays, loop: 0, colours: 192, effort: 10, dither: 0.25 })
    .toFile(path.join(OUT, 'card-bg-animated.gif'));
}

const iconSvgs = {
  'web-icon': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></svg>',
  'insta-icon': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1" fill="#000" stroke="none"/></svg>',
  'linkedin-icon': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000"><path d="M6.94 8.98H3.86V20h3.08V8.98ZM5.4 4a1.78 1.78 0 1 0 0 3.56A1.78 1.78 0 0 0 5.4 4Zm6.64 4.98H9.1V20h3.08v-5.78c0-1.52.29-2.99 2.17-2.99 1.85 0 1.87 1.73 1.87 3.08V20h3.08v-6.42c0-3.15-.67-5.57-4.36-5.57-1.77 0-2.96.97-3.45 1.9h-.04l-.4-1.03Z"/></svg>',
  'facebook-icon': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000"><path d="M14.5 8H17V4h-3c-3.3 0-5 2-5 5v2H6v4h3v5h4v-5h3.2l.6-4H13V9.2c0-.8.4-1.2 1.5-1.2Z"/></svg>',
  'youtube-icon': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000"><path d="M21.4 7.5a3 3 0 0 0-2.1-2.1C17.4 5 12 5 12 5s-5.4 0-7.3.4a3 3 0 0 0-2.1 2.1A31.2 31.2 0 0 0 2.2 12c0 1.5.1 3 .4 4.5a3 3 0 0 0 2.1 2.1c1.9.4 7.3.4 7.3.4s5.4 0 7.3-.4a3 3 0 0 0 2.1-2.1c.3-1.5.4-3 .4-4.5s-.1-3-.4-4.5ZM10 15V9l5.2 3L10 15Z"/></svg>',
};

async function iconWithAlpha(name) {
  await sharp(Buffer.from(iconSvgs[name]))
    .resize(48, 48, { fit: 'contain' })
    .extend({
      top: 4,
      bottom: 4,
      left: 4,
      right: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, `${name}.png`));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await buildBackgroundGif();

  await sharp(path.join(SRC, 'logo.png'))
    .resize({ width: 240 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, 'logo.png'));

  await sharp(path.join(SRC, 'profile.png'))
    .resize(280, 280, { fit: 'cover' })
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(path.join(OUT, 'profile.jpg'));

  for (const icon of ['web-icon', 'insta-icon', 'linkedin-icon', 'facebook-icon', 'youtube-icon']) {
    await iconWithAlpha(icon);
  }

  for (const file of fs.readdirSync(OUT)) {
    const size = fs.statSync(path.join(OUT, file)).size;
    console.log(file, `${(size / 1024).toFixed(1)}KB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
