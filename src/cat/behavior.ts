import { FRAME_COLS, PIXEL_SCALE, type SpriteName } from "./sprites.ts";

export type Behavior =
  | "sit"
  | "groom"
  | "stretch"
  | "yawn"
  | "loaf"
  | "stand"
  | "walk"
  | "play"
  | "settle"
  | "sleep"
  | "swat"
  | "purr"
  | "startle"
  | "mew";

export type Reaction = "swat" | "purr" | "stretch" | "startle" | "mew";
export type PlayKind = "ball" | "moth";
export type Facing = 1 | -1;

const REACTIONS: readonly Reaction[] = ["swat", "purr", "stretch", "startle", "mew"];
const WAKE_UPS: readonly Behavior[] = ["stretch", "yawn"];

const DURATION_MS: Readonly<Record<Behavior, readonly [min: number, max: number]>> = {
  sit: [2500, 6000],
  groom: [2500, 4500],
  stretch: [2200, 2200],
  yawn: [1800, 1800],
  loaf: [4000, 9000],
  stand: [450, 700],
  walk: [3000, 7000],
  play: [4000, 7000],
  settle: [1400, 1400],
  sleep: [14000, 32000],
  swat: [1500, 2000],
  purr: [2400, 3600],
  startle: [800, 800],
  mew: [1500, 1500],
};

const WALK_SPEED: number = 22;
const WALK_STEP_MS: number = 140;
const MAX_STEP_MS: number = 200;
const BLINK_MS: number = 160;
const FLICK_MS: number = 800;
const SLEEP_WEIGHT_RAMP_MS: number = 80_000;

const WALK_FRAMES: readonly SpriteName[] = ["walk_0", "walk_1", "walk_2", "walk_3"];

type Step = readonly [sprite: SpriteName, ms: number];

const BALL_CYCLE: readonly Step[] = [
  ["swat_a", 250],
  ["swat_b", 150],
  ["sit", 400],
];
const MOTH_CYCLE: readonly Step[] = [
  ["sit", 500],
  ["swat_a", 200],
  ["swat_b", 150],
  ["sit", 300],
];
const SWAT_CYCLE: readonly Step[] = [
  ["swat_a", 160],
  ["swat_b", 160],
];
const MEW_CYCLE: readonly Step[] = [
  ["mew", 300],
  ["sit", 150],
];
const SETTLE_CYCLE: readonly Step[] = [
  ["loaf", 700],
  ["loaf_blink", 700],
];
const SLEEP_CYCLE: readonly Step[] = [
  ["sleep_a", 1100],
  ["sleep_b", 1100],
];
const GROOM_CYCLE: readonly Step[] = [
  ["groom_a", 280],
  ["groom_b", 280],
];

function cycle(steps: readonly Step[], elapsed: number): SpriteName {
  let total = 0;
  for (const step of steps) total += step[1];
  let t = elapsed % total;
  for (const step of steps) {
    if (t < step[1]) return step[0];
    t -= step[1];
  }
  return steps[0]![0];
}

export const HALF_CELL_PX: number = (FRAME_COLS * PIXEL_SCALE) / 2;
const HOP_PX: number = 10;

export class CatBehavior {
  readonly #width: number;
  readonly #random: () => number;
  readonly #minX: number;
  readonly #maxX: number;

  #paused = false;
  #behavior: Behavior = "sit";
  #elapsed = 0;
  #duration = 0;
  #x: number;
  #facing: Facing = 1;
  #playKind: PlayKind = "ball";
  #pending: Behavior | null = null;
  #lastReaction: Behavior | null = null;
  #awakeMs = 0;
  #blinkIn = 0;
  #blinkLeft = 0;
  #flickIn = 0;
  #flickLeft = 0;
  #sprite: SpriteName = "sit";

