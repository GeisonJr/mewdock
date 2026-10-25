export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class Cat {
  #width: number;
  #height: number;

  constructor(width: number, height: number, _random: () => number = Math.random) {
    this.#width = width;
    this.#height = height;
  }

  update(_dtMs: number): void {}

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#e89b4a";
    ctx.fillRect(this.#width - 64, this.#height - 48, 48, 48);
  }

  react(): void {}

  setPaused(_paused: boolean): void {}

  hitRect(): Rect {
    return { x: this.#width - 64, y: this.#height - 48, width: 48, height: 48 };
  }
}
