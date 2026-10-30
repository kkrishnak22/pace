// d:\pace\client\js\audio.js
// Humane Natural Voice Speech Synthesis & Pure Silence Sound Engine

let audioCtx = null;
let bgmGain = null;
let bgmOscs = [];
let voiceEnabled = true;
let bgmEnabled = false; // STRICTLY OFF by default - zero drone sound on pause
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

// Load and cache all neural, natural, and clear teacher voices
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

  const currentVal = select.value || selectedVoiceURI;
  select.innerHTML = '';

  // Sort: Put Natural / Neural / High Quality voices on top
  const sorted = [...cachedVoices].sort((a, b) => {
    const isNaturalA = a.name.includes('Natural') || a.name.includes('Neural') || a.name.includes('Online');
    const isNaturalB = b.name.includes('Natural') || b.name.includes('Neural') || b.name.includes('Online');
    const isEnA = a.lang.startsWith('en');
    const isEnB = b.lang.startsWith('en');

    const scoreA = (isNaturalA ? 4 : 0) + (isEnA ? 2 : 0) + (a.lang.includes('IN') ? 1 : 0);
    const scoreB = (isNaturalB ? 4 : 0) + (isEnB ? 2 : 0) + (b.lang.includes('IN') ? 1 : 0);
    return scoreB - scoreA;
  });

  sorted.forEach(v => {
    // Only English or Indian accent voices
    if (!v.lang.startsWith('en') && !v.lang.startsWith('te') && !v.lang.includes('IN')) return;

    const opt = document.createElement('option');
    opt.value = v.voiceURI;
    const isNatural = v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Online');
    const cleanName = v.name.replace(/Microsoft |Google /, '').replace(/Online \(Natural\)/, 'Natural');
    opt.textContent = `${isNatural ? '✨ ' : ''}${cleanName} (${v.lang})`;
    select.appendChild(opt);
  });

  if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
    select.value = currentVal;
  } else {
    const best = getBestNaturalVoice(window.PlayerState ? window.PlayerState.language : 'en');
    if (best) {
      select.value = best.voiceURI;
      selectedVoiceURI = best.voiceURI;
    }
  }
}