  constructor(width: number, random: () => number = Math.random) {
    this.#width = width;
    this.#random = random;
    this.#minX = Math.min(HALF_CELL_PX, width / 2);
    this.#maxX = Math.max(width - HALF_CELL_PX, width / 2);
    this.#x = Math.min(Math.max(width * 0.75, this.#minX), this.#maxX);
    this.#start("sit");
  }

  get behavior(): Behavior {
    return this.#behavior;
  }

  get sprite(): SpriteName {
    return this.#sprite;
  }

  get x(): number {
    return this.#x;
  }

  get facing(): Facing {
    return this.#facing;
  }

  get elapsed(): number {
    return this.#elapsed;
  }

  get playKind(): PlayKind {
    return this.#playKind;
  }

  get paused(): boolean {
    return this.#paused;
  }

  // Vertical lift in CSS px for the startle hop.
  get hopOffset(): number {
    if (this.#behavior !== "startle") return 0;
    const p = Math.min(this.#elapsed / this.#duration, 1);
    return Math.round(HOP_PX * 4 * p * (1 - p));
  }

  // Horizontal shake in CSS px while purring.
  get shakeOffset(): number {
    if (this.#behavior !== "purr") return 0;
    return Math.floor(this.#elapsed / 66) % 2 === 0 ? 0 : 1;
  }

  setPaused(paused: boolean): void {
    this.#paused = paused;
  }

  /** Returns the reaction it started, or null while paused. */
  react(): Behavior | null {
    if (this.#paused) return null;
    const asleep = this.#behavior === "sleep" || this.#behavior === "settle";
    const pool: readonly Behavior[] = asleep ? WAKE_UPS : REACTIONS;
    const options = pool.filter((b) => b !== this.#lastReaction && b !== this.#behavior);
    const choice = options[Math.floor(this.#random() * options.length)]!;
    this.#lastReaction = choice;
    this.#pending = null;
    if (asleep) this.#awakeMs = 0;
    this.#start(choice);
    return choice;
  }

  update(dtMs: number): void {
    if (this.#paused) return;
    const dt = Math.min(Math.max(dtMs, 0), MAX_STEP_MS);
    this.#elapsed += dt;
    if (this.#behavior !== "sleep" && this.#behavior !== "settle") this.#awakeMs += dt;

    if (this.#behavior === "walk") this.#walk(dt);
    if (this.#behavior === "sit" || this.#behavior === "loaf") this.#tickIdleTimers(dt);

    if (this.#elapsed >= this.#duration) this.#finish();
    else this.#sprite = this.#pickSprite();
  }

  #walk(dt: number): void {
    this.#x += this.#facing * WALK_SPEED * (dt / 1000);
    if (this.#x <= this.#minX) {
      this.#x = this.#minX;
      this.#facing = 1;
    } else if (this.#x >= this.#maxX) {
      this.#x = this.#maxX;
      this.#facing = -1;
    }
  }

  #tickIdleTimers(dt: number): void {
    if (this.#blinkLeft > 0) this.#blinkLeft -= dt;
    else {
      this.#blinkIn -= dt;
      if (this.#blinkIn <= 0) {
        this.#blinkLeft = BLINK_MS;
        this.#blinkIn = 1500 + this.#random() * 2500;
      }
    }
    if (this.#behavior !== "sit") return;
    if (this.#flickLeft > 0) this.#flickLeft -= dt;
    else {
      this.#flickIn -= dt;
      if (this.#flickIn <= 0) {
        this.#flickLeft = FLICK_MS;
        this.#flickIn = 2500 + this.#random() * 3500;
      }
    }
  }

  #pickSprite(): SpriteName {
    const e = this.#elapsed;
    switch (this.#behavior) {
      case "sit": {
        if (this.#flickLeft > 0) {
          const t = FLICK_MS - this.#flickLeft;
          return t < 160 || t > FLICK_MS - 160 ? "sit_tail_mid" : "sit_tail_up";
        }
        return this.#blinkLeft > 0 ? "sit_blink" : "sit";
      }
      case "loaf":
        return this.#blinkLeft > 0 ? "loaf_blink" : "loaf";
      case "groom":
        return cycle(GROOM_CYCLE, e);
      case "stretch":
        return e < 350 || e > this.#duration - 350 ? "stand" : "stretch";
      case "yawn":
        if (e < 300 || e > this.#duration - 300) return "yawn_a";
        return "yawn_b";
      case "stand":
        return "stand";
      case "walk":
        return WALK_FRAMES[Math.floor(e / WALK_STEP_MS) % WALK_FRAMES.length]!;
      case "play":
        return cycle(this.#playKind === "ball" ? BALL_CYCLE : MOTH_CYCLE, e);
      case "settle":
        return cycle(SETTLE_CYCLE, e);
      case "sleep":
        return cycle(SLEEP_CYCLE, e);
      case "swat":
        return cycle(SWAT_CYCLE, e);
      case "purr":
        return "purr";
      case "startle":
        return "startle";
      case "mew":
        return cycle(MEW_CYCLE, e);
    }
  }

  #finish(): void {
    const b = this.#behavior;
    if (this.#pending !== null) {
      const next = this.#pending;
      this.#pending = null;
      this.#start(next);
    } else if (b === "walk") {
      this.#pending = "sit";
      this.#start("stand");
    } else if (b === "sleep") {
      this.#awakeMs = 0;
      this.#start(WAKE_UPS[Math.floor(this.#random() * WAKE_UPS.length)]!);
    } else if (b === "stand" || b === "swat" || b === "purr" || b === "startle" || b === "mew") {
      this.#start("sit");
    } else {
      this.#chooseNext(b);
    }
  }

  #chooseNext(previous: Behavior): void {
    const sleepWeight = 0.15 + 1.35 * Math.min(this.#awakeMs / SLEEP_WEIGHT_RAMP_MS, 1);
    const options: readonly (readonly [Behavior, number])[] = [
      ["sit", previous === "sit" ? 0 : 3],
      ["groom", 3],
      ["stretch", 1.5],
      ["yawn", 1.5],
      ["loaf", 2],
      ["walk", 4],
      ["play", 2],
      ["sleep", sleepWeight],
    ];
    let total = 0;
    for (const [b, w] of options) total += b === previous ? 0 : w;
    let roll = this.#random() * total;
    let chosen: Behavior = "sit";
    for (const [b, w] of options) {
      const weight = b === previous ? 0 : w;
      if (weight === 0) continue;
      chosen = b;
      if (roll < weight) break;
      roll -= weight;
    }
    if (chosen === "walk") {
      this.#pending = "walk";
      this.#start("stand");
    } else if (chosen === "sleep") {
      this.#pending = "sleep";
      this.#start("settle");
    } else {
      this.#start(chosen);
    }
  }

  #start(behavior: Behavior): void {
    this.#behavior = behavior;
    this.#elapsed = 0;
    const [min, max] = DURATION_MS[behavior];
    this.#duration = min + this.#random() * (max - min);

    if (behavior === "stand" && this.#pending === "walk") this.#facing = this.#roomyDirection();
    if (behavior === "play") {
      this.#playKind = this.#random() < 0.5 ? "ball" : "moth";
      this.#facing = this.#x < this.#width / 2 ? 1 : -1;
    }
    if (behavior === "sit" || behavior === "loaf") {
      this.#blinkIn = 800 + this.#random() * 2500;
      this.#blinkLeft = 0;
      this.#flickIn = 1500 + this.#random() * 3000;
      this.#flickLeft = 0;
    }
    this.#sprite = this.#pickSprite();
  }

  // Mostly head for the side with more room, so walks and the ball stay on screen.
  #roomyDirection(): Facing {
    const roomyRight = this.#x < this.#width / 2;
    const towardRoom = this.#random() < 0.7;
    return roomyRight === towardRoom ? 1 : -1;
  }
}
