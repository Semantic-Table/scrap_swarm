/**
 * Audio.ts — Procedural sound engine for Scrap Swarm
 *
 * All sounds are synthesized via Tone.js — zero audio files.
 *
 * Design palette:
 *   - Dark metal / industrial / warm sparks aesthetic
 *   - Pentatonic scale for pickup chimes (always pleasant)
 *   - Gameplay sounds stay under 200ms so they never lag action
 *   - Layered simple voices rather than one complex synth
 *   - Very low-volume ambient hum to fill silence
 *
 * Usage: call initAudio() inside the first user gesture handler,
 * then call the play* functions freely from any system or combat callback.
 */

import * as Tone from "tone";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _initialized = false;
let _masterVol: Tone.Volume | null = null;
let _masterLimiter: Tone.Limiter | null = null;
let _ambience: Tone.Oscillator | null = null;
let _ambienceGain: Tone.Gain | null = null;
let _ambienceLfo: Tone.LFO | null = null;

/** Combo counter for scrap pickup — resets when a pickup hasn't fired in 0.5s */
let _pickupCombo = 0;
let _pickupComboResetTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Active-sound concurrency counters — prevent AudioContext saturation in late game.
 * Each play* function that runs frequently decrements its counter in the dispose callback.
 */
const _activeSounds = {
  kill: 0,
  slash: 0,
  tesla: 0,
  pulse: 0,
  pickup: 0,
};

/** Maximum simultaneous voices per sound type. */
const MAX_CONCURRENT: Record<keyof typeof _activeSounds, number> = {
  kill:   6,
  slash:  3,
  tesla:  4,
  pulse:  2,
  pickup: 4,
};

// Pentatonic scale notes (C4 pentatonic major) in semitones above C4.
// All 12 notes map cleanly — add octave jumps for higher combos.
const PENTATONIC_SEMITONES = [0, 2, 4, 7, 9]; // C D E G A

function pentatonicFreq(step: number): number {
  // step 0 = C4, wraps through scale, climbs octaves
  const oct = Math.floor(step / PENTATONIC_SEMITONES.length);
  const idx = step % PENTATONIC_SEMITONES.length;
  const semitone = PENTATONIC_SEMITONES[idx] + oct * 12;
  // C4 = MIDI 60, frequency formula: 440 * 2^((midi-69)/12)
  return 440 * Math.pow(2, (60 + semitone - 69) / 12);
}

// ---------------------------------------------------------------------------
// Init / teardown
// ---------------------------------------------------------------------------

/**
 * Must be called inside a user gesture (pointerdown / keydown).
 * Safe to call multiple times — only the first call does real work.
 */
export async function initAudio(): Promise<void> {
  if (_initialized) return;

  await Tone.start();
  Tone.getContext().lookAhead = 0.01; // tighten latency for gameplay sounds

  // Limiter sits right before the destination — hard ceiling prevents clipping
  // when many sounds overlap in late game. -2 dBFS gives a tiny headroom margin.
  _masterLimiter = new Tone.Limiter(-2).toDestination();

  // Master volume bus — all synths route here, then through the limiter
  _masterVol = new Tone.Volume(-6).connect(_masterLimiter);

  // Start background ambience
  _startAmbience();

  _initialized = true;
}

/** Dispose every Tone node and reset state. Call on game restart. */
export function disposeAudio(): void {
  _stopAmbience();

  if (_masterVol) {
    _masterVol.dispose();
    _masterVol = null;
  }

  if (_masterLimiter) {
    _masterLimiter.dispose();
    _masterLimiter = null;
  }

  _initialized = false;
  _currentIntensity = 1;
  _pickupCombo = 0;
  if (_pickupComboResetTimer !== null) {
    clearTimeout(_pickupComboResetTimer);
    _pickupComboResetTimer = null;
  }

  // Reset concurrency counters so a restart starts clean
  _activeSounds.kill = 0;
  _activeSounds.slash = 0;
  _activeSounds.tesla = 0;
  _activeSounds.pulse = 0;
  _activeSounds.pickup = 0;
}

/** Suspend/resume Tone Transport and AudioContext — use on tab-hide / pause screen. */
export function suspendAudio(): void {
  if (!_initialized) return;
  // Cast to AudioContext (not OfflineAudioContext) — suspend() takes no args on the live context.
  void (Tone.getContext().rawContext as AudioContext).suspend();
}

export function resumeAudio(): void {
  if (!_initialized) return;
  void (Tone.getContext().rawContext as AudioContext).resume();
}

/**
 * Master volume. 0 = silence, 1 = full (internally mapped to dB).
 * Clamped to [0, 1].
 */
export function setMasterVolume(linear: number): void {
  if (!_masterVol) return;
  const clamped = Math.max(0, Math.min(1, linear));
  // Map 0–1 to -60 dB – 0 dB (log scale feels natural for a volume knob)
  _masterVol.volume.value = clamped === 0 ? -Infinity : 20 * Math.log10(clamped);
}

// ---------------------------------------------------------------------------
// Helper — safe master connection
// ---------------------------------------------------------------------------

function masterOut(): Tone.Volume {
  // Fallback to destination if initAudio hasn't been called yet
  if (!_masterVol) {
    if (!_masterLimiter) {
      _masterLimiter = new Tone.Limiter(-2).toDestination();
    }
    _masterVol = new Tone.Volume(-6).connect(_masterLimiter);
  }
  return _masterVol;
}

// ---------------------------------------------------------------------------
// 1. Sword slash — short metallic swipe, slight pitch variance per swing
// ---------------------------------------------------------------------------

