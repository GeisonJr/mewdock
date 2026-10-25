export type Frame = readonly string[];

export const PIXEL_SCALE: number = 2;
export const FRAME_COLS: number = 32;
export const FRAME_ROWS: number = 28;

export const PALETTE: Readonly<Record<string, string>> = {
  o: "#3a2218",
  b: "#f2a24f",
  s: "#c76a2a",
  w: "#fff3df",
  p: "#f48fa8",
  e: "#24150f",
  r: "#e8445f",
  u: "#6f9bec",
  y: "#ffd447",
};

export type SpriteName =
  | "sit"
  | "sit_blink"
  | "sit_tail_mid"
  | "sit_tail_up"
  | "groom_a"
  | "groom_b"
  | "stand"
  | "walk_0"
  | "walk_1"
  | "walk_2"
  | "walk_3"
  | "stretch"
  | "yawn_a"
  | "yawn_b"
  | "loaf"
  | "loaf_blink"
  | "swat_a"
  | "swat_b"
  | "sleep_a"
  | "sleep_b"
  | "purr"
  | "startle"
  | "mew";

interface Layer {
  rows: readonly string[];
  x: number;
  y: number;
}

type Edit = readonly [row: number, col: number, text: string];

function blank(): string[][] {
  return Array.from({ length: FRAME_ROWS }, () => Array<string>(FRAME_COLS).fill("."));
}

// Later layers overwrite earlier ones wherever they are not transparent.
function compose(layers: readonly Layer[], outline = false): Frame {
  const grid = blank();
  for (const layer of layers) {
    layer.rows.forEach((text, r) => {
      for (let c = 0; c < text.length; c++) {
        const ch = text[c];
        const row = grid[layer.y + r];
        if (ch !== "." && row !== undefined && layer.x + c < FRAME_COLS) row[layer.x + c] = ch;
      }
    });
  }
  if (outline) addOutline(grid);
  return grid.map((row) => row.join(""));
}

// Shapes drawn without a border get a one pixel dark outline on their transparent neighbors.
function addOutline(grid: string[][]): void {
  const filled = grid.map((row) => row.map((ch) => ch !== "."));
  for (let r = 0; r < FRAME_ROWS; r++) {
    for (let c = 0; c < FRAME_COLS; c++) {
      if (filled[r]![c]) continue;
      const near =
        filled[r - 1]?.[c] === true ||
        filled[r + 1]?.[c] === true ||
        filled[r]![c - 1] === true ||
        filled[r]![c + 1] === true;
      if (near) grid[r]![c] = "o";
    }
  }
}

function patch(rows: Frame, edits: readonly Edit[]): Frame {
  const out = [...rows];
  for (const [row, col, text] of edits) {
    const line = out[row];
    if (line === undefined) throw new Error(`patch row ${row} out of range`);
    out[row] = line.slice(0, col) + text + line.slice(col + text.length);
  }
  return out;
}

function line(...segments: readonly (readonly [col: number, text: string])[]): string {
  const cells = Array<string>(FRAME_COLS).fill(".");
  for (const [col, text] of segments) {
    for (let i = 0; i < text.length; i++) cells[col + i] = text[i]!;
  }
  return cells.join("");
}

const HEAD: Frame = [
  ".oo..........oo.",
  "oppo........oppo",
  "opppoooooooopppo",
  "obbbsbbssbbsbbbo",
  "obbbbbbssbbbbbbo",
  "obbbwebbbbwebbbo",
  "obbbeebbbbeebbbo",
  "osbbeebbbbeebbso",
  "obbbbwwppwwbbbbo",
  "obbbbwwwwwwbbbbo",
  ".obbbbwwwwbbbbo.",
  "..oooooooooooo..",
];

const CLOSED_EYES: readonly Edit[] = [
  [5, 4, "bb"],
  [6, 4, "oo"],
  [7, 4, "bb"],
  [5, 10, "bb"],
  [6, 10, "oo"],
  [7, 10, "bb"],
];

const HEAD_BLINK = patch(HEAD, CLOSED_EYES);
const HEAD_HAPPY = patch(HEAD, [
  [5, 3, "bob"],
  [6, 3, "obo"],
  [7, 3, "bbb"],
  [5, 10, "bob"],
  [6, 10, "obo"],
  [7, 10, "bbb"],
]);
const HEAD_STARTLE = patch(HEAD, [
  [5, 3, "wee"],
  [6, 3, "eee"],
  [7, 3, "eee"],
  [5, 10, "eew"],
  [6, 10, "eee"],
  [7, 10, "eee"],
  [9, 7, "oo"],
]);
const HEAD_YAWN_A = patch(HEAD_BLINK, [[9, 7, "oo"]]);
const HEAD_YAWN_B = patch(HEAD_BLINK, [
  [9, 6, "oooo"],
  [10, 6, "oppo"],
]);
const HEAD_MEW = patch(HEAD, [
  [9, 6, "owwo"],
  [10, 7, "oo"],
]);
const HEAD_LICK = patch(HEAD_BLINK, [[9, 9, "p"]]);

