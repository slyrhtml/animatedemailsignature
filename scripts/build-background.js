const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'assets', 'gif');

// Card renders at ~380x210 CSS px. Gradients/solid tones have no fine
// detail, so a half-resolution source stretched via background-size stays
// perfectly smooth while keeping frame count/filesize down.
const W = 144, H = 80;

// Must match build-gifs.js exactly — this is the SAME timeline the logo,
// icons, and the CSS text/photo all share, so everything fades out, sits
// hidden while the card darkens and shows the URL, and fades back in
// together instead of drifting out of sync.
const CYCLE_MS = 8000;
const HOLD1_MS = 3800;
const FADE_MS = 400;
const DARK_MS = 1000;

const FRAME_COUNT = 60;
const BASE_DELAY = Math.round(CYCLE_MS / FRAME_COUNT);

const WHITE = { r: 255, g: 255, b: 255 };
const BLUE = { r: 111, g: 168, b: 220 };
const DARK = { r: 24, g: 35, b: 48 };
const DARKEN_MAX = 0.62; // "darken a bit", not to black — keeps some tone
const SIGMA = 0.55; // glow spread, in units of the normalized corner-to-corner distance
const BREATH_PERIOD_MS = 2000; // 4 clean breaths per 8s cycle — no seam at the loop point

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

// Ramps up to DARKEN_MAX during the fade-out window, holds through the dark
// window, ramps back down during fade-in — same windows the logo/icons use.
function darkenAmount(t) {
  const fadeOutStart = HOLD1_MS, fadeOutEnd = HOLD1_MS + FADE_MS;
  const fadeInStart = fadeOutEnd + DARK_MS, fadeInEnd = fadeInStart + FADE_MS;
  if (t < fadeOutStart) return 0;
  if (t < fadeOutEnd) return smoothstep((t - fadeOutStart) / FADE_MS);
  if (t < fadeInStart) return 1;
  if (t < fadeInEnd) return 1 - smoothstep((t - fadeInStart) / FADE_MS);
  return 0;
}

// The URL fades in shortly after the card finishes darkening, holds, and
// fades out shortly before the card starts brightening again.
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><text x="${W / 2}" y="${H / 2 + 4}" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="600" letter-spacing="0.3" fill="#ffffff" text-anchor="middle">thedigitxllink.com</text></svg>`;
  return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function buildBaseFrame(t) {
  const peak = glowPeak(t);
  const dk = darkenAmount(t) * DARKEN_MAX;
  const buf = Buffer.alloc(W * H * 3);
  const maxDist = Math.sqrt(2);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x / W, dy = y / H;
      const d = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const falloff = Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
      const tt = clamp01(falloff * peak);
      let r = lerp(WHITE.r, BLUE.r, tt);
      let g = lerp(WHITE.g, BLUE.g, tt);
      let b = lerp(WHITE.b, BLUE.b, tt);
      r = lerp(r, DARK.r, dk);
      g = lerp(g, DARK.g, dk);
      b = lerp(b, DARK.b, dk);
      const idx = (y * W + x) * 3;
      buf[idx] = Math.round(r);
      buf[idx + 1] = Math.round(g);
      buf[idx + 2] = Math.round(b);
    }
  }
  return buf;
}

async function main() {
  const textLayer = await renderTextLayer();

  const frames = [];
  const delays = [];
  for (let f = 0; f < FRAME_COUNT; f++) {
    const t = f * BASE_DELAY;
    const basePng = await sharp(buildBaseFrame(t), { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();

    const alpha = textAlpha(t);
    let framePng = basePng;
    if (alpha > 0.01) {
      const textBuf = Buffer.from(textLayer.data);
      for (let i = 3; i < textBuf.length; i += 4) {
        textBuf[i] = Math.round(textBuf[i] * alpha);
      }
      const textPng = await sharp(textBuf, { raw: { width: textLayer.info.width, height: textLayer.info.height, channels: 4 } }).png().toBuffer();
      framePng = await sharp(basePng).composite([{ input: textPng, left: 0, top: 0 }]).png().toBuffer();
    }
    frames.push(framePng);
    delays.push(BASE_DELAY);
  }
  const activeMs = delays.reduce((a, b) => a + b, 0);
  delays[delays.length - 1] += CYCLE_MS - activeMs;

  await sharp(frames, { join: { animated: true, pageHeight: H } })
    .gif({ delay: delays, loop: 0, colours: 128, effort: 10, dither: 0.35 })
    .toFile(path.join(OUT, 'card-bg-animated.gif'));

  // Static fallback (Outlook desktop via VML) — the normal bright moment,
  // not the darkened one, since this is what Outlook users see forever.
  const staticBuf = buildBaseFrame(0);
  await sharp(staticBuf, { raw: { width: W, height: H, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, 'card-bg-static.png'));

  for (const f of ['card-bg-animated.gif', 'card-bg-static.png']) {
    console.log(f, (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1) + 'KB');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
