// d:\pace\client\js\audio.js

let audioCtx = null;
let bgmGain = null;
let bgmOscs = [];
let voiceEnabled = true;
let bgmEnabled = false; // OFF by default so zero unwanted drone sounds!
let cachedVoices = [];
let selectedVoiceURI = null;

function getAudioContext() {
  if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    try { audioCtx.resume(); } catch (e) {}
  }
  return audioCtx;
}

// Load and cache all neural and natural voices
function loadAvailableVoices() {
  if (!('speechSynthesis' in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length > 0) {
    cachedVoices = voices;
    populateVoiceSelectDropdown();
  }
  return cachedVoices;
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    loadAvailableVoices();
  };
  loadAvailableVoices();
}

function populateVoiceSelectDropdown() {
  const select = document.getElementById('voice-select');
  if (!select || cachedVoices.length === 0) return;

  const currentVal = select.value;
  select.innerHTML = '';

  // Sort: Put Natural / Neural / High Quality voices on top
  const sorted = [...cachedVoices].sort((a, b) => {
    const aScore = (a.name.includes('Natural') || a.name.includes('Neural') || a.name.includes('Online')) ? 2 : (a.lang.startsWith('en') ? 1 : 0);
    const bScore = (b.name.includes('Natural') || b.name.includes('Neural') || b.name.includes('Online')) ? 2 : (b.lang.startsWith('en') ? 1 : 0);
    return bScore - aScore;
  });

  sorted.forEach(v => {
    if (!v.lang.startsWith('en') && !v.lang.startsWith('te') && !v.lang.includes('IN')) return;
    const opt = document.createElement('option');
    opt.value = v.voiceURI;
    const isNatural = v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Online');
    opt.textContent = `${isNatural ? '✨ ' : ''}${v.name} (${v.lang})`;
    select.appendChild(opt);
  });

  if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
    select.value = currentVal;
  } else {
    // Select the best natural voice by default
    const best = getBestNaturalVoice(window.PlayerState ? window.PlayerState.language : 'en');
    if (best) select.value = best.voiceURI;
  }
}

function getBestNaturalVoice(language = 'en') {
  if (cachedVoices.length === 0) loadAvailableVoices();
  if (cachedVoices.length === 0) return null;

  // If user selected a specific voice from dropdown
  const select = document.getElementById('voice-select');
  if (select && select.value) {
    const userChoice = cachedVoices.find(v => v.voiceURI === select.value);
    if (userChoice) return userChoice;
  }

  // If Telugish, prioritize natural Indian English voices
  if (language === 'telugish') {
    const indianVoice = cachedVoices.find(v => 
      (v.lang && (v.lang.includes('en-IN') || v.lang.includes('te'))) ||
      v.name.includes('India') || v.name.includes('Neerja') || v.name.includes('Prabhat')
    );
    if (indianVoice) return indianVoice;
  }

  // Prioritize Microsoft Natural / Google Neural voices
  const naturalVoice = cachedVoices.find(v => 
    v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Online') ||
    v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Jenny')
  );
  if (naturalVoice) return naturalVoice;

  const enVoice = cachedVoices.find(v => v.lang && v.lang.startsWith('en'));
  return enVoice || cachedVoices[0];
}

const AudioEngine = {
  currentUtterance: null,

  speak(text, language = 'en', onWordBoundary = null, onComplete = null) {
    if (!voiceEnabled || !('speechSynthesis' in window) || !text) {
      if (onComplete) onComplete();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      this.duckBgm(true);

      const utter = new SpeechSynthesisUtterance(text);
      // Calm, warm, clear teaching pace
      utter.rate = Math.max(0.7, (window.PlayerState ? window.PlayerState.playbackSpeed : 1.0) * 0.90);
      utter.pitch = 1.0;

      const voice = getBestNaturalVoice(language);
      if (voice) utter.voice = voice;

      // Karaoke word-by-word boundary tracking!
      utter.onboundary = (event) => {
        if (event.name === 'word' && onWordBoundary) {
          onWordBoundary(event.charIndex, event.charLength || 0);
        }
      };

      let finished = false;
      const done = () => {
        if (!finished) {
          finished = true;
          this.duckBgm(false);
          if (onComplete) onComplete();
        }
      };

      utter.onend = done;
      utter.onerror = done;

      // Fallback timeout
      const words = text.split(/\s+/).length;
      const estMs = (words / (2.0 * utter.rate)) * 1000 + 4000;
      setTimeout(() => { if (!finished) done(); }, estMs);

      this.currentUtterance = utter;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      this.duckBgm(false);
      if (onComplete) onComplete();
    }
  },

  stopSpeech() {
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    this.currentUtterance = null;
    this.silenceAll();
  },

  // STRICT SILENCE: completely kills any drone sounds when paused
  silenceAll() {
    if (bgmGain && audioCtx) {
      try {
        const now = audioCtx.currentTime;
        bgmGain.gain.cancelScheduledValues(now);
        bgmGain.gain.setValueAtTime(0.0, now); // Absolute silence
      } catch (e) {}
    }
  },

  duckBgm(ducking) {
    if (!bgmGain || !audioCtx || !bgmEnabled) {
      this.silenceAll();
      return;
    }
    try {
      const now = audioCtx.currentTime;
      const targetGain = ducking ? 0.01 : 0.04;
      bgmGain.gain.cancelScheduledValues(now);
      bgmGain.gain.linearRampToValueAtTime(targetGain, now + 0.3);
    } catch (e) {}
  },

  playBeep(freq = 520, duration = 0.08) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  },

  playWhoosh() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch (e) {}
  },

  initLofiBgm() {
    // Only initialize if explicitly turned ON by the user
    if (!bgmEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx || bgmGain) return;

      bgmGain = ctx.createGain();
      bgmGain.gain.setValueAtTime(0.04, ctx.currentTime);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, ctx.currentTime);

      const freqs = [130.81, 164.81, 196.00, 246.94];
      freqs.forEach(f => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, ctx.currentTime);
        osc.connect(filter);
        osc.start();
        bgmOscs.push(osc);
      });

      filter.connect(bgmGain);
      bgmGain.connect(ctx.destination);
    } catch (e) {}
  },

  toggleBgm() {
    bgmEnabled = !bgmEnabled;
    if (bgmEnabled) {
      this.initLofiBgm();
      if (bgmGain && audioCtx) {
        bgmGain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      }
    } else {
      this.silenceAll();
    }
    return bgmEnabled;
  },

  toggleVoice() {
    voiceEnabled = !voiceEnabled;
    if (!voiceEnabled) this.stopSpeech();
    return voiceEnabled;
  }
};

window.AudioEngine = AudioEngine;
