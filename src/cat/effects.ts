import type { CatBehavior } from "./behavior.ts";
import { EFFECTS, FRAME_COLS, FRAME_ROWS, PIXEL_SCALE, type EffectName } from "./sprites.ts";

export const CELL_WIDTH: number = FRAME_COLS * PIXEL_SCALE;
export const CELL_HEIGHT: number = FRAME_ROWS * PIXEL_SCALE;

const HEART_MS: number = 380;
const HEART_LIFE_MS: number = 1400;
const HEART_RISE: number = 20;
const Z_PERIOD_MS: number = 3000;
const Z_RISE: number = 28;

export interface Placement {
  name: EffectName;
  x: number;
  y: number;
}

function place(
  out: Placement[],
  name: EffectName,
  centerX: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const frame = EFFECTS[name];
  const width = frame[0]!.length * PIXEL_SCALE;
  const height = frame.length * PIXEL_SCALE;
  const x = Math.min(Math.max(centerX - width / 2, 0), Math.max(canvasWidth - width, 0));
  out.push({ name, x, y: Math.min(Math.max(y, 0), Math.max(canvasHeight - height, 0)) });
}

function butterfly(out: Placement[], e: number, cx: number, top: number, dir: number, w: number, h: number): void {
  const x = cx + dir * (24 + 14 * Math.sin(e / 700));
  const y = top + 6 + 8 * Math.sin(e / 430 + 1);
  place(out, Math.floor(e / 120) % 2 === 0 ? "wings_open" : "wings_closed", x, y, w, h);
}

// Effects sit on the side the cat faces and are clamped to the canvas.
export function effectPlacements(
  behavior: CatBehavior,
  cx: number,
  top: number,
  canvasWidth: number,
  canvasHeight: number,
): Placement[] {
  const out: Placement[] = [];
  const e = behavior.elapsed;
  const dir = behavior.facing;

  switch (behavior.behavior) {
    case "purr":
      for (let k = 0; k < 8; k++) {
        const age = e - k * HEART_MS;
        if (age < 0 || age >= HEART_LIFE_MS) continue;
        const side = k % 2 === 0 ? 24 : -24;
        const sway = Math.sin(age / 200) * 3;
        place(out, "heart", cx + side + sway, top + 14 - (age / HEART_LIFE_MS) * HEART_RISE, canvasWidth, canvasHeight);
      }
      break;
    case "sleep":
      for (let k = 0; k < 3; k++) {
        const t = e - k * 1000;
        if (t < 0) continue;
        const p = (t % Z_PERIOD_MS) / Z_PERIOD_MS;
        place(out, "z", cx + dir * (-16 + p * 20), top + 30 - p * Z_RISE, canvasWidth, canvasHeight);
      }
      break;
    case "mew":
      if (e % 450 < 300) place(out, "bubble", cx + dir * 30, top + 4, canvasWidth, canvasHeight);
      break;
    case "swat":
      butterfly(out, e, cx, top, dir, canvasWidth, canvasHeight);
      break;
    case "play":
      if (behavior.playKind === "moth") butterfly(out, e, cx, top, dir, canvasWidth, canvasHeight);
      else {
        const bounce = Math.abs(Math.sin(e / 260));
        const x = cx + dir * (32 + 10 * Math.sin(e / 520));
        place(out, "ball", x, top + CELL_HEIGHT - 12 - bounce * 8, canvasWidth, canvasHeight);
      }
      break;
    default:
      break;
  }
  return out;
}