export function playSlash(): void {
  if (!_initialized) return;
  if (_activeSounds.slash >= MAX_CONCURRENT.slash) return;
  _activeSounds.slash++;

  // Pitch variance: ±15% to keep each swing feeling slightly different
  const pitchMult = 0.88 + Math.random() * 0.24;

  // Metal scrape layer: noise through a bandpass swept quickly
  const noise = new Tone.Noise("white");
  const bandpass = new Tone.Filter({
    type: "bandpass",
    frequency: 900 * pitchMult,
    Q: 4,
  });
  const env = new Tone.AmplitudeEnvelope({
    attack: 0.002,
    decay: 0.07,
    sustain: 0,
    release: 0.04,
  });
  const scrapeGain = new Tone.Gain(0.35);
  noise.connect(bandpass);
  bandpass.connect(env);
  env.connect(scrapeGain);
  scrapeGain.connect(masterOut());

  // Tonal click layer: very short sine pop for attack transient
  const click = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 },
    volume: -18,
  });
  click.connect(masterOut());

  noise.start();
  env.triggerAttackRelease(0.08);
  click.triggerAttackRelease(260 * pitchMult, "32n");

  // Dispose chain after sound finishes
  const disposeDelay = 400;
  const disposeId = setTimeout(() => {
    noise.stop();
    noise.dispose();
    bandpass.dispose();
    env.dispose();
    scrapeGain.dispose();
    click.dispose();
    _activeSounds.slash = Math.max(0, _activeSounds.slash - 1);
    clearTimeout(disposeId);
  }, disposeDelay);
}

// ---------------------------------------------------------------------------
// 2. Enemy kill — crunchy metal crunch + satisfying pop
//    isTank adds extra weight (lower, longer rumble)
// ---------------------------------------------------------------------------

export function playKill(isTank = false): void {
  if (!_initialized) return;
  if (_activeSounds.kill >= MAX_CONCURRENT.kill) return;
  _activeSounds.kill++;

  // Short noise burst through a low-mid bandpass — "crunch"
  const noise = new Tone.Noise("brown");
  const bp = new Tone.Filter({
    type: "bandpass",
    frequency: isTank ? 180 : 320,
    Q: isTank ? 2 : 3,
  });
  const distort = new Tone.Distortion(isTank ? 0.7 : 0.5);
  const env = new Tone.AmplitudeEnvelope({
    attack: 0.001,
    decay: isTank ? 0.18 : 0.09,
    sustain: 0,
    release: isTank ? 0.12 : 0.06,
  });
  const gainNode = new Tone.Gain(isTank ? 0.6 : 0.45);
  noise.connect(bp);
  bp.connect(distort);
  distort.connect(env);
  env.connect(gainNode);
  gainNode.connect(masterOut());

  // Pop layer: short pitched sine for "pop" satisfaction
  const pop = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.04 },
    volume: isTank ? -10 : -14,
  });
  pop.connect(masterOut());

  noise.start();
  env.triggerAttackRelease(isTank ? 0.22 : 0.1);
  pop.triggerAttackRelease(isTank ? 80 : 160, "32n");

  const disposeDelay = 600;
  const disposeId = setTimeout(() => {
    noise.stop();
    noise.dispose();
    bp.dispose();
    distort.dispose();
    env.dispose();
    gainNode.dispose();
    pop.dispose();
    _activeSounds.kill = Math.max(0, _activeSounds.kill - 1);
    clearTimeout(disposeId);
  }, disposeDelay);
}

// ---------------------------------------------------------------------------
// 3. Scrap pickup — pentatonic chime, pitch climbs with combo
// ---------------------------------------------------------------------------

export function playPickup(): void {
  if (!_initialized) return;
  if (_activeSounds.pickup >= MAX_CONCURRENT.pickup) return;
  _activeSounds.pickup++;

  // Advance combo through the 5-note pentatonic scale (one octave), then wrap.
  // Wrapping prevents the pitch from climbing into a stuck high register during
  // late-game constant pickup — the scale cycles pleasantly instead.
  const COMBO_STEPS = 5; // one full pentatonic octave, then restart
  const step = _pickupCombo % COMBO_STEPS;
  _pickupCombo = (_pickupCombo + 1) % COMBO_STEPS;

  // Reset combo after 0.5 s of silence (was 1.5 s — too long for late game pickup rates)
  if (_pickupComboResetTimer !== null) clearTimeout(_pickupComboResetTimer);
  _pickupComboResetTimer = setTimeout(() => {
    _pickupCombo = 0;
    _pickupComboResetTimer = null;
  }, 500);

  const freq = pentatonicFreq(step);

  // Bell-like: sine with slight triangle blend, fast attack, long sustain tail
  const bell = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.003, decay: 0.08, sustain: 0.1, release: 0.3 },
    volume: -20,
  });
  const shimmer = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.05, sustain: 0, release: 0.15 },
    volume: -28,
  });
  const reverb = new Tone.Reverb({ decay: 0.4, wet: 0.25 });
  bell.connect(reverb);
  shimmer.connect(reverb);
  reverb.connect(masterOut());

  bell.triggerAttackRelease(freq, "16n");
  shimmer.triggerAttackRelease(freq * 2, "32n"); // upper octave shimmer

  const disposeDelay = 700;
  const disposeId = setTimeout(() => {
    bell.dispose();
    shimmer.dispose();
    reverb.dispose();
    _activeSounds.pickup = Math.max(0, _activeSounds.pickup - 1);
    clearTimeout(disposeId);
  }, disposeDelay);
}

// ---------------------------------------------------------------------------
// 4. Level up — ascending triumphant chord (pentatonic arpeggio + pad)
// ---------------------------------------------------------------------------

