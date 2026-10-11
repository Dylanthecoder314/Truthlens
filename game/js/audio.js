/* Tiny synthesised sound effects (Web Audio). No audio files needed. */
(function () {
  const A = {};
  let ctx = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem('jom-muted') === '1'; } catch (e) { /* storage blocked */ }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noise({ dur = 0.1, type = 'highpass', freq = 2000, q = 0.8, gain = 0.4, when = 0, sweepTo = null, attack = 0.003 }) {
    const c = ensure(); if (!c || muted) return;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    const t0 = c.currentTime + when;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  function tone({ freq = 440, type = 'sine', dur = 0.2, gain = 0.15, when = 0, slideTo = null }) {
    const c = ensure(); if (!c || muted) return;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain();
    const t0 = c.currentTime + when;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  A.unlock = ensure;
  A.shutter = () => { noise({ dur: 0.045, freq: 3500, gain: 0.5 }); noise({ dur: 0.07, freq: 1400, gain: 0.32, when: 0.055 }); };
  A.whoosh = () => noise({ dur: 0.55, type: 'bandpass', freq: 300, sweepTo: 2600, q: 0.7, gain: 0.25, attack: 0.15 });
  A.thud = () => { tone({ freq: 110, dur: 0.18, gain: 0.25, slideTo: 60 }); noise({ dur: 0.12, type: 'lowpass', freq: 900, gain: 0.25 }); };
  A.ping = () => { tone({ freq: 880, dur: 0.14, gain: 0.12 }); tone({ freq: 1320, dur: 0.22, gain: 0.12, when: 0.09 }); };
  A.murmur = () => { for (let i = 0; i < 4; i++) noise({ dur: 0.5, type: 'bandpass', freq: 380 + i * 90, q: 4, gain: 0.07, when: i * 0.12, attack: 0.15 }); };
  A.gasp = () => noise({ dur: 0.35, type: 'bandpass', freq: 1200, sweepTo: 2400, q: 2, gain: 0.12, attack: 0.05 });
  A.good = () => { tone({ freq: 523, dur: 0.25, gain: 0.1 }); tone({ freq: 784, dur: 0.35, gain: 0.1, when: 0.08 }); };
  A.bad = () => tone({ freq: 150, type: 'sawtooth', dur: 0.3, gain: 0.06, slideTo: 90 });
  A.tick = () => noise({ dur: 0.02, freq: 4000, gain: 0.08 });
  A.scan = () => { for (let i = 0; i < 6; i++) tone({ freq: 600 + i * 120, type: 'square', dur: 0.05, gain: 0.03, when: i * 0.12 }); };
  A.sparkle = () => { for (let i = 0; i < 5; i++) tone({ freq: 1200 + i * 260, type: 'triangle', dur: 0.12, gain: 0.05, when: i * 0.05 }); };

  A.isMuted = () => muted;
  A.setMuted = (m) => {
    muted = !!m;
    try { localStorage.setItem('jom-muted', muted ? '1' : '0'); } catch (e) { /* storage blocked */ }
    if (master) master.gain.value = muted ? 0 : 0.55;
  };

  window.JOM_AUDIO = A;
})();
