// Modular Sound Manager that can fall back to Web Audio API synthesized sounds
// if no physical static audio assets are configured.
import { Howl } from "howler";

export interface SoundConfig {
  useAssets: boolean;
  assetPaths?: {
    correct?: string;
    combo?: string;
    attack?: string;
    warning?: string;
    garbage?: string;
    lose?: string;
  };
}

export class SoundManager {
  private static instance: SoundManager | null = null;
  private audioCtx: AudioContext | null = null;
  private config: SoundConfig = { useAssets: false };
  private sounds: { [key: string]: Howl | null } = {};

  private constructor() {
    // Lazy initialize AudioContext on first user interaction to comply with browser autoplay policies
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  public init(config?: SoundConfig) {
    if (config) {
      this.config = config;
    }

    if (this.config.useAssets && this.config.assetPaths) {
      const paths = this.config.assetPaths;
      if (paths.correct) this.sounds.correct = new Howl({ src: [paths.correct] });
      if (paths.combo) this.sounds.combo = new Howl({ src: [paths.combo] });
      if (paths.attack) this.sounds.attack = new Howl({ src: [paths.attack] });
      if (paths.warning) this.sounds.warning = new Howl({ src: [paths.warning] });
      if (paths.garbage) this.sounds.garbage = new Howl({ src: [paths.garbage] });
      if (paths.lose) this.sounds.lose = new Howl({ src: [paths.lose] });
    }
  }

  private initAudioContext() {
    if (!this.audioCtx) {
      const w = window as typeof window & { webkitAudioContext?: typeof AudioContext };
      const AudioCtxClass = window.AudioContext || w.webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  public playCorrect() {
    this.initAudioContext();
    if (this.config.useAssets && this.sounds.correct) {
      this.sounds.correct.play();
      return;
    }

    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(600, now);
    // Quick pitch rise to give a satisfying "tick/ping" sound
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playCombo(combo: number) {
    this.initAudioContext();
    if (this.config.useAssets && this.sounds.combo) {
      this.sounds.combo.play();
      return;
    }

    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    // Scale pitch based on combo count (pentatonic-like steps)
    const baseFreq = 300;
    const multiplier = 1 + (combo % 8) * 0.15;
    const freq = baseFreq * multiplier;

    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.12);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playAttack() {
    this.initAudioContext();
    if (this.config.useAssets && this.sounds.attack) {
      this.sounds.attack.play();
      return;
    }

    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Laser slide down
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);

    // Apply lowpass filter to make it sound warmer and less harsh
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.15);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playWarning() {
    this.initAudioContext();
    if (this.config.useAssets && this.sounds.warning) {
      this.sounds.warning.play();
      return;
    }

    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(400, now);

    // Create 3 rapid beep pulses
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.setValueAtTime(0.0, now + 0.05);
    gain.gain.setValueAtTime(0.08, now + 0.08);
    gain.gain.setValueAtTime(0.0, now + 0.13);
    gain.gain.setValueAtTime(0.08, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playGarbageImpact() {
    this.initAudioContext();
    if (this.config.useAssets && this.sounds.garbage) {
      this.sounds.garbage.play();
      return;
    }

    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Short, punchy low thud for garbage landing on the board.
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.14);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(500, now);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playLose() {
    this.initAudioContext();
    if (this.config.useAssets && this.sounds.lose) {
      this.sounds.lose.play();
      return;
    }

    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Downward sweep representing defeat
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.5);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }
}
