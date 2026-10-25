import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Cat, type Rect } from "./cat/index.ts";

const FPS = 15;

const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const ctx = canvas.getContext("2d")!;
const cat = new Cat(window.innerWidth, window.innerHeight);

function resize(): void {
  const dpr = window.devicePixelRatio;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

function contains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

// The window ignores the mouse outside this rect, so clicks reach whatever is behind it.
let sentRect = "";
function syncHitRect(): void {
  const rect = cat.hitRect();
  const key = `${rect.x},${rect.y},${rect.width},${rect.height}`;
  if (key === sentRect) return;
  sentRect = key;
  void invoke("set_hit_rect", { rect });
}

let last = performance.now();
function tick(): void {
  const now = performance.now();
  cat.update(now - last);
  last = now;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  cat.draw(ctx);
  syncHitRect();
}

canvas.addEventListener("pointerdown", (event) => {
  if (contains(cat.hitRect(), event.offsetX, event.offsetY)) cat.react();
});

void listen<boolean>("paused", (event) => cat.setPaused(event.payload));

window.addEventListener("resize", resize);
resize();
tick();
setInterval(tick, 1000 / FPS);
