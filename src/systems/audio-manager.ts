import type { AudioSettings } from '@/types/game-types';

export type SfxId =
  | 'swing'
  | 'hit'
  | 'hurt'
  | 'shot'
  | 'coin'
  | 'jump'
  | 'ui'
  | 'quest'
  | 'chop'
  | 'treeFall'
  | 'drink'
  | 'eat'
  | 'death'
  | 'miss'
  | 'burn'
  | 'straw'
  | 'thunder';

export type MusicMode = 'off' | 'explore' | 'combat';

interface PlayOptions {
  volume?: number;
  pitch?: number;
  pos?: { x: number; y: number; z: number };
}

const SETTINGS_KEY = 'zbojnik.audio';
const MAX_VOICES_PER_SFX = 4;

/** G lydian-ish folk scale (fujara songs love the raised 4th). */
const SCALE = [196.0, 220.0, 246.94, 277.18, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 587.33];
const EXPLORE_PHRASES: number[][] = [
  [7, 8, 9, 8, 7, -1, 4, 5, 7, -1],
  [9, 10, 9, 7, 8, 7, 4, -1, -1],
  [4, 7, 8, 9, -1, 8, 7, 5, 4, -1, -1],
  [7, -1, 9, 8, 9, 10, 9, 7, -1, -1, -1],
];

