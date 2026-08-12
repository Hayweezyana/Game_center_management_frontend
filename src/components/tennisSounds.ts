// ─────────────────────────────────────────────────────────────────────────────
// Tennis display sounds
//
// Every cue is synthesised with the Web Audio API rather than loaded from audio
// files. On the kiosk Pi that matters: no assets to ship, nothing to 404, and
// the display keeps making sound when the internet is down.
//
// Cues:
//   player1 point  — bright rising chirp
//   player2 point  — darker falling chirp   (deliberately different timbre, so
//                                            you can tell who scored without
//                                            looking at the board)
//   undo           — descending buzz
//   service switch — two-note handover chime
//   set won        — short fanfare
//   series won     — longer fanfare
// ─────────────────────────────────────────────────────────────────────────────

type Waveform = OscillatorType;

interface ToneSpec {
  freq: number;
  /** Slide to this frequency over the note's life. Omit to hold pitch. */
  toFreq?: number;
  duration: number;   // seconds
  delay?: number;     // seconds from cue start
  type?: Waveform;
  gain?: number;
  /** Second oscillator a fixed interval above, for a fuller chord-ish note. */
  detune?: number;
}

export type TennisCue =
  | 'point-player1'
  | 'point-player2'
  | 'undo'
  | 'service-switch'
  | 'set-won'
  | 'series-won'
  | 'match-draw';

/**
 * Each player gets a voice that differs in BOTH pitch direction and waveform —
 * pitch alone is hard to tell apart across a noisy games room.
 */
const CUES: Record<TennisCue, ToneSpec[]> = {
  // Player 1 — bright, rising, triangle: "ti-DING"
  'point-player1': [
    { freq: 660, toFreq: 880, duration: 0.09, type: 'triangle', gain: 0.5 },
    { freq: 990, toFreq: 1320, duration: 0.18, delay: 0.07, type: 'triangle', gain: 0.45, detune: 7 },
  ],

  // Player 2 — warm, falling, square: "DUM-da"
  'point-player2': [
    { freq: 520, toFreq: 440, duration: 0.1, type: 'square', gain: 0.32 },
    { freq: 330, toFreq: 262, duration: 0.2, delay: 0.08, type: 'square', gain: 0.3, detune: -5 },
  ],

  // Undo — unmistakably "wrong": descending sawtooth buzz
  'undo': [
    { freq: 420, toFreq: 180, duration: 0.28, type: 'sawtooth', gain: 0.3 },
    { freq: 210, toFreq: 90, duration: 0.3, delay: 0.05, type: 'sawtooth', gain: 0.22 },
  ],

  // Service handover — neutral two-note chime, distinct from either player
  'service-switch': [
    { freq: 880, duration: 0.1, type: 'sine', gain: 0.35 },
    { freq: 1174, duration: 0.16, delay: 0.13, type: 'sine', gain: 0.35 },
  ],

  // Set won — quick rising fanfare
  'set-won': [
    { freq: 523, duration: 0.13, type: 'triangle', gain: 0.45 },
    { freq: 659, duration: 0.13, delay: 0.13, type: 'triangle', gain: 0.45 },
    { freq: 784, duration: 0.13, delay: 0.26, type: 'triangle', gain: 0.45 },
    { freq: 1047, duration: 0.4, delay: 0.39, type: 'triangle', gain: 0.5, detune: 7 },
  ],

  // Series won — longer, more triumphant
  'series-won': [
    { freq: 523, duration: 0.14, type: 'triangle', gain: 0.5 },
    { freq: 659, duration: 0.14, delay: 0.14, type: 'triangle', gain: 0.5 },
    { freq: 784, duration: 0.14, delay: 0.28, type: 'triangle', gain: 0.5 },
    { freq: 1047, duration: 0.14, delay: 0.42, type: 'triangle', gain: 0.5 },
    { freq: 784, duration: 0.14, delay: 0.56, type: 'triangle', gain: 0.45 },
    { freq: 1047, duration: 0.7, delay: 0.7, type: 'triangle', gain: 0.55, detune: 12 },
  ],

  // Draw — two flat, unresolved notes
  'match-draw': [
    { freq: 440, duration: 0.25, type: 'sine', gain: 0.4 },
    { freq: 415, duration: 0.5, delay: 0.25, type: 'sine', gain: 0.4 },
  ],
};

/** Half-steps → frequency multiplier. */
function transpose(freq: number, semitones: number): number {
  return freq * Math.pow(2, semitones / 12);
}

class TennisSoundPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private unlockBound = false;
  public enabled = true;
  public volume = 0.8;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  /**
   * Browsers suspend audio until a user gesture. The kiosk has no user, so it
   * is launched with --autoplay-policy=no-user-gesture-required (see
   * hardware/display_unit/setup.sh); this listener covers every other browser.
   */
  bindUnlock() {
    if (this.unlockBound || typeof window === 'undefined') return;
    this.unlockBound = true;

    const unlock = () => {
      const ctx = this.ensureContext();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    };

    ['pointerdown', 'keydown', 'touchstart', 'click'].forEach((evt) =>
      window.addEventListener(evt, unlock, { passive: true })
    );
    // Try straight away too — succeeds under the kiosk autoplay flag.
    unlock();
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  play(cue: TennisCue) {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;

    if (ctx.state === 'suspended') {
      // Resume and play on the next tick rather than dropping the cue.
      ctx.resume().then(() => this.emit(cue)).catch(() => {});
      return;
    }
    this.emit(cue);
  }

  private emit(cue: TennisCue) {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const start = ctx.currentTime;
    for (const spec of CUES[cue]) {
      this.emitTone(ctx, master, spec, start);
      if (spec.detune) {
        this.emitTone(
          ctx,
          master,
          {
            ...spec,
            freq: transpose(spec.freq, spec.detune),
            toFreq: spec.toFreq ? transpose(spec.toFreq, spec.detune) : undefined,
            gain: (spec.gain ?? 0.4) * 0.6,
          },
          start
        );
      }
    }
  }

  private emitTone(ctx: AudioContext, dest: GainNode, spec: ToneSpec, start: number) {
    const at = start + (spec.delay ?? 0);
    const end = at + spec.duration;

    const osc = ctx.createOscillator();
    osc.type = spec.type ?? 'triangle';
    osc.frequency.setValueAtTime(spec.freq, at);
    if (spec.toFreq) osc.frequency.exponentialRampToValueAtTime(spec.toFreq, end);

    // Short attack, exponential decay — a percussive "blip" rather than a beep.
    const env = ctx.createGain();
    const peak = spec.gain ?? 0.4;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.012, spec.duration / 3));
    env.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(env);
    env.connect(dest);
    osc.start(at);
    osc.stop(end + 0.02);
  }
}

export const tennisSounds = new TennisSoundPlayer();