export function playLevelUp(): void {
  if (!_initialized) return;

  // Ascending arpeggio: C4 E4 G4 C5 (bright, triumphant — no minor tone)
  const notes = [261.63, 329.63, 392.0, 523.25];
  const reverb = new Tone.Reverb({ decay: 1.2, wet: 0.4 });
  reverb.connect(masterOut());

  notes.forEach((freq, i) => {
    const synth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.6 },
      volume: -16,
    });
    synth.connect(reverb);

    const now = Tone.now();
    synth.triggerAttackRelease(freq, "8n", now + i * 0.07);

    const disposeDelay = 1800;
    const disposeId = setTimeout(() => {
      synth.dispose();
      clearTimeout(disposeId);
    }, disposeDelay);
  });

  // Warm pad chord — all notes together, slightly detuned for width
  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.08, decay: 0.3, sustain: 0.5, release: 1.0 },
    volume: -24,
  });
  pad.connect(reverb);
  pad.triggerAttackRelease(["C4", "E4", "G4"], "4n");

  const revDisposeId = setTimeout(() => {
    pad.dispose();
    reverb.dispose();
    clearTimeout(revDisposeId);
  }, 2500);
}

// ---------------------------------------------------------------------------
// 5. Tesla zap — electric crackle, high-frequency buzz
// ---------------------------------------------------------------------------

export function playTesla(): void {
  if (!_initialized) return;
  if (_activeSounds.tesla >= MAX_CONCURRENT.tesla) return;
  _activeSounds.tesla++;

  const now = Tone.now();

  // Bright snap — FM synth for metallic "zzt" transient
  const snap = new Tone.FMSynth({
    harmonicity: 5.5,
    modulationIndex: 12,
    oscillator: { type: "sine" },
    modulation: { type: "square" },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 },
    modulationEnvelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    volume: -8,
  });
  snap.connect(masterOut());

  // Pitch sweeps up for the "zzt" snap feel
  snap.frequency.setValueAtTime(800, now);
  snap.frequency.exponentialRampToValueAtTime(2400, now + 0.03);
  snap.triggerAttackRelease(800, 0.06, now);

  // Sub thump for weight
  const thump = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 },
    volume: -14,
  });
  thump.connect(masterOut());
  thump.triggerAttackRelease(200, "32n", now);

  const disposeDelay = 300;
  const disposeId = setTimeout(() => {
    snap.dispose();
    thump.dispose();
    _activeSounds.tesla = Math.max(0, _activeSounds.tesla - 1);
    clearTimeout(disposeId);
  }, disposeDelay);
}

// ---------------------------------------------------------------------------
// 6. Pulse shockwave — deep bass thump + whoosh
// ---------------------------------------------------------------------------

export function playPulse(): void {
  if (!_initialized) return;
  if (_activeSounds.pulse >= MAX_CONCURRENT.pulse) return;
  _activeSounds.pulse++;

  // Sub bass thump: sine swept down from ~80 Hz to ~30 Hz quickly
  const thump = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.15 },
    volume: -8,
  });
  thump.connect(masterOut());

  const now = Tone.now();
  thump.frequency.setValueAtTime(90, now);
  thump.frequency.exponentialRampToValueAtTime(28, now + 0.18);
  thump.triggerAttackRelease(90, "8n", now);

  // Whoosh: filtered noise sweep from low to high then fade
  const whoosh = new Tone.Noise("white");
  const whooshFilter = new Tone.Filter({ type: "bandpass", frequency: 200, Q: 2 });
  const whooshEnv = new Tone.AmplitudeEnvelope({
    attack: 0.01,
    decay: 0.14,
    sustain: 0,
    release: 0.1,
  });
  const whooshGain = new Tone.Gain(0.25);

  whoosh.connect(whooshFilter);
  whooshFilter.connect(whooshEnv);
  whooshEnv.connect(whooshGain);
  whooshGain.connect(masterOut());

  whoosh.start();
  whooshEnv.triggerAttackRelease(0.18);
  whooshFilter.frequency.setValueAtTime(150, now);
  whooshFilter.frequency.exponentialRampToValueAtTime(1200, now + 0.18);

  const disposeDelay = 600;
  const disposeId = setTimeout(() => {
    thump.dispose();
    whoosh.stop();
    whoosh.dispose();
    whooshFilter.dispose();
    whooshEnv.dispose();
    whooshGain.dispose();
    _activeSounds.pulse = Math.max(0, _activeSounds.pulse - 1);
    clearTimeout(disposeId);
  }, disposeDelay);
}

// ---------------------------------------------------------------------------
// 7. Player hit — painful low thud, gut-punch
// ---------------------------------------------------------------------------

export function playPlayerHit(): void {
  if (!_initialized) return;

  // Heavy low thud: brown noise + distortion, very low center
  const noise = new Tone.Noise("brown");
  const lp = new Tone.Filter({ type: "lowpass", frequency: 400, Q: 1 });
  const dist = new Tone.Distortion(0.6);
  const env = new Tone.AmplitudeEnvelope({
    attack: 0.001,
    decay: 0.15,
    sustain: 0,
    release: 0.1,
  });
  const gainNode = new Tone.Gain(0.7);

  // Low pitched thud tone for gut impact
  const thud = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 },
    volume: -10,
  });

  noise.connect(lp);
  lp.connect(dist);
  dist.connect(env);
  env.connect(gainNode);
  gainNode.connect(masterOut());
  thud.connect(masterOut());

  const now = Tone.now();
  noise.start();
  env.triggerAttackRelease(0.16);

  thud.frequency.setValueAtTime(70, now);
  thud.frequency.exponentialRampToValueAtTime(30, now + 0.12);
  thud.triggerAttackRelease(70, "8n", now);

  const disposeDelay = 600;
  const disposeId = setTimeout(() => {
    noise.stop();
    noise.dispose();
    lp.dispose();
    dist.dispose();
    env.dispose();
    gainNode.dispose();
    thud.dispose();
    clearTimeout(disposeId);
  }, disposeDelay);
}

