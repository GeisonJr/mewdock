import { mkdirSync, writeFileSync } from "node:fs";
import { CatBehavior, type Behavior } from "../src/cat/behavior.ts";
import { CELL_WIDTH, effectPlacements } from "../src/cat/effects.ts";
import { cellLeft, cellTop } from "../src/cat/render.ts";
import { EFFECTS, FRAMES, PALETTE, PIXEL_SCALE, type Frame } from "../src/cat/sprites.ts";

const OUT_DIR = new URL("../docs/previews/", import.meta.url);

// Sizes in CSS px, like the app canvas. The GIF is ZOOM times larger.
const WIDTH = 240;
const HEIGHT = 80;
const CROP = 144;
const ZOOM = 2;
const STEP_MS = 40;
const MAX_CLIP_MS = 6000;

interface Clip {
  name: string;
  behavior: Behavior;
  playKind?: "ball" | "moth";
  reaction?: boolean;
}

const CLIPS: readonly Clip[] = [
  { name: "walk", behavior: "walk" },
  { name: "groom", behavior: "groom" },
  { name: "loaf", behavior: "loaf" },
  { name: "sleep", behavior: "sleep" },
  { name: "play-ball", behavior: "play", playKind: "ball" },
  { name: "play-moth", behavior: "play", playKind: "moth" },
  { name: "stretch", behavior: "stretch" },
  { name: "yawn", behavior: "yawn" },
  { name: "purr", behavior: "purr", reaction: true },
  { name: "mew", behavior: "mew", reaction: true },
  { name: "swat", behavior: "swat", reaction: true },
  { name: "startle", behavior: "startle", reaction: true },
];

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLORS = Object.entries(PALETTE);
const INDEX = new Map(COLORS.map(([ch], i) => [ch, i + 1]));

function blit(pixels: Uint8Array, frame: Frame, left: number, top: number, flip: boolean): void {
  const width = frame[0]!.length;
  frame.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const index = INDEX.get(row[x]!);
      if (index === undefined) continue;
      const px = Math.round(left) + (flip ? width - 1 - x : x) * PIXEL_SCALE;
      const py = Math.round(top) + y * PIXEL_SCALE;
      for (let dy = 0; dy < PIXEL_SCALE; dy++) {
        for (let dx = 0; dx < PIXEL_SCALE; dx++) {
          const cx = px + dx;
          const cy = py + dy;
          if (cx >= 0 && cx < WIDTH && cy >= 0 && cy < HEIGHT) pixels[cy * WIDTH + cx] = index;
        }
      }
    }
  });
}

// Draws the cat and its effects the way render.ts does, into palette indexes (0 is transparent).
function snapshot(cat: CatBehavior): Uint8Array {
  const pixels = new Uint8Array(WIDTH * HEIGHT);
  const top = cellTop(HEIGHT, cat);
  const left = cellLeft(cat);
  const cx = left + CELL_WIDTH / 2;
  for (const effect of effectPlacements(cat, cx, top, WIDTH, HEIGHT)) {
    blit(pixels, EFFECTS[effect.name], effect.x, effect.y, false);
  }
  blit(pixels, FRAMES[cat.sprite], left, top, cat.facing === -1);
  return pixels;
}

function matches(cat: CatBehavior, clip: Clip): boolean {
  return cat.behavior === clip.behavior && (clip.playKind === undefined || cat.playKind === clip.playKind);
}

// Runs the real behavior until the clip's behavior starts, then records it until it ends.
function record(clip: Clip): { frames: Uint8Array[]; x: number } {
  for (let seed = 1; seed < 500; seed++) {
    const cat = new CatBehavior(WIDTH, seeded(seed));
    for (let t = 0; t < 600_000; t += STEP_MS) {
      if (clip.reaction === true && t % 3000 === 0) cat.react();
      if (matches(cat, clip) && cat.elapsed === 0) {
        const x = cat.x;
        const frames: Uint8Array[] = [];
        for (let e = 0; e < MAX_CLIP_MS && matches(cat, clip); e += STEP_MS) {
          frames.push(snapshot(cat));
          cat.update(STEP_MS);
        }
        return { frames, x };
      }
      cat.update(STEP_MS);
    }
  }
  throw new Error(`no ${clip.name} clip found`);
}

