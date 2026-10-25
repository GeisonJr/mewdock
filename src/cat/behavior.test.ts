import assert from "node:assert/strict";
import { test } from "node:test";
import { Cat } from "./index.ts";
import { CatBehavior, HALF_CELL_PX, type Behavior } from "./behavior.ts";
import { CELL_HEIGHT, effectPlacements } from "./effects.ts";
import { EFFECTS, FRAMES } from "./sprites.ts";

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

// Reads the property through a call so TypeScript does not keep an earlier narrowing.
function behaviorOf(cat: CatBehavior): Behavior {
  return cat.behavior;
}

const WIDTH = 240;
const HEIGHT = 64;
const STEP = 66;
const REACTIONS: readonly Behavior[] = ["swat", "purr", "stretch", "startle", "mew", "yawn"];

test("stays within bounds, emits known sprites and visits every behavior", () => {
  const cat = new CatBehavior(WIDTH, seeded(7));
  const seen = new Set<Behavior>();
  for (let i = 0; i < 60_000; i++) {
    cat.update(STEP);
    seen.add(cat.behavior);
    assert.ok(cat.x >= HALF_CELL_PX && cat.x <= WIDTH - HALF_CELL_PX, `x ${cat.x}`);
    assert.ok(cat.sprite in FRAMES, cat.sprite);
  }
  for (const b of ["sit", "groom", "stretch", "yawn", "loaf", "walk", "play", "sleep"] as const) {
    assert.ok(seen.has(b), `never ${b}`);
  }
});

test("walking turns around at the edges", () => {
  const cat = new CatBehavior(WIDTH, seeded(3));
  const facings = new Set<number>();
  for (let i = 0; i < 60_000; i++) {
    cat.update(STEP);
    if (cat.behavior === "walk") facings.add(cat.facing);
  }
  assert.equal(facings.size, 2);
});

test("sleep is rare early and long", () => {
  let early = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const cat = new CatBehavior(WIDTH, seeded(seed));
    for (let t = 0; t < 30_000; t += STEP) {
      cat.update(STEP);
      if (cat.behavior === "sleep") {
        early++;
        break;
      }
    }
  }
  assert.ok(early < 10, `${early} of 40 cats slept within 30 s`);
});

test("react interrupts with a reaction and never repeats the previous one", () => {
  const cat = new CatBehavior(WIDTH, seeded(11));
  let last: Behavior | null = null;
  for (let i = 0; i < 400; i++) {
    for (let k = 0; k < i % 40; k++) cat.update(STEP);
    const before = cat.behavior;
    cat.react();
    assert.ok(REACTIONS.includes(cat.behavior), cat.behavior);
    assert.notEqual(cat.behavior, before);
    assert.notEqual(cat.behavior, last);
    last = cat.behavior;
  }
});

test("clicking a sleeping cat wakes it with a stretch or a yawn", () => {
  const cat = new CatBehavior(WIDTH, seeded(5));
  for (let i = 0; i < 200_000 && cat.behavior !== "sleep"; i++) cat.update(STEP);
  assert.equal(cat.behavior, "sleep");
  cat.react();
  const woke = behaviorOf(cat);
  assert.ok(woke === "stretch" || woke === "yawn", woke);
});

test("a paused cat does not move, change frame or change behavior", () => {
  const cat = new CatBehavior(WIDTH, seeded(21));
  for (let i = 0; i < 500; i++) cat.update(STEP);
  while (cat.behavior !== "walk") cat.update(STEP);
  cat.setPaused(true);
  const snapshot = [cat.x, cat.sprite, cat.behavior, cat.elapsed, cat.facing];
  for (let i = 0; i < 2000; i++) cat.update(STEP);
  cat.react();
  assert.deepEqual([cat.x, cat.sprite, cat.behavior, cat.elapsed, cat.facing], snapshot);
  cat.setPaused(false);
  cat.update(STEP);
  assert.notEqual(cat.elapsed, snapshot[3]);
});

test("hitRect stays within the canvas and covers the cat", () => {
  const cat = new Cat(WIDTH, HEIGHT, seeded(9));
  for (let i = 0; i < 30_000; i++) {
    if (i % 97 === 0) cat.react();
    cat.update(STEP);
    const r = cat.hitRect();
    assert.ok(r.x >= 0 && r.y >= 0, JSON.stringify(r));
    assert.ok(r.x + r.width <= WIDTH && r.y + r.height <= HEIGHT, JSON.stringify(r));
    assert.ok(r.width > 8 && r.height > 8, JSON.stringify(r));
  }
});

test("effects stay inside the canvas for both facings", () => {
  for (const width of [100, 240]) {
    for (let seed = 1; seed <= 8; seed++) {
      const cat = new CatBehavior(width, seeded(seed));
      const seen = new Set<string>();
      for (let i = 0; i < 20_000; i++) {
        if (i % 61 === 0) cat.react();
        cat.update(STEP);
        const cx = cat.x;
        for (const fx of effectPlacements(cat, cx, HEIGHT - CELL_HEIGHT, width, HEIGHT)) {
          const frame = EFFECTS[fx.name];
          seen.add(`${fx.name}${cat.facing}`);
          assert.ok(fx.x >= 0 && fx.y >= 0, `${fx.name} ${fx.x},${fx.y}`);
          assert.ok(fx.x + frame[0]!.length * 2 <= width, `${fx.name} right edge ${fx.x}`);
          assert.ok(fx.y + frame.length * 2 <= HEIGHT, `${fx.name} bottom edge ${fx.y}`);
        }
      }
      if (width === 240) assert.ok(seen.has("bubble1") || seen.has("bubble-1"));
    }
  }
});

test("play always faces the side with room", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const cat = new CatBehavior(240, seeded(seed));
    for (let i = 0; i < 20_000; i++) {
      cat.update(STEP);
      if (cat.behavior === "play" && cat.elapsed < STEP) {
        assert.equal(cat.facing, cat.x < 120 ? 1 : -1);
      }
    }
  }
});
