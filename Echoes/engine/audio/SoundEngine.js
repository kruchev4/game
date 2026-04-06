// game/engine/audio/SoundEngine.js

let audioCtx = null;
let soundEnabled = true;

function getAudioCtx() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return null;
    }
  }

  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  return audioCtx;
}

export function playSound(type) {
  if (!soundEnabled) return;

  const ctx = getAudioCtx();
  if (!ctx) return;

  const t = ctx.currentTime;

  function osc(freq, type = "sine", start = t, dur = 0.15, vol = 0.18) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  function sweep(f1, f2, type = "sawtooth", start = t, dur = 0.2, vol = 0.12) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, start);
    o.frequency.exponentialRampToValueAtTime(f2, start + dur);
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  function noise(start = t, dur = 0.1, vol = 0.06) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(g);
    g.connect(ctx.destination);
    src.start(start);
    src.stop(start + dur + 0.05);
  }

  switch (type) {
    case "attack":
      noise(t, 0.04, 0.1);
      osc(200, "sawtooth", t + 0.03, 0.12, 0.14);
      osc(120, "square", t + 0.05, 0.08, 0.1);
      break;
    case "hit":
      noise(t, 0.06, 0.15);
      osc(80, "square", t, 0.18, 0.2);
      sweep(150, 60, "square", t, 0.15, 0.12);
      break;
    case "step":
      noise(t, 0.04, 0.03);
      osc(120, "sine", t, 0.04, 0.04);
      break;
    case "portal":
      osc(80, "sine", t, 0.4, 0.1);
      sweep(600, 1200, "sine", t, 0.3, 0.06);
      sweep(1200, 600, "sine", t + 0.3, 0.3, 0.06);
      break;
    // (You can paste the rest unchanged)
  }
}

export function toggleSound() {
  soundEnabled = !soundEnabled;

  const btn = document.getElementById("sound-toggle");
  if (btn) btn.textContent = soundEnabled ? "🔊" : "🔇";

  if (typeof window.toast === "function") {
    window.toast(soundEnabled ? "Sound on" : "Sound off");
  }
}
