// d:\pace\client\js\typewriter.js

const Typewriter = {
  activeTimers: [],

  cancelAll() {
    this.activeTimers.forEach(t => clearInterval(t));
    this.activeTimers = [];
    document.querySelectorAll('.live-cursor').forEach(c => c.remove());
  },

  stream(elementId, fullText, speedMs = 18, onComplete = null) {
    const el = document.getElementById(elementId);
    if (!el || !fullText) {
      if (onComplete) onComplete();
      return;
    }

    el.setAttribute('data-full-text', fullText);

    // If fast scrub or user requested immediate
    if (window.PlayerState && (!window.PlayerState.isPlaying || window.PlayerState.playbackSpeed > 1.4)) {
      el.innerHTML = fullText;
      if (onComplete) onComplete();
      return;
    }

    el.innerHTML = '';
    const cursor = document.createElement('span');
    cursor.className = 'live-cursor';
    cursor.textContent = '|';
    el.appendChild(cursor);

    let idx = 0;
    const speed = Math.max(8, Math.round(speedMs / (window.PlayerState ? window.PlayerState.playbackSpeed : 1.0)));

    const timer = setInterval(() => {
      if (idx < fullText.length) {
        // Fast forward HTML tags
        if (fullText[idx] === '<') {
          const closeTagIdx = fullText.indexOf('>', idx);
          if (closeTagIdx !== -1) {
            const tag = fullText.substring(idx, closeTagIdx + 1);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = tag;
            if (tempDiv.firstChild) {
              el.insertBefore(tempDiv.firstChild, cursor);
            }
            idx = closeTagIdx + 1;
            return;
          }
        }

        const charNode = document.createTextNode(fullText[idx]);
        el.insertBefore(charNode, cursor);
        idx++;
      } else {
        clearInterval(timer);
        cursor.remove();
        el.innerHTML = fullText;
        if (onComplete) onComplete();
      }
    }, speed);

    this.activeTimers.push(timer);
  },

  populateImmediate(elementId, fullText) {
    const el = document.getElementById(elementId);
    if (el && fullText) {
      el.innerHTML = fullText;
      el.setAttribute('data-full-text', fullText);
    }
  }
};

window.Typewriter = Typewriter;

