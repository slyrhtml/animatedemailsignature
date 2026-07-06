const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'assets', 'source');
const OUT = path.join(__dirname, '..', 'assets', 'gif');

// Email clients don't run JS, so the periodic "everything fades out, the
// card darkens and shows the URL, then fades back in" moment has to be
// baked into each GIF's own frame timing. Every asset — background, logo,
// each icon, the contact text, and the photo — shares this exact same
// timeline so they all fade out and back in together instead of drifting.
const REPLAY_CYCLE_MS = 8000;
const HOLD1_MS = 3800;   // everything visible
const FADE_MS = 400;     // fade out (and, symmetrically, fade back in)
const DARK_MS = 1000;    // everything hidden, card darkened + URL shown
// HOLD2 = REPLAY_CYCLE_MS - HOLD1 - FADE - DARK - FADE = 2400ms, visible again, loops to t=0

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// GIF transparency is binary — a pixel is either fully opaque or fully the
// transparent index, there's no partial alpha. So a real smooth opacity
// cross-fade (0% -> 100%) can't be encoded at all; blending it against a
// fixed matte color is what caused white-box artifacts earlier, and doesn't
// work now that the background itself moves/changes color anyway. The
// GIF-native equivalent of a fade is a soft-edged reveal: sweep a feathered
// mask across the image, scaling each pixel's OWN alpha down near the mask
// edge. Every frame still only contains the source's true colours (never a
// blended matte), so there's no palette pressure from the effect itself.
//
// `sweep` ranges from -feather (nothing visible) to size+feather (fully
// visible) for BOTH helpers, so callers can treat every axis the same way:
// increasing sweep always means "more of the image has appeared."
function applyTopDownReveal(data, width, height, sweepY, featherPx) {
  const out = Buffer.from(data);
  for (let y = 0; y < height; y++) {
    const t = clamp01((sweepY - y) / featherPx + 0.5);
    const factor = t * t * (3 - 2 * t); // smoothstep easing
    if (factor >= 1) continue;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4 + 3;
      out[idx] = Math.round(out[idx] * factor);
    }
  }
  return out;
}

function applyLeftRightReveal(data, width, height, sweepX, featherPx) {
  const out = Buffer.from(data);
  for (let x = 0; x < width; x++) {
    const t = clamp01((sweepX - x) / featherPx + 0.5);
    const factor = t * t * (3 - 2 * t);
    if (factor >= 1) continue;
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4 + 3;
      out[idx] = Math.round(out[idx] * factor);
    }
  }
  return out;
}

function applyRoundedCorners(data, width, height, radius) {
  const out = Buffer.from(data);
  const r = Math.max(0, radius);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x < r ? r - x : x >= width - r ? x - (width - r - 1) : 0;
      const dy = y < r ? r - y : y >= height - r ? y - (height - r - 1) : 0;
      if (!dx && !dy) continue;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= r) continue;
      const idx = (y * width + x) * 4 + 3;
      out[idx] = 0;
    }
  }
  return out;
}

// Outlook desktop (Word rendering engine) shows ONLY an animated GIF's first
// frame, forever — it never advances. So frame 1 has to be the fully-visible
// rest state, or Outlook users get a permanently half-hidden logo/icon. The
// sequence below always opens visible, holds, fades smoothly to hidden
// (same easing/frame-count as the fade-in — this is the "make the fade-out
// smooth too" fix), stays hidden through the dark/URL window, fades back
// in, then holds visible again until the loop point — which lands back on
// the same visible state frame 1 started on, so the loop has no seam.
function buildCycleSequence({ sweepMin, sweepMax, transitionFrames }) {
  const visible = sweepMax;
  const hidden = sweepMin;
  const stepDelay = Math.max(10, Math.round(FADE_MS / (transitionFrames - 1)));

  const sweeps = [visible];
  const delays = [HOLD1_MS];

  for (let i = 1; i < transitionFrames; i++) {
    const t = i / (transitionFrames - 1);
    sweeps.push(visible + (hidden - visible) * t);
    delays.push(i === transitionFrames - 1 ? stepDelay + DARK_MS : stepDelay);
  }
  for (let i = 1; i < transitionFrames; i++) {
    const t = i / (transitionFrames - 1);
    sweeps.push(hidden + (visible - hidden) * t);
    delays.push(stepDelay); // last entry's delay is topped up below
  }

  const activeMs = delays.reduce((sum, d) => sum + d, 0);
  delays[delays.length - 1] += REPLAY_CYCLE_MS - activeMs;

  return { sweeps, delays };
}

async function buildLogoGif() {
  const canvasW = 240, canvasH = 96;
  const logoW = 220;
  const src = await sharp(path.join(SRC, 'logo.png'))
    .resize({ width: logoW })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: logoWpx, height: logoHpx } = src.info;
  const left = Math.round((canvasW - logoWpx) / 2);
  const top = Math.round((canvasH - logoHpx) / 2);
  const feather = Math.round(logoHpx * 0.4);

  const { sweeps, delays } = buildCycleSequence({
    sweepMin: -feather,
    sweepMax: logoHpx + feather,
    transitionFrames: 20,
  });

  const frames = [];
  for (const sweepY of sweeps) {
    const masked = applyTopDownReveal(src.data, logoWpx, logoHpx, sweepY, feather);
    const maskedPng = await sharp(masked, { raw: { width: logoWpx, height: logoHpx, channels: 4 } }).png().toBuffer();
    const frame = await sharp({
      create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: maskedPng, left, top }])
      .png()
      .toBuffer();
    frames.push(frame);
  }

  await sharp(frames, { join: { animated: true, pageHeight: canvasH } })
    .gif({ delay: delays, loop: 0, colours: 256, effort: 10, dither: 1.0 })
    .toFile(path.join(OUT, 'logo-animated.gif'));
}