function getBestNaturalVoice(language = 'en') {
  if (cachedVoices.length === 0) loadAvailableVoices();
  if (cachedVoices.length === 0) return null;

  // 1. User manual override
  if (selectedVoiceURI) {
    const matched = cachedVoices.find(v => v.voiceURI === selectedVoiceURI);
    if (matched) return matched;
  }

  const select = document.getElementById('voice-select');
  if (select && select.value) {
    const userChoice = cachedVoices.find(v => v.voiceURI === select.value);
    if (userChoice) return userChoice;
  }

  // 2. If Telugish, prioritize natural Indian English voices
  if (language === 'telugish') {
    const indianVoice = cachedVoices.find(v => 
      (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Online')) &&
      (v.lang.includes('en-IN') || v.name.includes('India') || v.name.includes('Neerja') || v.name.includes('Prabhat'))
    ) || cachedVoices.find(v => 
      v.lang && (v.lang.includes('en-IN') || v.lang.includes('te'))
    );
    if (indianVoice) return indianVoice;
  }

  // 3. Prioritize Microsoft Natural / Google Neural voices
  const naturalVoice = cachedVoices.find(v => 
    (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Online')) &&
    v.lang.startsWith('en')
  ) || cachedVoices.find(v => 
    v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Jenny')
  );
  if (naturalVoice) return naturalVoice;

  // 4. Any clear English voice
  const enVoice = cachedVoices.find(v => v.lang && v.lang.startsWith('en'));
  return enVoice || cachedVoices[0];
}

const AudioEngine = {
  currentUtterance: null,

  speak(text, optsOrLang = 'en', onWordBoundary = null, onComplete = null) {
    if (!voiceEnabled || !('speechSynthesis' in window) || !text) {
      if (typeof onWordBoundary === 'function' && !onComplete) {
        onWordBoundary();
      } else if (onComplete) {
        onComplete();
      }
      return;
    }

    let language = 'en';
    let onWord = null;
    let onDone = null;

    if (typeof optsOrLang === 'object' && optsOrLang !== null) {
      language = optsOrLang.language || 'en';
      onWord = optsOrLang.onWordBoundary || null;
      onDone = optsOrLang.onComplete || null;
    } else {
      language = optsOrLang || 'en';
      if (typeof onWordBoundary === 'function' && !onComplete) {
        onDone = onWordBoundary;
        onWord = null;
      } else {
        onWord = onWordBoundary;
        onDone = onComplete;
      }
    }

    try {
      window.speechSynthesis.cancel();
      this.duckBgm(true);

      const utter = new SpeechSynthesisUtterance(text);
      // Calm, clear, authoritative teaching pace (0.92x)
      utter.rate = Math.max(0.7, (window.PlayerState ? window.PlayerState.playbackSpeed : 1.0) * 0.92);
      utter.pitch = 1.0;

      const voice = getBestNaturalVoice(language);
      if (voice) utter.voice = voice;

      // Real-time karaoke word tracking
      utter.onboundary = (event) => {
        if (event.name === 'word' && onWord) {
          onWord(event.charIndex, event.charLength || 0);
        }
      };

      let finished = false;
      const done = () => {
        if (!finished) {
          finished = true;
          this.duckBgm(false);
          if (onDone) onDone();
        }
      };

      utter.onend = done;
      utter.onerror = done;

      // Fallback timeout protection
      const words = text.split(/\s+/).length;
      const estMs = (words / (2.0 * utter.rate)) * 1000 + 4000;
      setTimeout(() => { if (!finished) done(); }, estMs);

      this.currentUtterance = utter;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      this.duckBgm(false);
      if (onDone) onDone();
    }
  },

  stopSpeech() {
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    this.currentUtterance = null;
    this.silenceAll();
  },

  // ABSOLUTE ZERO SOUND: Kills any audio context oscillators or drone hum
  silenceAll() {
    if (bgmOscs && bgmOscs.length > 0) {
      bgmOscs.forEach(osc => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {}
      });
      bgmOscs = [];
    }
    if (bgmGain && audioCtx) {
      try {
        const now = audioCtx.currentTime;
        bgmGain.gain.cancelScheduledValues(now);
        bgmGain.gain.setValueAtTime(0.0, now);
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
      const targetGain = ducking ? 0.01 : 0.035;
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
    if (!bgmEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      this.silenceAll();

      bgmGain = ctx.createGain();
      bgmGain.gain.setValueAtTime(0.035, ctx.currentTime);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(380, ctx.currentTime);

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

window.onVoiceSelected = function(uri) {
  selectedVoiceURI = uri;
  const v = cachedVoices.find(voice => voice.voiceURI === uri);
  if (v) {
    console.log('[AudioEngine] User selected voice:', v.name);
    if (window.PlayerState && !window.PlayerState.isPlaying) {
      window.AudioEngine.speak("Natural voice ready.", { language: window.PlayerState.language || 'en' });
    }
  }
};

window.toggleVoiceAudio = function() {
  const on = window.AudioEngine.toggleVoice();
  const icon = document.getElementById('voice-toggle-icon');
  const lbl = document.getElementById('voice-toggle-lbl');
  if (icon) icon.textContent = on ? '🎙️' : '🔇';
  if (lbl) lbl.textContent = on ? 'Voice: ON' : 'Voice: OFF';
};

window.toggleBgMusic = function() {
  const on = window.AudioEngine.toggleBgm();
  const icon = document.getElementById('bgm-toggle-icon');
  const lbl = document.getElementById('bgm-toggle-lbl');
  if (icon) icon.textContent = on ? '🎵' : '🔇';
  if (lbl) lbl.textContent = on ? 'BGM: ON' : 'BGM: OFF';
};