// ---------------------------------------------------------------------------
// 8. Shield absorb — glassy deflection ping
// ---------------------------------------------------------------------------

export function playShieldAbsorb(): void {
  if (!_initialized) return;

  // High glassy ping: short sine at ~1400 Hz with fast decay
  const ping = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.2 },
    volume: -14,
  });

  // Shimmer layer: higher harmonic at 3× freq
  const shimmer = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.15 },
    volume: -22,
  });

  // Quick noise burst — the "impact" part of the deflection
  const noise = new Tone.Noise("white");
  const hp = new Tone.Filter({ type: "highpass", frequency: 4000, Q: 2 });
  const env = new Tone.AmplitudeEnvelope({
    attack: 0.001,
    decay: 0.04,
    sustain: 0,
    release: 0.03,
  });
  const noiseGain = new Tone.Gain(0.15);

  const reverb = new Tone.Reverb({ decay: 0.3, wet: 0.3 });

  ping.connect(reverb);
  shimmer.connect(reverb);
  reverb.connect(masterOut());

  noise.connect(hp);
  hp.connect(env);
  env.connect(noiseGain);
  noiseGain.connect(masterOut());

  ping.triggerAttackRelease(1400, "16n");
  shimmer.triggerAttackRelease(4200, "32n");
  noise.start();
  env.triggerAttackRelease(0.05);

  const disposeDelay = 800;
  const disposeId = setTimeout(() => {
    ping.dispose();
    shimmer.dispose();
    noise.stop();
    noise.dispose();
    hp.dispose();
    env.dispose();
    noiseGain.dispose();
    reverb.dispose();
    clearTimeout(disposeId);
  }, disposeDelay);
}

// ---------------------------------------------------------------------------
// 9. Game over — descending minor phrase, fade to silence
// ---------------------------------------------------------------------------

export function playGameOver(): void {
  if (!_initialized) return;

  // Descending minor chord arpeggio: A3 F3 C3 A2
  const notes = [220.0, 174.61, 130.81, 110.0];
  const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.5 });
  reverb.connect(masterOut());

  notes.forEach((freq, i) => {
    const synth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.5, sustain: 0.2, release: 1.2 },
      volume: -16,
    });
    synth.connect(reverb);

    const now = Tone.now();
    synth.triggerAttackRelease(freq, "4n", now + i * 0.18);

    const disposeDelay = 3500;
    const disposeId = setTimeout(() => {
      synth.dispose();
      clearTimeout(disposeId);
    }, disposeDelay);
  });

  // Heavy low drone that fades in then slowly out
  const drone = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.3, decay: 1.5, sustain: 0, release: 0.5 },
    volume: -20,
  });
  drone.connect(reverb);
  drone.triggerAttackRelease(55, "2n", Tone.now() + 0.1);

  const revDisposeId = setTimeout(() => {
    drone.dispose();
    reverb.dispose();
    clearTimeout(revDisposeId);
  }, 5000);

  // Fade out ambience over 2 s
  if (_ambienceGain) {
    _ambienceGain.gain.rampTo(0, 2.0);
  }
}

// ---------------------------------------------------------------------------
// 10. Background music — dark industrial beat loop
// ---------------------------------------------------------------------------

let _musicNodes: Array<{ dispose(): void }> = [];

/** Current music intensity level (1=Act1, 2=Act2, 3=Act3) */
let _currentIntensity: 1 | 2 | 3 = 1;
/** Baseline ambience gain value */
const _baseAmbienceGain = 0.32;

