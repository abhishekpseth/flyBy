// Generates assets/chime.wav — a soft, pure single "bong" cabin chime.
// Pure Node, no dependencies. Run:  node scripts/make-chime.js
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "assets", "chime.wav");

const SR = 44100;

// A single soft bong: near-pure tone (tiny 2nd harmonic) with a long decay.
const NOTE = { freq: 587.33, dur: 1.8, decay: 2.4, harm: 0.08 }; // D5

const N = Math.floor((NOTE.dur + 0.05) * SR);
const samples = new Float32Array(N);
const lenS = Math.floor(NOTE.dur * SR);
for (let i = 0; i < lenS; i++) {
  const t = i / SR;
  const env = Math.exp(-t * NOTE.decay);
  const attack = Math.min(1, t / 0.005); // ~5ms fade-in to avoid a click
  const wave =
    Math.sin(2 * Math.PI * NOTE.freq * t) +
    NOTE.harm * Math.sin(2 * Math.PI * NOTE.freq * 2 * t);
  samples[i] = 0.5 * attack * env * wave;
}

// 16-bit mono PCM WAV.
const bps = 2;
const dataSize = N * bps;
const buf = Buffer.alloc(44 + dataSize);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + dataSize, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * bps, 28);
buf.writeUInt16LE(bps, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(dataSize, 40);
for (let i = 0; i < N; i++) {
  const v = Math.max(-1, Math.min(1, samples[i]));
  buf.writeInt16LE(Math.round(v * 32767), 44 + i * bps);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, buf);
console.log(`Wrote ${OUT} (${(dataSize / 1024).toFixed(1)} KB, ${NOTE.dur.toFixed(2)}s)`);
