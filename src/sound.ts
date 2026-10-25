import type { Behavior } from "./cat/index.ts";

const VOLUME = 0.35;

type Contour = readonly (readonly [seconds: number, value: number])[];

let audio: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

function output(ctx: AudioContext): GainNode {
  if (master === null) {
    master = ctx.createGain();
    master.gain.value = VOLUME;
    master.connect(ctx.destination);
  }
  return master;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise === null) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function follow(param: AudioParam, start: number, contour: Contour): void {
  const [first, ...rest] = contour;
  if (first === undefined) return;
  param.setValueAtTime(first[1], start + first[0]);
  for (const [at, value] of rest) param.exponentialRampToValueAtTime(value, start + at);
}

function envelope(ctx: AudioContext, start: number, attack: number, length: number, peak: number): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  gain.gain.setValueAtTime(peak, start + length * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  return gain;
}

// A meow-like voice: a buzzy tone whose pitch and "mouth" (lowpass cutoff) follow contours.
function voice(
  ctx: AudioContext,
  start: number,
  length: number,
  pitch: Contour,
  mouth: Contour,
  peak: number,
  trillHz = 0,
): void {
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  follow(osc.frequency, start, pitch);

  const vibrato = ctx.createOscillator();
  const vibratoDepth = ctx.createGain();
  vibrato.frequency.value = 6;
  vibratoDepth.gain.value = 12;
  vibrato.connect(vibratoDepth).connect(osc.frequency);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 7;
  follow(filter.frequency, start, mouth);

  const env = envelope(ctx, start, 0.04, length, peak);
  osc.connect(filter).connect(env);

  if (trillHz > 0) {
    const trill = ctx.createGain();
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    trill.gain.value = 0.6;
    lfo.frequency.value = trillHz;
    depth.gain.value = 0.4;
    lfo.connect(depth).connect(trill.gain);
    env.connect(trill).connect(output(ctx));
    lfo.start(start);
    lfo.stop(start + length);
  } else {
    env.connect(output(ctx));
  }

  for (const node of [osc, vibrato]) {
    node.start(start);
    node.stop(start + length);
  }
}

function whoosh(ctx: AudioContext, start: number, length: number, peak: number): void {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.5;
  follow(filter.frequency, start, [
    [0, 2800],
    [length, 700],
  ]);
  source.connect(filter).connect(envelope(ctx, start, 0.015, length, peak)).connect(output(ctx));
  source.start(start);
  source.stop(start + length);
}

// Purring is a low rumble pulsed about 25 times a second, louder while breathing in.
function purr(ctx: AudioContext, start: number, length: number): void {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 280;

  const pulse = ctx.createGain();
  pulse.gain.value = 0.5;
  const rate = ctx.createOscillator();
  rate.type = "square";
  rate.frequency.value = 25;
  const depth = ctx.createGain();
  depth.gain.value = 0.5;
  rate.connect(depth).connect(pulse.gain);

  const breath = ctx.createGain();
  breath.gain.value = 0.75;
  const breathing = ctx.createOscillator();
  breathing.frequency.value = 0.8;
  const breathDepth = ctx.createGain();
  breathDepth.gain.value = 0.25;
  breathing.connect(breathDepth).connect(breath.gain);

  source
    .connect(filter)
    .connect(pulse)
    .connect(breath)
    .connect(envelope(ctx, start, 0.3, length, 1.4))
    .connect(output(ctx));
  for (const node of [source, rate, breathing]) {
    node.start(start);
    node.stop(start + length);
  }
}

/** Plays the sound for a click reaction; behaviors without a sound are ignored. */
export function playReaction(reaction: Behavior): void {
  audio ??= new AudioContext();
  const ctx = audio;
  if (ctx.state === "suspended") void ctx.resume();
  const t = ctx.currentTime + 0.02;

  switch (reaction) {
    case "mew":
      voice(ctx, t, 0.42, [[0, 560], [0.1, 900], [0.25, 820], [0.42, 520]], [[0, 500], [0.12, 2600], [0.42, 700]], 0.5);
      break;
    case "purr":
      purr(ctx, t, 2.8);
      break;
    case "swat":
      for (let i = 0; i < 3; i++) whoosh(ctx, t + i * 0.32, 0.12, 0.6);
      break;
    case "startle":
      voice(ctx, t, 0.14, [[0, 650], [0.08, 1350], [0.14, 1100]], [[0, 1500], [0.14, 3000]], 0.45);
      break;
    case "stretch":
      voice(ctx, t + 0.3, 0.8, [[0, 320], [0.3, 430], [0.8, 290]], [[0, 600], [0.3, 1400], [0.8, 500]], 0.4, 28);
      break;
    case "yawn":
      voice(ctx, t + 0.2, 0.95, [[0, 620], [0.3, 520], [0.95, 260]], [[0, 900], [0.3, 2200], [0.95, 400]], 0.35);
      break;
    default:
      break;
  }
}