function _startAmbience(): void {
  if (_ambience) return;

  _ambienceGain = new Tone.Gain(0);
  _ambienceGain.connect(masterOut());

  // ---------------------------------------------------------------------------
  // DRUMS — shared compressor glues the kit together and adds punch
  // ---------------------------------------------------------------------------
  const drumBus = new Tone.Compressor({ threshold: -18, ratio: 5, attack: 0.003, release: 0.12 });
  drumBus.connect(_ambienceGain);

  // --- Kick: deep sub punch — large octave swing + long pitch decay ---
  const kickSynth = new Tone.MembraneSynth({
    pitchDecay: 0.09,   // longer sweep = more "thud"
    octaves: 9,          // deeper initial pitch drop
    envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.2 },
    volume: 2,           // hot into the bus compressor
  });
  // Saturate the kick slightly so it cuts through on small speakers
  const kickSat = new Tone.Distortion({ distortion: 0.15, wet: 0.4 });
  kickSynth.connect(kickSat);
  kickSat.connect(drumBus);

  // --- Snare: noise body + pitched transient for crack ---
  const snareNoise = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.06 },
    volume: -4,
  });
  const snareBodyFilter = new Tone.Filter({ type: "bandpass", frequency: 2200, Q: 0.8 });
  // Tonal snap layer — brief sine burst gives the "crack" that pink noise lacks
  const snareTone = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.055, sustain: 0, release: 0.02 },
    volume: -12,
  });
  snareNoise.connect(snareBodyFilter);
  snareBodyFilter.connect(drumBus);
  snareTone.connect(drumBus);

  // --- Hi-hat: tight industrial metal, high Q to sound mechanical ---
  const hatNoise = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.028, sustain: 0, release: 0.01 },
    volume: -14,
  });
  const hatFilter = new Tone.Filter({ type: "highpass", frequency: 9000, Q: 1.2 });
  hatNoise.connect(hatFilter);
  hatFilter.connect(drumBus);

  const openHat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.22, sustain: 0.05, release: 0.12 },
    volume: -17,
  });
  const openHatFilter = new Tone.Filter({ type: "highpass", frequency: 6500, Q: 1.0 });
  openHat.connect(openHatFilter);
  openHatFilter.connect(drumBus);

  // ---------------------------------------------------------------------------
  // SUB-BASS — pure sine always sustained, gives the physical rumble
  // A1 = 55 Hz, sits below the bass riff, felt more than heard
  // ---------------------------------------------------------------------------
  const subOsc = new Tone.Oscillator({ type: "sine", frequency: 55, volume: -16 });
  // Gentle LP to remove any aliasing artifacts above ~100 Hz
  const subFilter = new Tone.Filter({ type: "lowpass", frequency: 100, Q: 0.5 });
  subOsc.connect(subFilter);
  subFilter.connect(_ambienceGain);
  subOsc.start();

  // ---------------------------------------------------------------------------
  // BASS — two detuned voices for a fat, slightly gritty mid-bass
  // Voice A: sawtooth (harmonic-rich, primary character)
  // Voice B: square one octave up, detuned +7 cents (slightly hollow, fills mids)
  // ---------------------------------------------------------------------------
  const bassA = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" },
    filter: { type: "lowpass", frequency: 700, Q: 4 },
    envelope: { attack: 0.008, decay: 0.22, sustain: 0.3, release: 0.12 },
    filterEnvelope: {
      attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.15,
      baseFrequency: 100, octaves: 2.8,
    },
    volume: -8,
  });
  const bassB = new Tone.MonoSynth({
    oscillator: { type: "square" },
    filter: { type: "lowpass", frequency: 400, Q: 2 },
    envelope: { attack: 0.012, decay: 0.18, sustain: 0.2, release: 0.1 },
    filterEnvelope: {
      attack: 0.01, decay: 0.2, sustain: 0.08, release: 0.1,
      baseFrequency: 80, octaves: 1.8,
    },
    volume: -16,   // deliberately quieter — fills without competing
  });
  // Light saturation on the bass bus gives it bite at lower volumes
  const bassSat = new Tone.Distortion({ distortion: 0.3, wet: 0.35 });
  const bassLp = new Tone.Filter({ type: "lowpass", frequency: 900 });
  bassA.connect(bassSat);
  bassB.connect(bassSat);
  bassSat.connect(bassLp);
  bassLp.connect(_ambienceGain);

  // ---------------------------------------------------------------------------
  // PAD — three PolySynth voices with fatsawtooth for natural chorus width
  // Staggered detune across voices: -8 / 0 / +8 cents
  // Am7 → Dm7 → Fmaj7 → Em7 progression (all dark minor-flavored)
  // ---------------------------------------------------------------------------
  const padVoiceA = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "fatsawtooth", spread: 20, count: 3 },
    envelope: { attack: 0.8, decay: 1.2, sustain: 0.65, release: 2.5 },
    volume: -22,
  });
  const padVoiceB = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "fatsawtooth", spread: 14, count: 2 },
    envelope: { attack: 1.2, decay: 0.8, sustain: 0.55, release: 3.0 },
    volume: -25,
  });
  // Dark lowpass keeps the pad warm, not bright
  const padFilter = new Tone.Filter({ type: "lowpass", frequency: 1400, Q: 0.6 });
  // Chorus widens the stereo field and adds movement without sounding like an LFO
  const padChorus = new Tone.Chorus({ frequency: 0.4, delayTime: 3.5, depth: 0.55, wet: 0.6 });
  const padReverb = new Tone.Reverb({ decay: 5, wet: 0.55, preDelay: 0.04 });
  padVoiceA.connect(padFilter);
  padVoiceB.connect(padFilter);
  padFilter.connect(padChorus);
  padChorus.connect(padReverb);
  padReverb.connect(_ambienceGain);

  // ---------------------------------------------------------------------------
  // ATMOSPHERIC TEXTURE — slow filtered noise sweep (industrial breathing)
  // An LFO sweeps the lowpass cutoff 40–320 Hz over 6 seconds, creating a
  // rumbling, organic undertone beneath the mix.
  // ---------------------------------------------------------------------------
  const atmNoise = new Tone.Noise({ type: "brown", volume: -28 });
  const atmFilter = new Tone.Filter({ type: "lowpass", frequency: 80, Q: 1.5 });
  _ambienceLfo = new Tone.LFO({ frequency: "0.17", min: 40, max: 320, type: "sine" });
  _ambienceLfo.connect(atmFilter.frequency);
  atmNoise.connect(atmFilter);
  atmFilter.connect(_ambienceGain);
  atmNoise.start();
  _ambienceLfo.start();

  // ---------------------------------------------------------------------------
  // METALLIC LEAD — FM synth, dark motif in A minor
  // Replaces the chipmunk square arp: FM gives a cold, metallic bell-like tone
  // that cuts through without being harsh.
  // harmonicity 2.1 (slightly inharmonic) + modulation index 4 = industrial clang
  // ---------------------------------------------------------------------------
  const leadSynth = new Tone.FMSynth({
    harmonicity: 2.1,
    modulationIndex: 4,
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.14, sustain: 0.05, release: 0.25 },
    modulation: { type: "square" },
    modulationEnvelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.1 },
    volume: -20,
  });
  const leadFilter = new Tone.Filter({ type: "bandpass", frequency: 1800, Q: 1.8 });
  const leadDelay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.35, wet: 0.3 });
  const leadReverb = new Tone.Reverb({ decay: 1.5, wet: 0.3 });
  leadSynth.connect(leadFilter);
  leadFilter.connect(leadDelay);
  leadDelay.connect(leadReverb);
  leadReverb.connect(_ambienceGain);

  // ---------------------------------------------------------------------------
  // PATTERNS — 130 BPM, 32 16th-note steps = 2 bars, loops = 8 bars total
  // All patterns are 16th-note resolution (Loop fires every "16n")
  // ---------------------------------------------------------------------------
  Tone.getTransport().bpm.value = 130;

  // Kick: heavy four-on-the-floor with additional syncopated hits
  // Steps (16th notes): 1=downbeat, each group of 4 = one quarter-note beat
  //                     1 e + a  2 e + a  3 e + a  4 e + a   (bar 1)
  const kickPattern = [
    1, 0, 0, 0,  0, 0, 1, 0,  1, 0, 0, 0,  0, 0, 0, 0,   // bar 1 — driving
    1, 0, 0, 0,  0, 0, 1, 0,  1, 0, 0, 1,  0, 1, 0, 0,   // bar 2 — busier fill
    1, 0, 0, 0,  0, 0, 1, 0,  1, 0, 0, 0,  0, 0, 0, 0,   // bar 3
    1, 0, 0, 0,  0, 0, 1, 0,  0, 1, 0, 1,  0, 0, 1, 0,   // bar 4 — fill
    1, 0, 0, 0,  0, 0, 1, 0,  1, 0, 0, 0,  0, 0, 0, 0,   // bar 5
    1, 0, 0, 0,  0, 0, 1, 0,  1, 0, 0, 0,  0, 1, 0, 0,   // bar 6
    1, 0, 0, 0,  0, 0, 1, 0,  1, 0, 0, 0,  0, 0, 0, 0,   // bar 7
    1, 0, 0, 0,  1, 0, 1, 0,  1, 0, 1, 0,  1, 0, 1, 1,   // bar 8 — buildup
  ];
  let kickStep = 0;
  const kickLoop = new Tone.Loop((time) => {
    if (kickPattern[kickStep % kickPattern.length]) {
      kickSynth.triggerAttackRelease("A0", "8n", time);
    }
    kickStep++;
  }, "16n");

  // Snare: beats 2 and 4 with ghost notes and occasional triplet feel
  const snarePattern = [
    0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0,
    0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 1, 0,
    0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0,
    0, 0, 0, 0,  1, 0, 0, 0,  0, 1, 0, 0,  1, 0, 0, 0,
    0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0,
    0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 1, 0,
    0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0,
    0, 0, 0, 0,  1, 0, 0, 1,  0, 0, 1, 0,  1, 1, 0, 0,
  ];
  // Ghost notes (velocity ~30%) on select 16th positions
  const snareGhost = [
    0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1,
    0, 0, 1, 0,  0, 0, 0, 0,  0, 1, 0, 0,  0, 0, 0, 0,
    0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1,
    0, 0, 1, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,
    0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1,
    0, 0, 1, 0,  0, 0, 0, 0,  0, 1, 0, 0,  0, 0, 0, 0,
    0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1,
    0, 1, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,
  ];
  let snareStep = 0;
  const snareLoop = new Tone.Loop((time) => {
    const idx = snareStep % snarePattern.length;
    if (snarePattern[idx]) {
      snareNoise.triggerAttackRelease("16n", time);
      snareTone.triggerAttackRelease("E3", "32n", time);
    } else if (snareGhost[idx]) {
      snareNoise.triggerAttackRelease("32n", time);
    }
    snareStep++;
  }, "16n");

  // Hi-hat: 16th-note grid — 1=closed, 2=open, density varies per bar
  const hatPattern = [
    1, 1, 1, 1,  1, 1, 1, 1,  1, 1, 1, 1,  1, 1, 2, 1,
    1, 1, 1, 1,  1, 1, 1, 1,  1, 1, 1, 1,  1, 1, 1, 1,
    1, 0, 1, 0,  1, 0, 1, 1,  1, 0, 1, 0,  1, 1, 2, 1,
    1, 1, 1, 0,  1, 1, 1, 1,  1, 0, 1, 1,  1, 1, 1, 0,
    1, 1, 1, 1,  1, 1, 1, 1,  1, 1, 1, 1,  1, 1, 2, 1,
    1, 0, 1, 0,  1, 1, 1, 0,  1, 1, 1, 1,  1, 0, 1, 1,
    1, 1, 1, 0,  1, 1, 1, 1,  1, 0, 1, 0,  1, 1, 2, 1,
    1, 1, 0, 1,  1, 0, 1, 1,  0, 1, 1, 0,  1, 1, 1, 1,
  ];
  let hatStep = 0;
  const hatLoop = new Tone.Loop((time) => {
    const h = hatPattern[hatStep % hatPattern.length];
    if (h === 2) {
      openHat.triggerAttackRelease("16n", time);
    } else if (h === 1) {
      hatNoise.triggerAttackRelease("32n", time);
    }
    hatStep++;
  }, "16n");

  // Bass riff — 32-step 16th-note phrase (2 bars), loops over 8 bars (4 repetitions)
  // A minor: A C D E G — kept in lower register for weight
  // null = rest, value = note name
  const bassNotes: (string | null)[] = [
    "A1",  null, "A1",  null,  "C2",  null,  "A1",  "G1",   // bar 1
    "A1",  null, "E1",  null,  "A1",  null,  null,  "G1",   // bar 2
    "A1",  null, "A1",  "C2",  null,  "D2",  "C2",  "A1",   // bar 3
    "G1",  null, "E1",  null,  "A1",  "G1",  "E1",  null,   // bar 4
  ];
  // bassB plays an octave up but only on strong downbeats
  const bassBNotes: (string | null)[] = [
    "A2",  null, null,  null,  null,  null,  null,  null,
    "A2",  null, null,  null,  null,  null,  null,  null,
    "A2",  null, null,  null,  null,  null,  null,  null,
    "G2",  null, null,  null,  "A2",  null,  null,  null,
  ];
  let bassStep = 0;
  const bassLoop = new Tone.Loop((time) => {
    const idx = bassStep % bassNotes.length;
    const noteA = bassNotes[idx];
    const noteB = bassBNotes[idx];
    if (noteA) bassA.triggerAttackRelease(noteA, "16n", time);
    if (noteB) bassB.triggerAttackRelease(noteB, "16n", time);
    bassStep++;
  }, "16n");

  // Pad: 4 chords, each held for 2 bars (= 32 16th steps each, 8 bars total)
  // Am7 = A C E G — dark, floating
  // Dm7 = D F A C — melancholy
  // Fmaj7 = F A C E — bittersweet
  // Em7 = E G B D — tense, minor dominant
  const padChords: string[][] = [
    ["A2", "C3", "E3", "G3"],   // Am7
    ["A2", "C3", "E3", "G3"],   // Am7 (hold)
    ["D2", "F2", "A2", "C3"],   // Dm7
    ["D2", "F2", "A2", "C3"],   // Dm7 (hold)
    ["F2", "A2", "C3", "E3"],   // Fmaj7
    ["F2", "A2", "C3", "E3"],   // Fmaj7 (hold)
    ["E2", "G2", "B2", "D3"],   // Em7
    ["E2", "G2", "B2", "D3"],   // Em7 (hold)
  ];
  let padStep = 0;
  const padLoop = new Tone.Loop((time) => {
    const chord = padChords[padStep % padChords.length];
    padVoiceA.triggerAttackRelease(chord, "2n.", time);
    // Voice B enters slightly detuned — stagger by one 16th for natural swell
    padVoiceB.triggerAttackRelease(chord, "2n.", time + 0.04);
    padStep++;
  }, "1m");  // one measure = 16 16th steps; chords change every bar

  // Lead: FM metallic motif — sparse, sits in upper-mid register
  // Plays every 2 bars, 8-bar loop total (4 phrases)
  // A minor scale: A3 B3 C4 D4 E4 G4
  const leadNotes: (string | null)[] = [
    "E4",  null, "D4",  null,  null,  null,  "C4",  null,  // phrase 1
    null,  "A3", null,  null,  "G3",  null,  null,  null,
    "A3",  null, null,  "C4",  null,  "E4",  null,  "D4",  // phrase 2
    null,  null, "C4",  null,  null,  "A3",  null,  null,
    "G3",  null, "A3",  null,  null,  "C4",  null,  null,  // phrase 3
    "E4",  null, null,  "D4",  null,  null,  "C4",  null,
    null,  "A3", null,  "G3",  null,  null,  "E3",  null,  // phrase 4
    null,  null, "A3",  null,  "C4",  null,  "E4",  null,
  ];
  let leadStep = 0;
  const leadLoop = new Tone.Loop((time) => {
    const note = leadNotes[leadStep % leadNotes.length];
    if (note) {
      leadSynth.triggerAttackRelease(note, "8n", time);
    }
    leadStep++;
  }, "16n");

  // Start all loops at transport time 0
  kickLoop.start(0);
  snareLoop.start(0);
  hatLoop.start(0);
  bassLoop.start(0);
  padLoop.start(0);
  leadLoop.start(0);
  Tone.getTransport().start();

  // Fade in over 3 s — slow enough to not startle, fast enough to feel immediate
  _ambienceGain.gain.rampTo(0.32, 3.0);

  // Dummy oscillator used as "running" sentinel (never audible, freq 0)
  _ambience = new Tone.Oscillator(0);

  // All disposable nodes for _stopAmbience cleanup
  _musicNodes = [
    // drums
    drumBus, kickSynth, kickSat,
    snareNoise, snareBodyFilter, snareTone,
    hatNoise, hatFilter, openHat, openHatFilter,
    // sub-bass
    subOsc, subFilter,
    // bass
    bassA, bassB, bassSat, bassLp,
    // pad
    padVoiceA, padVoiceB, padFilter, padChorus, padReverb,
    // atmosphere
    atmNoise, atmFilter,
    // lead
    leadSynth, leadFilter, leadDelay, leadReverb,
    // loops (Tone.Loop implements dispose())
    kickLoop, snareLoop, hatLoop, bassLoop, padLoop, leadLoop,
  ];
}