function lzw(indexes: Uint8Array, minCodeSize: number): Buffer {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const out: number[] = [];
  let bits = 0;
  let bitCount = 0;
  let codeSize = minCodeSize + 1;
  const emit = (code: number): void => {
    bits |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      out.push(bits & 0xff);
      bits >>>= 8;
      bitCount -= 8;
    }
  };
  let dict = new Map<string, number>();
  let next = end + 1;
  emit(clear);
  let prefix = String(indexes[0]);
  for (let i = 1; i < indexes.length; i++) {
    const key = `${prefix},${indexes[i]}`;
    if (dict.has(key)) {
      prefix = key;
      continue;
    }
    emit(prefix.includes(",") ? dict.get(prefix)! : Number(prefix));
    if (next === 4096) {
      emit(clear);
      dict = new Map();
      next = end + 1;
      codeSize = minCodeSize + 1;
    } else {
      dict.set(key, next++);
      if (next > 1 << codeSize && codeSize < 12) codeSize++;
    }
    prefix = String(indexes[i]);
  }
  emit(prefix.includes(",") ? dict.get(prefix)! : Number(prefix));
  emit(end);
  if (bitCount > 0) out.push(bits & 0xff);
  const blocks: number[] = [minCodeSize];
  for (let i = 0; i < out.length; i += 255) {
    const chunk = out.slice(i, i + 255);
    blocks.push(chunk.length, ...chunk);
  }
  blocks.push(0);
  return Buffer.from(blocks);
}

function encodeGif(width: number, height: number, frames: readonly Uint8Array[], delayCs: number): Buffer {
  const table = Buffer.alloc(16 * 3);
  COLORS.forEach(([, color], i) => {
    const n = parseInt(color.slice(1), 16);
    table.set([(n >> 16) & 255, (n >> 8) & 255, n & 255], (i + 1) * 3);
  });
  const parts: Buffer[] = [Buffer.from("GIF89a", "ascii")];
  const screen = Buffer.alloc(7);
  screen.writeUInt16LE(width, 0);
  screen.writeUInt16LE(height, 2);
  screen[4] = 0xf3;
  parts.push(screen, table);
  parts.push(Buffer.from([0x21, 0xff, 0x0b, ...Buffer.from("NETSCAPE2.0", "ascii"), 0x03, 0x01, 0x00, 0x00, 0x00]));
  for (const frame of frames) {
    // Disposal 2 clears each frame, so transparent pixels do not show the previous one.
    parts.push(Buffer.from([0x21, 0xf9, 0x04, 0x09, delayCs & 0xff, delayCs >> 8, 0x00, 0x00]));
    const descriptor = Buffer.alloc(10);
    descriptor[0] = 0x2c;
    descriptor.writeUInt16LE(width, 5);
    descriptor.writeUInt16LE(height, 7);
    parts.push(descriptor, lzw(frame, 4));
  }
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}

function crop(pixels: Uint8Array, from: number, width: number): Uint8Array {
  const out = new Uint8Array(width * ZOOM * HEIGHT * ZOOM);
  for (let y = 0; y < HEIGHT * ZOOM; y++) {
    for (let x = 0; x < width * ZOOM; x++) {
      out[y * width * ZOOM + x] = pixels[Math.floor(y / ZOOM) * WIDTH + from + Math.floor(x / ZOOM)]!;
    }
  }
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const clip of CLIPS) {
  const { frames, x } = record(clip);
  const width = clip.behavior === "walk" ? WIDTH : CROP;
  const from = clip.behavior === "walk" ? 0 : Math.min(Math.max(Math.round(x - CROP / 2), 0), WIDTH - CROP);
  const gif = encodeGif(width * ZOOM, HEIGHT * ZOOM, frames.map((f) => crop(f, from, width)), STEP_MS / 10);
  writeFileSync(new URL(`${clip.name}.gif`, OUT_DIR), gif);
  console.log(`${clip.name}.gif ${frames.length} frames ${(gif.length / 1024).toFixed(0)} KiB`);
}
