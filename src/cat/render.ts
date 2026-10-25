import type { CatBehavior } from "./behavior.ts";
import { CELL_HEIGHT, CELL_WIDTH, effectPlacements } from "./effects.ts";
import { EFFECTS, FRAMES, PALETTE, PIXEL_SCALE, type Frame } from "./sprites.ts";

const bitmaps = new Map<Frame, HTMLCanvasElement>();
const mirrored = new Map<Frame, HTMLCanvasElement>();

function paint(frame: Frame, flip: boolean): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const width = frame[0]!.length;
  canvas.width = width;
  canvas.height = frame.length;
  const ctx = canvas.getContext("2d")!;
  frame.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const color = PALETTE[row[x]!];
      if (color === undefined) continue;
      ctx.fillStyle = color;
      ctx.fillRect(flip ? width - 1 - x : x, y, 1, 1);
    }
  });
  return canvas;
}

function bitmapOf(frame: Frame, flip: boolean): HTMLCanvasElement {
  const cache = flip ? mirrored : bitmaps;
  let canvas = cache.get(frame);
  if (canvas === undefined) {
    canvas = paint(frame, flip);
    cache.set(frame, canvas);
  }
  return canvas;
}

function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame, x: number, y: number, flip = false): void {
  const canvas = bitmapOf(frame, flip);
  ctx.drawImage(canvas, Math.round(x), Math.round(y), canvas.width * PIXEL_SCALE, canvas.height * PIXEL_SCALE);
}

export function cellTop(canvasHeight: number, behavior: CatBehavior): number {
  return canvasHeight - CELL_HEIGHT - behavior.hopOffset;
}

export function cellLeft(behavior: CatBehavior): number {
  return Math.round(behavior.x) - CELL_WIDTH / 2 + behavior.shakeOffset;
}

export function drawCat(
  ctx: CanvasRenderingContext2D,
  behavior: CatBehavior,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const top = cellTop(canvasHeight, behavior);
  const left = cellLeft(behavior);
  const cx = left + CELL_WIDTH / 2;

  for (const effect of effectPlacements(behavior, cx, top, canvasWidth, canvasHeight)) {
    drawFrame(ctx, EFFECTS[effect.name], effect.x, effect.y);
  }
  drawFrame(ctx, FRAMES[behavior.sprite], left, top, behavior.facing === -1);
}