/**
 * Adjust music intensity based on game act.
 * Level 1 (Act 1): baseline volume, 130 BPM
 * Level 2 (Act 2): +3dB gain, 130 BPM
 * Level 3 (Act 3): +6dB gain, 145 BPM
 */
export function setMusicIntensity(level: 1 | 2 | 3): void {
  if (!_initialized || !_ambienceGain) return;
  if (level === _currentIntensity) return;
  _currentIntensity = level;

  // Gain: +3dB ≈ ×1.41, +6dB ≈ ×2.0
  let gainTarget: number;
  let bpmTarget: number;
  switch (level) {
    case 1:
      gainTarget = _baseAmbienceGain;
      bpmTarget = 130;
      break;
    case 2:
      gainTarget = _baseAmbienceGain * 1.41; // +3dB
      bpmTarget = 130;
      break;
    case 3:
      gainTarget = _baseAmbienceGain * 2.0;  // +6dB
      bpmTarget = 145;
      break;
  }

  // Smooth ramp over 2 seconds to avoid jarring transitions
  _ambienceGain.gain.rampTo(gainTarget, 2.0);
  Tone.getTransport().bpm.rampTo(bpmTarget, 2.0);
}

function _stopAmbience(): void {
  Tone.getTransport().stop();
  Tone.getTransport().cancel();

  for (const node of _musicNodes) {
    node.dispose();
  }
  _musicNodes = [];

  if (_ambienceGain) { _ambienceGain.dispose(); _ambienceGain = null; }
  if (_ambienceLfo) { _ambienceLfo.dispose(); _ambienceLfo = null; }
  if (_ambience) { _ambience.dispose(); _ambience = null; }
}

