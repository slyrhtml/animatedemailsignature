const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'assets', 'gif');

const REPLAY_CYCLE_MS = 8000;
const HOLD1_MS = 3800;
const FADE_MS = 400;
const DARK_MS = 1000;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function applyTopDownReveal(data, width, height, sweepY, featherPx) {
  const out = Buffer.from(data);
  for (let y = 0; y < height; y++) {
    const t = clamp01((sweepY - y) / featherPx + 0.5);
    const factor = t * t * (3 - 2 * t);
    if (factor >= 1) continue;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4 + 3;
      out[idx] = Math.round(out[idx] * factor);
    }
  }
  return out;
}

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
    delays.push(stepDelay);
  }

  const activeMs = delays.reduce((sum, d) => sum + d, 0);
  delays[delays.length - 1] += REPLAY_CYCLE_MS - activeMs;

  return { sweeps, delays };
}

async function main() {
  const size = 64;
  const raw = Buffer.alloc(size * size * 4);
  for (let i = 0; i < raw.length; i += 4) {
    raw[i] = 226;
    raw[i + 1] = 226;
    raw[i + 2] = 226;
    raw[i + 3] = 255;
  }

  const feather = Math.round(size * 0.45);
  const { sweeps, delays } = buildCycleSequence({
    sweepMin: -feather,
    sweepMax: size + feather,
    transitionFrames: 12,
  });

  const frames = [];
  for (const sweepY of sweeps) {
    const masked = applyTopDownReveal(raw, size, size, sweepY, feather);
    const frame = await sharp(masked, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
    frames.push(frame);
  }

  await sharp(frames, { join: { animated: true, pageHeight: size } })
    .gif({ delay: delays, loop: 0, colours: 16, effort: 10, dither: 1.0 })
    .toFile(path.join(OUT, 'border-animated.gif'));

  await sharp(raw, { raw: { width: size, height: size, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, 'border-static.png'));

  console.log('Built transparent sweeping border GIFs');
}

main().catch(console.error);
