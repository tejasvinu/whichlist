class SoundSystem {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  public play(type: "hover" | "click" | "success" | "laser" | "trash" | "whoosh") {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === "hover") {
        // High-pitched mechanical relay click
        osc.type = "sine";
        osc.frequency.setValueAtTime(1200, t);
        gain.gain.setValueAtTime(0.012, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
        osc.start(t);
        osc.stop(t + 0.03);
      } else if (type === "click") {
        // Satisfying tactile physical pop
        osc.type = "triangle";
        osc.frequency.setValueAtTime(240, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.07);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
        osc.start(t);
        osc.stop(t + 0.07);
      } else if (type === "success") {
        // Futurist 8-bit modular chime sweep
        osc.type = "square";
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.setValueAtTime(660, t + 0.06);
        osc.frequency.setValueAtTime(880, t + 0.12);
        gain.gain.setValueAtTime(0.02, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        osc.start(t);
        osc.stop(t + 0.22);
      } else if (type === "laser") {
        // High frequency scanner laser sweep
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(900, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.12);
        gain.gain.setValueAtTime(0.015, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        osc.start(t);
        osc.stop(t + 0.12);
      } else if (type === "trash") {
        // Downward industrial static decay
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.linearRampToValueAtTime(15, t + 0.18);
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        osc.start(t);
        osc.stop(t + 0.18);
      } else if (type === "whoosh") {
        // Quick aerodynamic card sweep
        osc.type = "sine";
        osc.frequency.setValueAtTime(280, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.16);
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        osc.start(t);
        osc.stop(t + 0.16);
      }
    } catch {
      // Audio context block/unsupported
    }
  }
}

export const sound = new SoundSystem();