// The icon source PNGs are baked as an opaque black glyph on an opaque
// white square — no real transparency, so compositing them anywhere except
// a plain white background shows a visible white box (same symptom the logo
// had, different cause: that file lacked alpha; these files have alpha but
// it's just 255 everywhere). Since every pixel is a pure black/white/gray
// antialiasing blend, brightness IS an alpha mask: white (255) -> fully
// transparent, black (0) -> fully opaque. Converting that way (rather than
// a hard threshold) keeps the glyph's antialiased edges smooth instead of
// jagged.
async function loadIconWithAlpha(name) {
  const img = sharp(path.join(SRC, `${name}.png`)).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const alpha = Math.round((255 - brightness) * (data[i + 3] / 255));
    out[i] = 0;
    out[i + 1] = 0;
    out[i + 2] = 0;
    out[i + 3] = alpha;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function buildIconGif(name) {
  const canvas = 34;
  const restWidth = 28;

  const iconPng = await loadIconWithAlpha(name);
  const resizedRaw = await sharp(iconPng)
    .resize({ width: restWidth, fit: 'contain' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: iconWpx, height: iconHpx } = resizedRaw.info;
  const left = Math.round((canvas - iconWpx) / 2);
  const top = Math.round((canvas - iconHpx) / 2);
  const feather = Math.max(3, Math.round(iconHpx * 0.45));

  const { sweeps, delays } = buildCycleSequence({
    sweepMin: -feather,
    sweepMax: iconHpx + feather,
    transitionFrames: 12,
  });

  const frames = [];
  for (const sweepY of sweeps) {
    const masked = applyTopDownReveal(resizedRaw.data, iconWpx, iconHpx, sweepY, feather);
    const maskedPng = await sharp(masked, { raw: { width: iconWpx, height: iconHpx, channels: 4 } }).png().toBuffer();
    const frame = await sharp({
      create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: maskedPng, left, top }])
      .png()
      .toBuffer();
    frames.push(frame);
  }

  await sharp(frames, { join: { animated: true, pageHeight: canvas } })
    .gif({ delay: delays, loop: 0, colours: 256, effort: 10, dither: 1.0 })
    .toFile(path.join(OUT, `${name}-animated.gif`));
}

async function buildContactTextGif() {
  const width = 170;
  const height = 96;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <style>
        text { font-family: Arial, Helvetica, sans-serif; fill: #000; }
        .name { font-size: 16px; font-weight: 700; }
        .small { font-size: 12px; font-weight: 400; }
        .company { font-size: 12px; font-weight: 700; }
      </style>
      <text class="name" x="0" y="15">Levi Carpenter</text>
      <text class="small" x="0" y="32">Owner / Founder</text>
      <text class="company" x="0" y="58">DigitxlLink LLC</text>
      <text class="small" x="0" y="74">6106072432</text>
      <text class="small" x="0" y="90">levi@thedigitxllink.com</text>
    </svg>`;

  const src = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const feather = 24;
  const { sweeps, delays } = buildCycleSequence({
    sweepMin: -feather,
    sweepMax: height + feather,
    transitionFrames: 12,
  });

  const frames = [];
  for (const sweepY of sweeps) {
    const masked = applyTopDownReveal(src.data, width, height, sweepY, feather);
    const frame = await sharp(masked, { raw: { width, height, channels: 4 } }).png().toBuffer();
    frames.push(frame);
  }

  await sharp(frames, { join: { animated: true, pageHeight: height } })
    .gif({ delay: delays, loop: 0, colours: 64, effort: 10, dither: 0.5 })
    .toFile(path.join(OUT, 'contact-text-animated.gif'));
}

async function buildProfileGif() {
  const size = 140;
  const src = await sharp(path.join(SRC, 'profile.png'))
    .resize(size, size, { fit: 'cover' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rounded = applyRoundedCorners(src.data, size, size, 10);
  const feather = 28;
  const { sweeps, delays } = buildCycleSequence({
    sweepMin: -feather,
    sweepMax: size + feather,
    transitionFrames: 9,
  });

  const frames = [];
  for (const sweepX of sweeps) {
    const masked = applyLeftRightReveal(rounded, size, size, sweepX, feather);
    const frame = await sharp(masked, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
    frames.push(frame);
  }

  await sharp(frames, { join: { animated: true, pageHeight: size } })
    .gif({ delay: delays, loop: 0, colours: 96, effort: 10, dither: 0.75 })
    .toFile(path.join(OUT, 'profile-animated.gif'));
}

async function main() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  await buildLogoGif();
  console.log('logo done');

  const icons = ['web-icon', 'insta-icon', 'linkedin-icon', 'facebook-icon', 'youtube-icon'];
  for (const icon of icons) {
    await buildIconGif(icon);
    console.log(icon, 'done');
  }

  await buildContactTextGif();
  console.log('contact text done');

  await buildProfileGif();
  console.log('profile done');

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