// ---------------------------------------------------------------------------
// Victory — ascending major fanfare (distinct from level up — bigger)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// New weapon sounds
// ---------------------------------------------------------------------------

export function playBoomerang(): void {
  if (!_initialized) return;
  const s = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.04 }, volume: -16 });
  s.connect(masterOut());
  s.triggerAttackRelease(500 + Math.random() * 200, "32n");
  setTimeout(() => s.dispose(), 200);
}

export function playMineExplosion(): void {
  if (!_initialized) return;
  const n = new Tone.Noise("brown");
  const e = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 });
  const d = new Tone.Distortion(0.7);
  const g = new Tone.Gain(0.5);
  n.connect(d); d.connect(e); e.connect(g); g.connect(masterOut());
  n.start(); e.triggerAttackRelease(0.25);
  setTimeout(() => { n.stop(); n.dispose(); e.dispose(); d.dispose(); g.dispose(); }, 500);
}

export function playLaser(): void {
  if (!_initialized) return;
  const s = new Tone.Synth({ oscillator: { type: "sawtooth" }, envelope: { attack: 0.001, decay: 0.1, sustain: 0.05, release: 0.05 }, volume: -14 });
  const f = new Tone.Filter({ type: "bandpass", frequency: 1500, Q: 5 });
  s.connect(f); f.connect(masterOut());
  s.frequency.setValueAtTime(2000, Tone.now());
  s.frequency.exponentialRampToValueAtTime(800, Tone.now() + 0.1);
  s.triggerAttackRelease(2000, 0.12);
  setTimeout(() => { s.dispose(); f.dispose(); }, 400);
}

