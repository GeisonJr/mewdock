import { CatBehavior, type Behavior } from "./behavior.ts";
import { cellLeft, cellTop, drawCat } from "./render.ts";
import { BOUNDS, FRAME_COLS, PIXEL_SCALE } from "./sprites.ts";

export type { Behavior };

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class Cat {
  readonly #width: number;
  readonly #height: number;
  readonly #behavior: CatBehavior;

  constructor(width: number, height: number, random: () => number = Math.random) {
    this.#width = width;
    this.#height = height;
    this.#behavior = new CatBehavior(width, random);
  }

  update(dtMs: number): void {
    this.#behavior.update(dtMs);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawCat(ctx, this.#behavior, this.#width, this.#height);
  }

  react(): Behavior | null {
    return this.#behavior.react();
  }

  setPaused(paused: boolean): void {
    this.#behavior.setPaused(paused);
  }

  hitRect(): Rect {
    const b = this.#behavior;
    const bounds = BOUNDS[b.sprite];
    const flipped = b.facing === -1;
    const x0 = flipped ? FRAME_COLS - bounds.x1 : bounds.x0;
    const x1 = flipped ? FRAME_COLS - bounds.x0 : bounds.x1;
    const left = Math.max(cellLeft(b) + x0 * PIXEL_SCALE, 0);
    const right = Math.min(cellLeft(b) + x1 * PIXEL_SCALE, this.#width);
    const top = Math.max(cellTop(this.#height, b) + bounds.y0 * PIXEL_SCALE, 0);
    const bottom = Math.min(cellTop(this.#height, b) + bounds.y1 * PIXEL_SCALE, this.#height);
    return { x: left, y: top, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) };
  }
}
