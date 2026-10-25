import assert from "node:assert/strict";
import { test } from "node:test";
import { BOUNDS, EFFECTS, FRAMES, FRAME_COLS, FRAME_ROWS, PALETTE, SPRITE_NAMES } from "./sprites.ts";

const known = new Set([".", ...Object.keys(PALETTE)]);

test("every frame has the frame size and only known palette chars", () => {
  for (const name of SPRITE_NAMES) {
    const frame = FRAMES[name];
    assert.equal(frame.length, FRAME_ROWS, `${name} rows`);
    for (const row of frame) {
      assert.equal(row.length, FRAME_COLS, `${name} row width`);
      for (const ch of row) assert.ok(known.has(ch), `${name} has unknown char ${ch}`);
    }
  }
});

test("effects have equal-length rows and known palette chars", () => {
  for (const [name, frame] of Object.entries(EFFECTS)) {
    for (const row of frame) {
      assert.equal(row.length, frame[0]!.length, `${name} row width`);
      for (const ch of row) assert.ok(known.has(ch), `${name} has unknown char ${ch}`);
    }
  }
});

test("every frame draws something and its bounds sit inside the frame", () => {
  for (const name of SPRITE_NAMES) {
    const b = BOUNDS[name];
    assert.ok(b.x1 > b.x0 && b.y1 > b.y0, `${name} is empty`);
    assert.ok(b.x0 >= 0 && b.x1 <= FRAME_COLS && b.y0 >= 0 && b.y1 <= FRAME_ROWS);
  }
});

test("frames touch the bottom row so the cat sits on the screen edge", () => {
  for (const name of SPRITE_NAMES) assert.equal(BOUNDS[name].y1, FRAME_ROWS, name);
});