const BODY: Frame = [
  "...obbbwwwwbbbo...",
  "..obbbbwwwwbbbbo..",
  ".obbbbbwwwwbbbbbo.",
  "obsbbbbwwwwbbbbsbo",
  ...Array<string>(5).fill("obsbobbboobbbobsbo"),
  ...Array<string>(4).fill("obbbowwwoowwwobbbo"),
  "oooooooooooooooooo",
];

const BODY_ARM_UP: Frame = BODY.map((row, i) => {
  if (i >= 4 && i <= 8) return "obsbobbbbbbbbbbsbo";
  if (i >= 9 && i <= 12) return "obbbowwwbbbbbbbbbo";
  return row;
});

const TAIL_REST: Frame = ["....oo.", "oooobbo", "bbsbbbo", "bsbbbbo", "ooooooo"];
const TAIL_MID: Frame = ["..oo..", ".obbo.", ".obbo.", "osbbo.", "obbo..", "osbo..", "obbo..", "obbo..", "oooo.."];
const TAIL_UP: Frame = [
  "..oo..",
  ".obbo.",
  ".obbo.",
  ".osbo.",
  ".obbo.",
  ".obbo.",
  ".osbo.",
  ".obbo.",
  "obbo..",
  "obbo..",
  "osbo..",
  "obbo..",
  "obbo..",
  "oooo..",
];

function sitting(head: Frame, tail: { rows: Frame; y: number }, body: Frame = BODY): Layer[] {
  return [
    { rows: tail.rows, x: 25, y: tail.y },
    { rows: body, x: 7, y: 14 },
    { rows: head, x: 8, y: 2 },
  ];
}

const TAIL_AT_REST = { rows: TAIL_REST, y: 23 };
const TAIL_AT_MID = { rows: TAIL_MID, y: 19 };
const TAIL_AT_UP = { rows: TAIL_UP, y: 14 };

const ARM_RAISED: Frame = [
  "owwo",
  "owwo",
  "obbo",
  "obbo",
  "obbo",
  "obbo",
  "obbo",
  "obbo",
  "obbo",
];
const ARM_SWAT_HIGH: Frame = [
  "owwo..",
  "owwo..",
  "obbo..",
  "obbo..",
  "obbo..",
  "obbo..",
  "obbo..",
  "obbo..",
  "obbo..",
  "obbo..",
  "obbo..",
  "obbo..",
];
const ARM_SWAT_OUT: Frame = [
  "....owwo",
  "....owwo",
  "...obbo.",
  "..obbo..",
  "..obbo..",
  ".obbo...",
  ".obbo...",
  "obbo....",
];

// Fill shapes below get an automatic outline.
const SIDE_HEAD: Frame = [
  ".b.....b.....",
  ".bb...bpb....",
  "bbbbbbbbbb...",
  "bbsbsbbbbbb..",
  "bbbbbbbbwebb.",
  "bbbbbbbbeebbb",
  "sbbbbbbbbbwwp",
  ".bbbbbbbwwww.",
  "..bbbbwwww...",
];
const SIDE_BODY: Frame = [
  "...bbbbbbbbbbbb...",
  ".bbbsbbbsbbbsbbbb.",
  "bbbbsbbbsbbbsbbbbb",
  "bbbbbsbbbsbbbsbbbb",
  "bbbbbbbbbbbbbbbbbb",
  "bbbbbbbbbbbbbbbbww",
  ".bbbbbbbbbbbbbbww.",
  "..bbbbbbbbbbbbbb..",
];
const SIDE_TAIL: Frame = [".bb..", "bb...", "bb...", "sb...", "bb...", ".bb..", ".bbb.", "..bbb"];

type LegPose = "down" | "forward" | "back" | "lift";

// Shapes for a leg whose hip is at column 0, drawn from the hip down to the ground.
const LEG_POSES: Readonly<Record<LegPose, { rows: Frame; dx: number }>> = {
  down: { rows: ["bb", "bb", "bb", "bb", "bb", "ww"], dx: 0 },
  forward: { rows: ["bb..", "bb..", ".bb.", ".bb.", "..bb", "..ww"], dx: 0 },
  back: { rows: ["..bb", "..bb", ".bb.", ".bb.", "bb..", "ww.."], dx: -2 },
  lift: { rows: [".bb", ".bb", "bb.", "ww."], dx: -1 },
};

// Diagonal pairs move together: near front with far back, far front with near back.
const GAIT: readonly LegPose[] = ["forward", "down", "back", "lift"];

interface Leg {
  col: number;
  far: boolean;
  pose: LegPose;
}

