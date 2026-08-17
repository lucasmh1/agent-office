// Procedural Web Audio sound effects

let ctx = null;
let enabled = true;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function playTone(freq, duration, type = 'square', volume = 0.08, slideTo = null) {
  if (!enabled) return;
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + duration);
    }
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + duration);
  } catch {}
}

function noiseBurst(duration = 0.08, volume = 0.06) {
  if (!enabled) return;
  try {
    const ac = getCtx();
    const bufferSize = ac.sampleRate * duration;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const source = ac.createBufferSource();
    source.buffer = buffer;
    const gain = ac.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(ac.destination);
    source.start();
  } catch {}
}

export const Audio = {
  setEnabled(v) {
    enabled = v;
  },

  click() {
    playTone(800, 0.04, 'square', 0.05);
  },

  success() {
    playTone(520, 0.08, 'sine', 0.07);
    setTimeout(() => playTone(780, 0.12, 'sine', 0.06), 70);
  },

  error() {
    playTone(180, 0.15, 'sawtooth', 0.06, 90);
  },

  coin() {
    playTone(980, 0.06, 'square', 0.05);
    setTimeout(() => playTone(1320, 0.1, 'square', 0.04), 50);
  },

  walk() {
    noiseBurst(0.03, 0.025);
  },

  type() {
    playTone(randomFreq(400, 900), 0.025, 'square', 0.03);
  },

  collaborate() {
    playTone(440, 0.1, 'triangle', 0.05);
    setTimeout(() => playTone(554, 0.1, 'triangle', 0.04), 80);
    setTimeout(() => playTone(659, 0.12, 'triangle', 0.04), 160);
  },

  event() {
    playTone(300, 0.2, 'sawtooth', 0.05, 600);
  },

  coffee() {
    playTone(200, 0.15, 'sine', 0.04, 120);
  },

  hire() {
    playTone(400, 0.08, 'sine', 0.06);
    setTimeout(() => playTone(600, 0.08, 'sine', 0.05), 60);
    setTimeout(() => playTone(800, 0.15, 'sine', 0.05), 120);
  }
};

function randomFreq(min, max) {
  return min + Math.random() * (max - min);
}