export function playAuraTick(): void {
  if (!_initialized) return;
  const s = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 }, volume: -26 });
  s.connect(masterOut());
  s.triggerAttackRelease(180 + Math.random() * 40, "64n");
  setTimeout(() => s.dispose(), 150);
}

export function playRicochetPing(): void {
  if (!_initialized) return;
  const s = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.03 }, volume: -18 });
  s.connect(masterOut());
  s.triggerAttackRelease(1200 + Math.random() * 600, "64n");
  setTimeout(() => s.dispose(), 200);
}

export function playGravityHum(): void {
  if (!_initialized) return;
  const s = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.05, decay: 0.3, sustain: 0.1, release: 0.2 }, volume: -16 });
  s.connect(masterOut());
  s.frequency.setValueAtTime(60, Tone.now());
  s.frequency.exponentialRampToValueAtTime(40, Tone.now() + 0.3);
  s.triggerAttackRelease(60, "4n");
  setTimeout(() => s.dispose(), 800);
}

export function playChainsawBuzz(): void {
  if (!_initialized) return;
  const n = new Tone.Noise("white");
  const f = new Tone.Filter({ type: "bandpass", frequency: 400, Q: 3 });
  const d = new Tone.Distortion(0.9);
  const e = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: 0.04, sustain: 0.02, release: 0.02 });
  const g = new Tone.Gain(0.15);
  n.connect(f); f.connect(d); d.connect(e); e.connect(g); g.connect(masterOut());
  n.start(); e.triggerAttackRelease(0.06);
  setTimeout(() => { n.stop(); n.dispose(); f.dispose(); d.dispose(); e.dispose(); g.dispose(); }, 200);
}

export function playSentryDeploy(): void {
  if (!_initialized) return;
  const s = new Tone.Synth({ oscillator: { type: "square" }, envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.08 }, volume: -18 });
  s.connect(masterOut());
  s.triggerAttackRelease(300, "16n");
  const s2 = new Tone.Synth({ oscillator: { type: "square" }, envelope: { attack: 0.01, decay: 0.08, sustain: 0, release: 0.06 }, volume: -20 });
  s2.connect(masterOut());
  s2.triggerAttackRelease(450, "16n", Tone.now() + 0.06);
  setTimeout(() => { s.dispose(); s2.dispose(); }, 400);
}

// ---------------------------------------------------------------------------

/** Evolution unlock — dramatic FM chord with long reverb tail */
export function playEvolution(): void {
  if (!_initialized) return;

  const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.5 });
  reverb.connect(masterOut());

  // Descending impact → ascending resolve
  const notes = [220, 165, 110, 220, 330, 440, 660];
  notes.forEach((freq, i) => {
    const synth = new Tone.FMSynth({
      harmonicity: 3,
      modulationIndex: 6,
      oscillator: { type: "sine" },
      modulation: { type: "square" },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 1.0 },
      modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.5 },
      volume: -12,
    });
    synth.connect(reverb);
    const now = Tone.now();
    synth.triggerAttackRelease(freq, "8n", now + i * 0.1);
    const disposeId = setTimeout(() => { synth.dispose(); clearTimeout(disposeId); }, 3000);
  });

  const revId = setTimeout(() => { reverb.dispose(); clearTimeout(revId); }, 4000);
}

// ---------------------------------------------------------------------------

export function playVictory(): void {
  if (!_initialized) return;

  // Full C major chord arpeggio climbing two octaves
  const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];
  const reverb = new Tone.Reverb({ decay: 1.8, wet: 0.45 });
  reverb.connect(masterOut());

  notes.forEach((freq, i) => {
    const synth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.25, sustain: 0.35, release: 0.8 },
      volume: -14,
    });
    synth.connect(reverb);

    const now = Tone.now();
    synth.triggerAttackRelease(freq, "8n", now + i * 0.09);

    const disposeDelay = 3000;
    const disposeId = setTimeout(() => {
      synth.dispose();
      clearTimeout(disposeId);
    }, disposeDelay);
  });

  const revDisposeId = setTimeout(() => {
    reverb.dispose();
    clearTimeout(revDisposeId);
  }, 4000);
}