function legLayer(leg: Leg): Layer {
  const { rows, dx } = LEG_POSES[leg.pose];
  const fill = leg.far ? "s" : "b";
  return { rows: rows.map((row) => row.replaceAll("b", fill)), x: leg.col + dx, y: 21 };
}

function sideCat(step: number | null): Frame {
  const pose = (offset: number): LegPose => (step === null ? "down" : GAIT[(step + offset) % 4]!);
  const legs: Leg[] = [
    { col: 8, far: true, pose: pose(0) },
    { col: 18, far: true, pose: pose(2) },
    { col: 5, far: false, pose: pose(2) },
    { col: 15, far: false, pose: pose(0) },
  ];
  return compose(
    [
      { rows: SIDE_TAIL, x: 1, y: 6 },
      ...legs.map(legLayer),
      { rows: SIDE_BODY, x: 4, y: 13 },
      { rows: SIDE_HEAD, x: 18, y: 6 },
    ],
    true,
  );
}

const STRETCH: Frame = compose(
  [
    {
      rows: [
        line([2, "bb"]),
        line([2, "bb"]),
        line([2, "sb"]),
        line([2, "bb"]),
        line([2, "bsbb"]),
        line([3, "bbsbbbb"]),
        line([3, "bbbsbbbbb"]),
        line([3, "bbsbbbsbbbb"]),
        line([3, "bbbbsbbbbbsbb"], [21, ".b......b."]),
        line([3, "bbsbbbbbsbbbbbb"], [21, "bpb....bpb"]),
        line([3, "bbbsbbbbbbsbbbbbb"], [21, "bbbbbbbbbb"]),
        line([3, "bbbbbsbbbbbbbsbbbbb"], [21, "bbbeebbeeb"]),
        line([3, "bbsbbbwwwwwwwbbbbbbb"], [21, "bbbbbbwwwp"]),
        line([4, "bsbbb"], [11, "bbbbbbbbbbb"], [21, "bbbbbbwwww"]),
        line([4, "bbbbb"], [11, "bbbbbbbbbbbbbbbb"]),
        line([4, "bbsbb"], [11, "bbbbbbbbbbbbbbbbbbb"]),
        line([4, "bbbbb"], [11, "bbbbbbbbbbbbbbbbbwwww"]),
        line([4, "wwwww"]),
      ],
      x: -1,
      y: 9,
    },
  ],
  true,
);

// Curled up with the head on the paws and the tail wrapped around the front.
const SLEEP_ROWS: Frame = [
  "............bbbbbbb.....",
  "..........bbbbsbbbsbbb..",
  ".b....b..bbbsbbbsbbbsbb.",
  "bpb..bpbobbbbsbbbsbbbsbb",
  "bbbbbbbbobbbbbsbbbsbbbsb",
  "bbbbbbbbosbbbbbsbbbsbbbb",
  "boobboobobsbbbbbsbbbbbbb",
  "bbbbpbbbobbsbbbbbbbbbbbb",
  "sbwwwwbbobbbbbbbbbbbbbbs",
  "owwwwwwoooooooooooooobbb",
  "wwbbsbbbsbbbsbbbsbbbbbb.",
  ".bbbbbbbbbbbbbbbbbbbbb..",
];
const SLEEP_BREATH: Frame = ["...bbbbb...", "bbbbbbbbbbb"];

const LOAF_BODY: Frame = [
  "..oobbbbbbbbbboo..",
  ".obbbsbbbbbbsbbbo.",
  "obbsbbbbwwbbbbsbbo",
  "obbbbbbwwwwbbbbbbo",
  "obsbbbbwwwwbbbsbbo",
  "obbbsbbbwwbbsbbbbo",
  "obbbbbbbbbbbbbbbbo",
  "obbbwwwbbbbwwwbbbo",
  ".oooooooooooooooo.",
];

const TAIL_LOAF: Frame = [".oo..", "obbo.", "obbso", "obbbo", "obbo.", "ooo.."];

function loaf(head: Frame): Frame {
  return compose([
    { rows: TAIL_LOAF, x: 24, y: 22 },
    { rows: LOAF_BODY, x: 7, y: 19 },
    { rows: head, x: 8, y: 9 },
  ]);
}

