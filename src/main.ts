import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Cat, type Rect } from "./cat/index.ts";

const FPS = 15;

const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const ctx = canvas.getContext("2d")!;
const cat = new Cat(window.innerWidth, window.innerHeight);

let paused = false;

function resize(): void {
  const dpr = window.devicePixelRatio;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  render();
}

// Moving to a display with another scale factor does not always fire "resize".
function watchPixelRatio(): void {
  matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
    "change",
    () => {
      resize();
      watchPixelRatio();
    },
    { once: true },
  );
}

function contains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

// The window ignores the mouse outside this rect, so clicks reach whatever is behind it.
const NO_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 };

let sentRect = "";
function syncHitRect(): void {
  // A paused cat lets every click through.
  const rect = paused ? NO_RECT : cat.hitRect();
  const key = `${rect.x},${rect.y},${rect.width},${rect.height}`;
  if (key === sentRect) return;
  sentRect = key;
  void invoke("set_hit_rect", { rect });
}

function render(): void {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  cat.draw(ctx);
}

let last = performance.now();
function tick(): void {
  const now = performance.now();
  if (!paused) {
    cat.update(now - last);
    render();
  }
  last = now;
  syncHitRect();
}

canvas.addEventListener("pointerdown", (event) => {
  if (contains(cat.hitRect(), event.offsetX, event.offsetY)) cat.react();
});

void listen<boolean>("paused", (event) => {
  paused = event.payload;
  cat.setPaused(paused);
});

window.addEventListener("resize", resize);
resize();
watchPixelRatio();
tick();
setInterval(tick, 1000 / FPS);
