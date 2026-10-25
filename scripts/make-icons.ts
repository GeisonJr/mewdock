import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { BOUNDS, FRAMES, PALETTE } from "../src/cat/sprites.ts";

const OUT_DIR = new URL("../src-tauri/icons/", import.meta.url);

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

type Rgb = readonly [number, number, number];

function hex(color: string): Rgb {
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const sit = FRAMES.sit;
const sitBounds = BOUNDS.sit;

function paintCat(
  rgba: Uint8Array,
  size: number,
  scale: number,
  originX: number,
  originY: number,
  rows: readonly [from: number, to: number],
  cols: readonly [from: number, to: number],
  colorOf: (ch: string) => readonly [number, number, number, number] | null,
): void {
  for (let r = rows[0]; r < rows[1]; r++) {
    const line = sit[r]!;
    for (let c = cols[0]; c < cols[1]; c++) {
      const px = colorOf(line[c]!);
      if (px === null) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = originX + (c - cols[0]) * scale + dx;
          const y = originY + (r - rows[0]) * scale + dy;
          rgba.set(px, (y * size + x) * 4);
        }
      }
    }
  }
}

function appIcon(): Buffer {
  const size = 1024;
  const margin = 100;
  const radius = 185;
  const half = (size - margin * 2) / 2;
  const mid = size / 2;
  const top = hex("#ffe9cf");
  const bottom = hex("#ffc693");
  const rgba = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.abs(x + 0.5 - mid) - (half - radius);
      const dy = Math.abs(y + 0.5 - mid) - (half - radius);
      const distance = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - radius;
      const coverage = Math.min(Math.max(0.5 - distance, 0), 1);
      if (coverage === 0) continue;
      const t = (y - margin) / (size - margin * 2);
      const i = (y * size + x) * 4;
      for (let k = 0; k < 3; k++) rgba[i + k] = Math.round(top[k]! + (bottom[k]! - top[k]!) * t);
      rgba[i + 3] = Math.round(coverage * 255);
    }
  }

  const scale = 24;
  const catWidth = (sitBounds.x1 - sitBounds.x0) * scale;
  const catHeight = (sitBounds.y1 - sitBounds.y0) * scale;
  const originX = Math.round((size - catWidth) / 2);
  const originY = Math.round((size - catHeight) / 2) - 8;

  const shadowY = originY + catHeight - 6;
  const shadowRx = catWidth * 0.62;
  for (let y = shadowY - 30; y < shadowY + 30; y++) {
    for (let x = Math.floor(mid - shadowRx); x < mid + shadowRx; x++) {
      const d = ((x - mid) / shadowRx) ** 2 + ((y - shadowY) / 26) ** 2;
      if (d >= 1) continue;
      const i = (y * size + x) * 4;
      const a = 0.22 * (1 - d);
      for (let k = 0; k < 3; k++) rgba[i + k] = Math.round(rgba[i + k]! * (1 - a) + 90 * a);
    }
  }

  paintCat(rgba, size, scale, originX, originY, [sitBounds.y0, sitBounds.y1], [sitBounds.x0, sitBounds.x1], (ch) => {
    const color = PALETTE[ch];
    return color === undefined ? null : [...hex(color), 255];
  });
  return encodePng(size, size, rgba);
}

// Head and chest of the sitting cat as a template image: alpha only, eyes and nose cut out.
function trayIcon(): Buffer {
  const size = 44;
  const scale = 2;
  const rows: readonly [number, number] = [sitBounds.y0, 18];
  const cols: readonly [number, number] = [7, 25];
  const width = (cols[1] - cols[0]) * scale;
  const height = (rows[1] - rows[0]) * scale;
  const rgba = new Uint8Array(size * size * 4);
  paintCat(
    rgba,
    size,
    scale,
    Math.round((size - width) / 2),
    Math.round((size - height) / 2),
    rows,
    cols,
    (ch) => (ch === "." || ch === "e" || ch === "p" ? null : [0, 0, 0, 255]),
  );
  return encodePng(size, size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(new URL("app-icon.png", OUT_DIR), appIcon());
writeFileSync(new URL("tray.png", OUT_DIR), trayIcon());