function build(): Record<SpriteName, Frame> {
  const sitFrame = (head: Frame, tail = TAIL_AT_REST, body = BODY): Frame =>
    compose(sitting(head, tail, body));
  const arm = (head: Frame, rows: Frame, x: number, y: number): Frame =>
    compose([...sitting(head, TAIL_AT_REST, BODY_ARM_UP), { rows, x, y }]);

  return {
    sit: sitFrame(HEAD),
    sit_blink: sitFrame(HEAD_BLINK),
    sit_tail_mid: sitFrame(HEAD, TAIL_AT_MID),
    sit_tail_up: sitFrame(HEAD, TAIL_AT_UP),
    groom_a: arm(HEAD_BLINK, ARM_RAISED, 19, 9),
    groom_b: arm(HEAD_LICK, ARM_RAISED, 19, 8),
    stand: sideCat(null),
    walk_0: sideCat(0),
    walk_1: sideCat(1),
    walk_2: sideCat(2),
    walk_3: sideCat(3),
    stretch: STRETCH,
    yawn_a: sitFrame(HEAD_YAWN_A),
    yawn_b: sitFrame(HEAD_YAWN_B),
    loaf: loaf(HEAD),
    loaf_blink: loaf(HEAD_BLINK),
    swat_a: arm(HEAD, ARM_SWAT_HIGH, 24, 6),
    swat_b: arm(HEAD, ARM_SWAT_OUT, 24, 10),
    sleep_a: compose([{ rows: SLEEP_ROWS, x: 4, y: 15 }], true),
    sleep_b: compose(
      [
        { rows: SLEEP_BREATH, x: 13, y: 14 },
        { rows: SLEEP_ROWS, x: 4, y: 15 },
      ],
      true,
    ),
    purr: sitFrame(HEAD_HAPPY),
    startle: sitFrame(HEAD_STARTLE, TAIL_AT_UP),
    mew: sitFrame(HEAD_MEW),
  };
}

export const FRAMES: Readonly<Record<SpriteName, Frame>> = build();

export const SPRITE_NAMES: readonly SpriteName[] = [
  "sit",
  "sit_blink",
  "sit_tail_mid",
  "sit_tail_up",
  "groom_a",
  "groom_b",
  "stand",
  "walk_0",
  "walk_1",
  "walk_2",
  "walk_3",
  "stretch",
  "yawn_a",
  "yawn_b",
  "loaf",
  "loaf_blink",
  "swat_a",
  "swat_b",
  "sleep_a",
  "sleep_b",
  "purr",
  "startle",
  "mew",
];

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// Tight box of the non-transparent pixels, x1 and y1 exclusive.
export function boundsOf(frame: Frame): Bounds {
  let x0 = FRAME_COLS;
  let y0 = FRAME_ROWS;
  let x1 = 0;
  let y1 = 0;
  frame.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] === ".") continue;
      x0 = Math.min(x0, c);
      x1 = Math.max(x1, c + 1);
      y0 = Math.min(y0, r);
      y1 = Math.max(y1, r + 1);
    }
  });
  return { x0, y0, x1, y1 };
}

export const BOUNDS: Readonly<Record<SpriteName, Bounds>> = {
  sit: boundsOf(FRAMES.sit),
  sit_blink: boundsOf(FRAMES.sit_blink),
  sit_tail_mid: boundsOf(FRAMES.sit_tail_mid),
  sit_tail_up: boundsOf(FRAMES.sit_tail_up),
  groom_a: boundsOf(FRAMES.groom_a),
  groom_b: boundsOf(FRAMES.groom_b),
  stand: boundsOf(FRAMES.stand),
  walk_0: boundsOf(FRAMES.walk_0),
  walk_1: boundsOf(FRAMES.walk_1),
  walk_2: boundsOf(FRAMES.walk_2),
  walk_3: boundsOf(FRAMES.walk_3),
  stretch: boundsOf(FRAMES.stretch),
  yawn_a: boundsOf(FRAMES.yawn_a),
  yawn_b: boundsOf(FRAMES.yawn_b),
  loaf: boundsOf(FRAMES.loaf),
  loaf_blink: boundsOf(FRAMES.loaf_blink),
  swat_a: boundsOf(FRAMES.swat_a),
  swat_b: boundsOf(FRAMES.swat_b),
  sleep_a: boundsOf(FRAMES.sleep_a),
  sleep_b: boundsOf(FRAMES.sleep_b),
  purr: boundsOf(FRAMES.purr),
  startle: boundsOf(FRAMES.startle),
  mew: boundsOf(FRAMES.mew),
};

export type EffectName = "heart" | "z" | "ball" | "wings_open" | "wings_closed" | "bubble";

export const EFFECTS: Readonly<Record<EffectName, Frame>> = {
  heart: [".r.r.", "rrrrr", ".rrr.", "..r.."],
  z: ["uuuu", "..u.", ".u..", "uuuu"],
  ball: [".oooo.", "orrrro", "orwrro", "orrrro", "orrrro", ".oooo."],
  wings_open: ["oo...oo", "oyyoyyo", "oyyoyyo", ".oo.oo."],
  wings_closed: ["...o...", "..oyo..", "..oyo..", "...o..."],
  bubble: [
    ".ooooooooo.",
    "owwwwwwwwwo",
    "owwowowowwo",
    ".owwwwwwwo.",
    "..oooowoo..",
    "......oo...",
  ],
};
