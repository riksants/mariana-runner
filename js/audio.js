/* =========================================================
   MARIANA RUNNER — audio
   Every sound, including the background pad, is synthesized
   at runtime with the Web Audio API. No audio files ship or
   load over the network, and everything routes through one
   mute switch that persists across visits.
   ========================================================= */

const AudioMgr = (() => {
  const MUTE_KEY = 'marianaRunnerMuted';
  let ctx = null;
  let master = null;
  let muted = localStorage.getItem(MUTE_KEY) === '1';
  let ambientNodes = null;
  let melodyPlaying = false;
  let melodyTimeoutId = null;

  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function isMuted() { return muted; }

  function setMuted(next) {
    muted = next;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    if (master) {
      const ac = getCtx();
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.linearRampToValueAtTime(muted ? 0 : 1, ac.currentTime + 0.08);
    }
  }

  function toggleMuted() { setMuted(!muted); return muted; }

  function tone(freqStart, freqEnd, duration, type = 'square', volume = 0.12, delay = 0) {
    try {
      const ac = getCtx();
      const t0 = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
      gain.gain.setValueAtTime(volume, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    } catch (e) { /* audio unavailable — fail silently */ }
  }

  function noiseBurst(duration, volume = 0.15, filterFreq = null) {
    try {
      const ac = getCtx();
      const bufferSize = Math.floor(ac.sampleRate * duration);
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const src = ac.createBufferSource();
      src.buffer = buffer;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(volume, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
      let node = src;
      if (filterFreq) {
        const filter = ac.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq;
        src.connect(filter);
        node = filter;
      }
      node.connect(gain);
      gain.connect(master);
      src.start();
    } catch (e) { /* ignore */ }
  }

  // A short, quiet pentatonic riff looping under the drone pad — the
  // ambient pad alone is just a background wash with no melodic hook,
  // which read as flat compared to the arcade energy of the SFX. Reuses
  // tone() (synthesized, no audio files) and schedules a whole phrase's
  // worth of notes at once via Web Audio's own currentTime + delay, so
  // note timing doesn't drift with JS timer jitter — only the trigger
  // for the *next* phrase goes through setTimeout.
  const MELODY_NOTES = [523.25, 587.33, 659.25, 783.99, 880.00, 783.99, 659.25, 587.33]; // C5 D5 E5 G5 A5 G5 E5 D5
  const MELODY_STEP = 0.28; // seconds per note
  function scheduleMelodyPhrase() {
    if (!melodyPlaying) return;
    MELODY_NOTES.forEach((freq, i) => {
      tone(freq, freq, MELODY_STEP * 0.55, 'triangle', 0.045, i * MELODY_STEP);
    });
    melodyTimeoutId = setTimeout(scheduleMelodyPhrase, MELODY_NOTES.length * MELODY_STEP * 1000);
  }

  function startMelody() {
    if (melodyPlaying || REDUCE_MOTION_AUDIO()) return;
    melodyPlaying = true;
    scheduleMelodyPhrase();
  }

  function stopMelody() {
    melodyPlaying = false;
    if (melodyTimeoutId) { clearTimeout(melodyTimeoutId); melodyTimeoutId = null; }
  }

  function startAmbient() {
    startMelody();
    if (ambientNodes || REDUCE_MOTION_AUDIO()) return;
    try {
      const ac = getCtx();
      const gain = ac.createGain();
      gain.gain.value = 0;
      gain.connect(master);
      gain.gain.linearRampToValueAtTime(0.05, ac.currentTime + 1.2);

      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      filter.connect(gain);

      const oscA = ac.createOscillator();
      oscA.type = 'sine';
      oscA.frequency.value = 98; // low desert drone
      const oscB = ac.createOscillator();
      oscB.type = 'sine';
      oscB.frequency.value = 147; // a fifth above, kept quiet
      const oscBGain = ac.createGain();
      oscBGain.gain.value = 0.4;

      const lfo = ac.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.08; // slow filter breathing, like heat shimmer
      const lfoGain = ac.createGain();
      lfoGain.gain.value = 250;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      oscA.connect(filter);
      oscB.connect(oscBGain);
      oscBGain.connect(filter);

      oscA.start();
      oscB.start();
      lfo.start();

      ambientNodes = { gain, oscA, oscB, lfo, filter, oscBGain };
    } catch (e) { /* ignore */ }
  }

  function stopAmbient() {
    stopMelody();
    if (!ambientNodes) return;
    const ac = getCtx();
    const { gain, oscA, oscB, lfo } = ambientNodes;
    gain.gain.cancelScheduledValues(ac.currentTime);
    gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.4);
    setTimeout(() => {
      try { oscA.stop(); oscB.stop(); lfo.stop(); } catch (e) { /* already stopped */ }
    }, 450);
    ambientNodes = null;
  }

  function REDUCE_MOTION_AUDIO() {
    // Ambient pad is gentle, but honor the same low-stimulation preference.
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  return {
    unlock() { getCtx(); },
    isMuted,
    setMuted,
    toggleMuted,
    startAmbient,
    stopAmbient,
    jump() { tone(520, 780, 0.12, 'square', 0.10); },
    land() { tone(180, 90, 0.08, 'sine', 0.06); },
    hit() {
      noiseBurst(0.18, 0.18);
      tone(180, 60, 0.2, 'sawtooth', 0.10, 0.02);
    },
    gameOver() { tone(420, 90, 0.5, 'triangle', 0.10); },
    start() {
      tone(300, 300, 0.06, 'square', 0.08);
      tone(500, 500, 0.06, 'square', 0.08, 0.08);
      tone(700, 700, 0.10, 'square', 0.08, 0.16);
    },
    milestone() {
      tone(660, 660, 0.07, 'square', 0.07);
      tone(880, 880, 0.09, 'square', 0.07, 0.07);
    },
    // Distinct from milestone() (square/time-based): a softer triangle-wave
    // ascending motif for clearing a streak of obstacles — rewards dodging
    // skill specifically, not just elapsed play time.
    streak() {
      tone(740, 740, 0.05, 'triangle', 0.06);
      tone(988, 988, 0.05, 'triangle', 0.06, 0.05);
      tone(1318, 1318, 0.08, 'triangle', 0.06, 0.10);
    },
    record() {
      tone(523, 523, 0.09, 'square', 0.08);
      tone(659, 659, 0.09, 'square', 0.08, 0.09);
      tone(784, 784, 0.09, 'square', 0.08, 0.18);
      tone(1047, 1047, 0.16, 'square', 0.08, 0.27);
    },
    uiHover() { tone(700, 760, 0.05, 'square', 0.03); },
    uiClick() { tone(500, 400, 0.05, 'square', 0.06); },
    powerup() {
      tone(440, 440, 0.06, 'square', 0.08);
      tone(660, 660, 0.06, 'square', 0.08, 0.06);
      tone(880, 990, 0.12, 'square', 0.08, 0.12);
    },
    shieldBreak() {
      noiseBurst(0.1, 0.12, 3000);
      tone(300, 140, 0.15, 'triangle', 0.08, 0.02);
    },
    coin() { tone(880, 1200, 0.08, 'square', 0.05); },
  };
})();