/**
 * Web Audio manager. The whole soundtrack and every effect are synthesized so the
 * prototype ships without audio files. Handles autoplay unlock, channel volumes,
 * mute persistence, voice limiting, spatial panning and music crossfades.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private exploreGain!: GainNode;
  private combatGain!: GainNode;
  private noise!: AudioBuffer;
  private readonly voices = new Map<SfxId, number>();
  private mode: MusicMode = 'off';
  private nextExplore = 0;
  private nextCombat = 0;
  private phrase: number[] = [];
  private combatStep = 0;
  readonly settings: AudioSettings;

  constructor() {
    this.settings = this.loadSettings();
    const unlock = (): void => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
  }

  private loadSettings(): AudioSettings {
    const defaults: AudioSettings = { master: 0.8, music: 0.55, sfx: 0.8, muted: false };
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaults;
      return { ...defaults, ...(JSON.parse(raw) as Partial<AudioSettings>) };
    } catch {
      return defaults;
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* storage may be blocked */
    }
  }

  /** Browsers block audio until a user gesture – create/resume the context then. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.exploreGain = this.ctx.createGain();
      this.combatGain = this.ctx.createGain();
      this.exploreGain.gain.value = 0;
      this.combatGain.gain.value = 0;
      this.exploreGain.connect(this.musicBus);
      this.combatGain.connect(this.musicBus);
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      this.setMusicMode(this.mode, true);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  setVolume(channel: 'master' | 'music' | 'sfx', value: number): void {
    this.settings[channel] = Math.max(0, Math.min(1, value));
    this.applyVolumes();
    this.persist();
  }

  toggleMute(): boolean {
    this.settings.muted = !this.settings.muted;
    this.applyVolumes();
    this.persist();
    return this.settings.muted;
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.settings.music * 0.6, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx, t, 0.05);
  }

  /** Crossfade between the exploration fujara tune and the combat "odzemok". */
  setMusicMode(mode: MusicMode, force = false): void {
    if (mode === this.mode && !force) return;
    this.mode = mode;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.exploreGain.gain.setTargetAtTime(mode === 'explore' ? 1 : 0, t, 0.8);
    this.combatGain.gain.setTargetAtTime(mode === 'combat' ? 1 : 0, t, 0.4);
    if (mode === 'combat') this.nextCombat = Math.max(this.nextCombat, t + 0.05);
    if (mode === 'explore') this.nextExplore = Math.max(this.nextExplore, t + 0.5);
  }

  /** Called every rendered frame: positions the listener and schedules music ahead of time. */
  update(listener: { x: number; y: number; z: number }, yaw: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const l = ctx.listener;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    if ('positionX' in l && l.positionX) {
      l.positionX.value = listener.x;
      l.positionY.value = listener.y;
      l.positionZ.value = listener.z;
      l.forwardX.value = fx;
      l.forwardY.value = 0;
      l.forwardZ.value = fz;
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      l.setPosition(listener.x, listener.y, listener.z);
      l.setOrientation(fx, 0, fz, 0, 1, 0);
    }
    this.scheduleMusic(ctx);
  }

  private scheduleMusic(ctx: AudioContext): void {
    const horizon = ctx.currentTime + 0.4;
    if (this.mode === 'explore') {
      while (this.nextExplore < horizon) {
        if (this.phrase.length === 0) {
          this.phrase = [...EXPLORE_PHRASES[Math.floor(Math.random() * EXPLORE_PHRASES.length)]];
          // drone under each phrase – the fujara's low overtone
          this.flute(98, this.nextExplore, 5.5, 0.05, this.exploreGain, 0.3);
        }
        const note = this.phrase.shift() ?? -1;
        const dur = 0.42 + (Math.random() < 0.2 ? 0.42 : 0);
        if (note >= 0) this.flute(SCALE[note], this.nextExplore, dur * 1.25, 0.11, this.exploreGain);
        this.nextExplore += dur;
        if (this.phrase.length === 0) this.nextExplore += 1.5 + Math.random() * 2.5;
      }
    } else {
      this.nextExplore = Math.max(this.nextExplore, ctx.currentTime);
    }
    if (this.mode === 'combat') {
      const step = 0.16;
      while (this.nextCombat < horizon) {
        const s = this.combatStep++ % 16;
        if (s % 4 === 0) this.kick(this.nextCombat, this.combatGain);
        if (s % 4 === 2) this.snare(this.nextCombat, this.combatGain);
        const riff = [7, 9, 10, 9, 7, 8, 9, 7, 4, 5, 7, 5, 4, 3, 4, -1];
        const n = riff[s];
        if (n >= 0) this.fiddle(SCALE[n], this.nextCombat, step * 0.95, this.combatGain);
        this.nextCombat += step;
      }
    } else {
      this.nextCombat = Math.max(this.nextCombat, ctx.currentTime);
    }
  }

  // --- Synth voices ------------------------------------------------------------

  private flute(freq: number, t: number, dur: number, gain: number, dest: AudioNode, breath = 0.22): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.1;
    const vibGain = ctx.createGain();
    vibGain.gain.value = freq * 0.007;
    vib.connect(vibGain);
    vibGain.connect(o.frequency);
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = freq * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.16;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gain, t + Math.min(0.09, dur * 0.3));
    env.gain.setValueAtTime(gain, t + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(8000, freq * 3);
    bp.Q.value = 3;
    const ng = ctx.createGain();
    ng.gain.value = breath;
    o.connect(env);
    o2.connect(g2);
    g2.connect(env);
    n.connect(bp);
    bp.connect(ng);
    ng.connect(env);
    env.connect(dest);
    const end = t + dur + 0.05;
    for (const src of [o, o2, vib]) {
      src.start(t);
      src.stop(end);
    }
    n.start(t, Math.random() * 0.5);
    n.stop(end);
  }

  private fiddle(freq: number, t: number, dur: number, dest: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.05, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp);
    lp.connect(env);
    env.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private kick(t: number, dest: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + 0.25);
  }

  private snare(t: number, dest: AudioNode): void {
    this.noiseBurst(t, 0.12, 1800, 'highpass', 0.12, dest);
  }

  private noiseBurst(
    t: number,
    dur: number,
    freq: number,
    type: BiquadFilterType,
    gain: number,
    dest: AudioNode,
    sweepTo?: number,
  ): AudioBufferSourceNode | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo !== undefined) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f);
    f.connect(g);
    g.connect(dest);
    n.start(t, Math.random() * 0.5);
    n.stop(t + dur + 0.02);
    return n;
  }

  private tone(
    t: number,
    type: OscillatorType,
    from: number,
    to: number,
    dur: number,
    gain: number,
    dest: AudioNode,
  ): OscillatorNode | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
    return o;
  }

  /** Play a one-shot effect; positional when `pos` is given. */
  play(id: SfxId, opts: PlayOptions = {}): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const active = this.voices.get(id) ?? 0;
    if (active >= MAX_VOICES_PER_SFX) return;
    this.voices.set(id, active + 1);
    window.setTimeout(() => this.voices.set(id, Math.max(0, (this.voices.get(id) ?? 1) - 1)), 400);

    const out = ctx.createGain();
    out.gain.value = opts.volume ?? 1;
    if (opts.pos) {
      const p = ctx.createPanner();
      p.panningModel = 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = 4;
      p.rolloffFactor = 1.2;
      p.positionX.value = opts.pos.x;
      p.positionY.value = opts.pos.y;
      p.positionZ.value = opts.pos.z;
      out.connect(p);
      p.connect(this.sfxBus);
    } else {
      out.connect(this.sfxBus);
    }
    window.setTimeout(() => out.disconnect(), 2500);

    const t = ctx.currentTime;
    const k = opts.pitch ?? 1;
    switch (id) {
      case 'swing':
        this.noiseBurst(t, 0.2, 700 * k, 'bandpass', 0.35, out, 2600 * k);
        break;
      case 'hit':
        this.tone(t, 'sine', 160 * k, 45, 0.18, 0.6, out);
        this.noiseBurst(t, 0.08, 1200, 'lowpass', 0.4, out);
        break;
      case 'hurt':
        this.tone(t, 'square', 240 * k, 110, 0.2, 0.12, out);
        this.noiseBurst(t, 0.1, 900, 'lowpass', 0.3, out);
        break;
      case 'shot':
        this.noiseBurst(t, 0.55, 2400, 'lowpass', 0.9, out, 300);
        this.tone(t, 'sine', 120, 40, 0.3, 0.7, out);
        break;
      case 'coin':
        this.tone(t, 'sine', 1900 * k, 1900 * k, 0.12, 0.15, out);
        this.tone(t + 0.07, 'sine', 2500 * k, 2500 * k, 0.18, 0.12, out);
        break;
      case 'jump':
        this.tone(t, 'sine', 220 * k, 380 * k, 0.12, 0.08, out);
        break;
      case 'ui':
        this.tone(t, 'triangle', 900 * k, 700 * k, 0.06, 0.12, out);
        break;
      case 'quest':
        [0, 2, 4, 7].forEach((n, i) => this.flute(SCALE[n + 3], t + i * 0.12, 0.5, 0.18, out, 0.1));
        break;
      case 'chop':
        this.tone(t, 'triangle', 300 * k, 120, 0.1, 0.4, out);
        this.noiseBurst(t, 0.09, 2000, 'bandpass', 0.5, out);
        break;
      case 'treeFall':
        this.tone(t, 'sawtooth', 90, 50, 1.1, 0.08, out);
        this.noiseBurst(t + 1.0, 0.6, 400, 'lowpass', 0.9, out, 80);
        break;
      case 'drink':
        for (let i = 0; i < 4; i++) this.tone(t + i * 0.09, 'sine', 500 + i * 60, 300, 0.07, 0.12, out);
        break;
      case 'eat':
        for (let i = 0; i < 3; i++) this.noiseBurst(t + i * 0.11, 0.06, 1500, 'bandpass', 0.3, out);
        break;
      case 'death':
        this.tone(t, 'sawtooth', 220, 55, 0.9, 0.1, out);
        break;
      case 'miss':
        this.tone(t, 'square', 330, 300, 0.12, 0.05, out);
        break;
      case 'burn':
        this.noiseBurst(t, 0.35, 3000, 'highpass', 0.25, out);
        break;
      case 'straw':
        this.noiseBurst(t, 0.3, 3500, 'bandpass', 0.35, out, 1200);
        break;
      case 'thunder':
        // sharp crack followed by a long rolling rumble
        this.noiseBurst(t, 0.25, 2500, 'bandpass', 0.5, out, 400);
        this.noiseBurst(t + 0.05, 3.2, 260, 'lowpass', 1.4, out, 60);
        this.tone(t + 0.05, 'sine', 55, 32, 2.6, 0.5, out);
        break;
    }
  }

  // --- Weather ambience -----------------------------------------------------------

  private rainGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  private ensureAmbience(ctx: AudioContext): void {
    if (this.rainGain) return;
    const loop = (): AudioBufferSourceNode => {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      s.start();
      return s;
    };
    const rain = loop();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rain.connect(hp);
    hp.connect(lp);
    lp.connect(this.rainGain);
    this.rainGain.connect(this.sfxBus);

    const wind = loop();
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 380;
    this.windFilter.Q.value = 0.8;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wind.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.sfxBus);
  }

  /** Continuous rain hiss and gusting wind; 0..1 each. */
  setAmbience(rain: number, wind: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    this.ensureAmbience(ctx);
    const t = ctx.currentTime;
    this.rainGain?.gain.setTargetAtTime(rain * 0.22, t, 0.5);
    const gust = 0.6 + Math.sin(t * 0.7) * 0.25 + Math.sin(t * 1.9) * 0.15;
    this.windGain?.gain.setTargetAtTime(Math.max(0, wind - 0.1) * 0.35 * gust, t, 0.4);
    this.windFilter?.frequency.setTargetAtTime(280 + gust * 260, t, 0.4);
  }

  /** Fast fiddle + drum tune for the odzemok dance. */
  playDance(seconds: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const step = 0.2;
    const riff = [7, 9, 10, 9, 7, 9, 7, 4, 5, 7, 9, 7, 5, 4, 3, 4];
    const t0 = ctx.currentTime + 0.05;
    const steps = Math.floor(seconds / step);
    for (let i = 0; i < steps; i++) {
      const t = t0 + i * step;
      if (i % 4 === 0) this.kick(t, this.sfxBus);
      if (i % 4 === 2) this.snare(t, this.sfxBus);
      this.fiddle(SCALE[riff[i % riff.length]], t, step * 0.9, this.sfxBus);
      // the shout every two bars
      if (i % 16 === 14) this.noiseBurst(t, 0.12, 1400, 'bandpass', 0.25, this.sfxBus);
    }
  }

  /** A single fujara note – used by the fujara minigame. */
  fujaraNote(freq: number, duration = 0.45): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    this.flute(freq, ctx.currentTime, duration, 0.28, this.sfxBus, 0.18);
  }
}
