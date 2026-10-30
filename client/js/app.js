// d:\pace\client\js\app.js

const PlayerState = {
  manifest: null,
  currentStepIndex: 1,
  totalSteps: 3,
  isPlaying: false,
  stepByStepMode: false,
  language: 'en',
  playbackSpeed: 1.0,
  cachedSteps: {},
  stepTimer: null,
  ideSubStep: 0,
  isGeneratingApi: false,
  subtitlesVisible: true,
  subtitlesExpanded: false
};

window.PlayerState = PlayerState;

// DOM Elements Cache
const DOM = {};

function initDomReferences() {
  DOM.stageCanvas = document.getElementById('blackboard-stage');
  DOM.stepBadge = document.getElementById('step-indicator-badge');
  DOM.stepTitle = document.getElementById('step-title-live');
  DOM.stepDesc = document.getElementById('step-desc-live');
  DOM.bodyMount = document.getElementById('stage-body-mount');
  DOM.apiOverlay = document.getElementById('api-loading-overlay');
  DOM.apiOverlayText = document.getElementById('api-loader-msg');
  DOM.playPauseIcon = document.getElementById('play-pause-icon');
  DOM.scrubberFill = document.getElementById('scrubber-fill');
  DOM.timeCurrent = document.getElementById('time-current');
  DOM.timeTotal = document.getElementById('time-total');
  DOM.modeBtn = document.getElementById('btn-mode-toggle');
  DOM.modeIcon = document.getElementById('mode-icon');
  DOM.modeLabel = document.getElementById('mode-label');
  DOM.subtitleCard = document.getElementById('draggable-subtitles-card');
  DOM.subtitleText = document.getElementById('live-subtitle-txt');
}

// 1. BOOT SEQUENCE
async function bootPlayerApp() {
  initDomReferences();
  initDraggableSubtitles();
  initKeyboardShortcuts();

  console.log('[PlayerApp] Booting client player...');
  
  // 1. Fetch Manifest
  const manifest = await window.LessonAPI.fetchManifest();
  if (manifest) {
    PlayerState.manifest = manifest;
    PlayerState.totalSteps = manifest.totalSteps || 3;
    document.getElementById('lesson-header-title').textContent = manifest.title_en;
  }

  // 2. Pre-fetch Step 1 and Step 2
  const [s1, s2] = await Promise.all([
    window.LessonAPI.fetchStep(1),
    window.LessonAPI.fetchStep(2)
  ]);

  if (s1) PlayerState.cachedSteps[1] = s1;
  if (s2) PlayerState.cachedSteps[2] = s2;

  // 3. Render initial Step 1
  loadAndRenderStep(1);

  // 4. Initialize Lo-Fi BGM on first user interaction
  window.addEventListener('click', () => {
    window.AudioEngine.initLofiBgm();
  }, { once: true });
}

// 2. STEP RENDERER & ORCHESTRATION
async function loadAndRenderStep(stepNumber) {
  if (stepNumber < 1 || stepNumber > PlayerState.totalSteps) return;

  // Clear timers
  if (PlayerState.stepTimer) {
    clearTimeout(PlayerState.stepTimer);
    PlayerState.stepTimer = null;
  }
  window.Typewriter.cancelAll();
  window.AudioEngine.stopSpeech();

  PlayerState.currentStepIndex = stepNumber;
  updateStepPillsUI(stepNumber);
  updateScrubberUI();

  // If Step 3 and not cached yet, make dynamic API call!
  if (stepNumber === 3 && !PlayerState.cachedSteps[3]) {
    await fetchDynamicStep3();
  }

  const stepData = PlayerState.cachedSteps[stepNumber];
  if (!stepData) return;

  renderStepView(stepData);
  runStepPresentation(stepData);
}

// Dynamic API Call for Step 3
async function fetchDynamicStep3() {
  PlayerState.isGeneratingApi = true;
  DOM.apiOverlay.style.display = 'flex';
  DOM.apiOverlayText.textContent = "⚡ Calling Lesson Engine API: POST /api/lesson/generate-step...";
  window.AudioEngine.playBeep(440, 0.1);

  const startTime = Date.now();
  const generated = await window.LessonAPI.generateStep(3, PlayerState.language);

  // Smooth perception delay so student appreciates dynamic synthesis
  const elapsed = Date.now() - startTime;
  if (elapsed < 600) {
    await new Promise(r => setTimeout(r, 600 - elapsed));
  }

  DOM.apiOverlay.style.display = 'none';
  PlayerState.isGeneratingApi = false;

  if (generated && generated.step === 3) {
    PlayerState.cachedSteps[3] = generated;
    const pill3 = document.getElementById('step-pill-3');
    if (pill3) {
      pill3.classList.remove('pill-api-badge');
      pill3.innerHTML = '<span>Step 3: Watching Memory Move</span> <span style="font-size:9px; background:#34d399; color:#09090b; padding:1px 5px; border-radius:3px;">LIVE API</span>';
    }
    window.AudioEngine.playWhoosh();
  }
}

// Render HTML layout for each step inside fixed blackboard
function renderStepView(stepData) {
  const isTelugish = PlayerState.language === 'telugish';
  const title = isTelugish ? stepData.title_telugish : stepData.title_en;
  const desc = isTelugish ? stepData.subtitle_telugish : stepData.subtitle_en;

  DOM.stepBadge.textContent = `STEP 0${stepData.step} // ${stepData.status === 'dynamically-generated' ? 'DYNAMIC ON-DEMAND API' : 'CORE PRINCIPLES'}`;
  DOM.stepTitle.innerHTML = title;
  DOM.stepDesc.innerHTML = desc;

  DOM.bodyMount.innerHTML = '';

  if (stepData.step === 1) {
    // Step 1: Two Rooms + 30-Sec Mystery
    const c1 = stepData.cards[0];
    const c2 = stepData.cards[1];
    const pz = stepData.puzzle;

    DOM.bodyMount.innerHTML = `
      <div class="step1-grid">
        <div class="room-card room-desk" id="card-desk">
          <div>
            <div class="room-badge">${c1.badge}</div>
            <div class="room-title">${isTelugish ? c1.title_telugish : c1.title_en}</div>
            <div class="room-desc" id="c1-desc">${isTelugish ? c1.desc_telugish : c1.desc_en}</div>
          </div>
          <div style="font-size:11px; color:#818cf8; font-family:var(--font-mono); margin-top:8px;">
            Speed: 0.001ms Allocation &bull; LIFO Frame Cleanup
          </div>
        </div>

        <div class="room-card room-warehouse" id="card-warehouse">
          <div>
            <div class="room-badge">${c2.badge}</div>
            <div class="room-title">${isTelugish ? c2.title_telugish : c2.title_en}</div>
            <div class="room-desc" id="c2-desc">${isTelugish ? c2.desc_telugish : c2.desc_en}</div>
          </div>
          
          <div class="puzzle-box">
            <div style="font-size:10.5px; font-weight:800; color:var(--accent-amber); font-family:var(--font-mono);">${pz.badge}</div>
            <pre class="code-snippet" style="margin:4px 0;">${pz.code}</pre>
            <div style="font-size:11.5px; color:#fafafa; margin-top:4px;">${isTelugish ? pz.question_telugish : pz.question_en}</div>
          </div>
        </div>
      </div>
    `;
  } else if (stepData.step === 2) {
    // Step 2: TV Remote & Smart TV
    DOM.bodyMount.innerHTML = `
      <div class="step2-sandbox" id="step2-sandbox">
        <svg id="laser-wire-svg"></svg>
        <div class="remotes-column">
          <div class="remote-box remote-active" id="remote-box-1">
            <div class="remote-header">
              <span>${stepData.remote1.name}</span>
              <span class="freq-tag">${stepData.remote1.freq}</span>
            </div>
            <code class="code-snippet">${stepData.remote1.decl}</code>
            <div class="remote-actions">
              <button class="btn-remote-action" onclick="userTuneTv(1)">Age + 1</button>
              <button class="btn-remote-action" onclick="userRenameTv('Rocky')">Rename ("Rocky")</button>
            </div>
          </div>

          <div class="remote-box" id="remote-box-2">
            <div class="remote-header">
              <span>${stepData.remote2.name}</span>
              <span class="freq-tag">${stepData.remote2.freq}</span>
            </div>
            <code class="code-snippet">${stepData.remote2.decl}</code>
            <div class="remote-actions">
              <button class="btn-remote-action" onclick="userTuneTv(1)">Age + 1 (Via Remote 2)</button>
              <button class="btn-remote-action" onclick="userDisconnectRemote(2)">Nullify Remote 2</button>
            </div>
          </div>
        </div>

        <div class="tv-column">
          <div class="smart-tv-device" id="smart-tv-box">
            <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:800; color:var(--accent-emerald); font-family:var(--font-mono);">
              <span>${stepData.tv.label}</span>
              <span>${stepData.tv.address}</span>
            </div>
            <div class="tv-screen-content">
              <div>Dog Name: <strong id="tv-name-val" style="color:var(--accent-blue);">"${stepData.tv.name}"</strong></div>
              <div>Dog Age:&nbsp; <strong id="tv-age-val" style="color:var(--accent-amber);">${stepData.tv.age}</strong></div>
              <div style="font-size:10px; color:#71717a; margin-top:6px;">Active Remotes Pointing Here: <span id="tv-remotes-count" style="color:var(--accent-emerald); font-weight:800;">2</span></div>
            </div>
          </div>
          <div style="margin-top:12px; font-size:11.5px; background:#0d0d11; border:1px solid #27272a; border-radius:6px; padding:8px 12px; color:#cbd5e1;">
            ${isTelugish ? stepData.goldenAnchor_telugish : stepData.goldenAnchor_en}
          </div>
        </div>
      </div>
    `;

    setTimeout(drawRemoteLaserBeams, 60);
  } else if (stepData.step === 3) {
    // Step 3: JVMS Dual IDE & Live Memory Visualizer
    DOM.bodyMount.innerHTML = `
      <div class="step3-ide-grid">
        <div class="ide-editor-panel">
          <div style="display:flex; justify-content:space-between; color:#71717a; font-size:10px; margin-bottom:6px; border-bottom:1px solid #27272a; padding-bottom:4px;">
            <span>MemoryMasterclass.java</span>
            <span id="ide-active-frame-lbl" style="color:var(--accent-blue);">FRAME: main()</span>
          </div>
          <div id="code-rows-container">
            ${stepData.codeLines.map(l => `<div class="code-line-row" id="line-${l.num}"><span style="color:#64748b; width:18px;">${l.num}</span><span>${escapeHtml(l.text)}</span></div>`).join('')}
          </div>
          <div style="margin-top:auto; padding-top:8px; border-top:1px solid #27272a; font-size:11.5px; color:#ffffff; font-weight:700;" id="ide-step-explainer">
            Step 1: main() initialized on top of the Call Stack.
          </div>
        </div>

        <div class="mem-inspector-panel">
          <div class="mem-card-slot" style="border-left:3px solid var(--accent-indigo);">
            <div class="mem-slot-header" style="color:var(--accent-indigo);">
              <span>CALL STACK (JVMS §2.6 LIFO FRAMES)</span>
              <span>RSP Pointer</span>
            </div>
            <div id="stack-slot-body" style="display:flex; flex-direction:column; gap:6px;"></div>
          </div>

          <div class="mem-card-slot" style="border-left:3px solid var(--accent-emerald);">
            <div class="mem-slot-header" style="color:var(--accent-emerald);">
              <span>HEAP STORAGE (JVMS §2.5.3 OBJECTS)</span>
              <span>Dynamic Pool</span>
            </div>
            <div id="heap-slot-body" style="display:flex; flex-direction:column; gap:6px;"></div>
          </div>
        </div>
      </div>
    `;

    PlayerState.ideSubStep = 0;
    renderIdeSubStep(0);
  }
}

// 3. STEP PRESENTATION RUNNER (Live Typewriter & Speech)
function runStepPresentation(stepData) {
  const isTelugish = PlayerState.language === 'telugish';
  const narration = isTelugish ? stepData.narration_telugish : stepData.narration_en;
  const title = isTelugish ? stepData.title_telugish : stepData.title_en;
  const desc = isTelugish ? stepData.subtitle_telugish : stepData.subtitle_en;

  // Stream header letter-by-letter live
  window.Typewriter.stream('step-title-live', title, 16, () => {
    window.Typewriter.stream('step-desc-live', desc, 14);
  });

  // Set live teleprompter caption
  setSubtitleText(narration);

  // Audio speech with soak pause
  window.AudioEngine.speak(narration, PlayerState.language, () => {
    if (!PlayerState.isPlaying) return;

    if (PlayerState.stepByStepMode) {
      // Step-by-Step Mode: Auto-pause gracefully
      pausePlayback();
      setSubtitleText(`✨ Step ${stepData.step} Complete • Press [→] or Space for Next Step ▶`);
      return;
    }

    // Continuous Mode: Grant 5 seconds of calm absorption soak pause
    const soakTime = 5000 / PlayerState.playbackSpeed;
    PlayerState.stepTimer = setTimeout(() => {
      if (PlayerState.isPlaying) {
        if (PlayerState.currentStepIndex < PlayerState.totalSteps) {
          loadAndRenderStep(PlayerState.currentStepIndex + 1);
        } else {
          pausePlayback();
          setSubtitleText("JAVA MEMORY MASTERCLASS COMPLETE // CONGRATULATIONS!");
        }
      }
    }, soakTime);
  });
}

// 4. INTERACTIVE STEP MANIPULATIVES
function userTuneTv(delta) {
  const ageEl = document.getElementById('tv-age-val');
  if (!ageEl) return;
  let cur = parseInt(ageEl.textContent, 10) || 3;
  cur += delta;
  ageEl.textContent = cur;
  window.AudioEngine.playBeep(640, 0.08);
  flashLaserBeam();
}

function userRenameTv(newName) {
  const nameEl = document.getElementById('tv-name-val');
  if (!nameEl) return;
  nameEl.textContent = `"${newName}"`;
  window.AudioEngine.playBeep(580, 0.08);
  flashLaserBeam();
}

function userDisconnectRemote(remoteNum) {
  const rem = document.getElementById('remote-box-' + remoteNum);
  const countEl = document.getElementById('tv-remotes-count');
  if (rem) rem.style.opacity = '0.35';
  if (countEl) countEl.textContent = '1';
  clearLaserBeams();
  drawSingleLaser('remote-box-1', 'smart-tv-box');
  window.AudioEngine.playBeep(320, 0.1);
}

function drawRemoteLaserBeams() {
  const svg = document.getElementById('laser-wire-svg');
  if (!svg) return;
  svg.innerHTML = '';
  drawSingleLaser('remote-box-1', 'smart-tv-box');
  const rem2 = document.getElementById('remote-box-2');
  if (rem2 && rem2.style.opacity !== '0.35') {
    drawSingleLaser('remote-box-2', 'smart-tv-box');
  }
}

function drawSingleLaser(fromId, toId) {
  const svg = document.getElementById('laser-wire-svg');
  const fromEl = document.getElementById(fromId);
  const toEl = document.getElementById(toId);
  const parent = document.getElementById('step2-sandbox');
  if (!svg || !fromEl || !toEl || !parent) return;

  const pRect = parent.getBoundingClientRect();
  const fRect = fromEl.getBoundingClientRect();
  const tRect = toEl.getBoundingClientRect();

  const x1 = fRect.right - pRect.left;
  const y1 = fRect.top + fRect.height / 2 - pRect.top;
  const x2 = tRect.left - pRect.left;
  const y2 = tRect.top + tRect.height / 2 - pRect.top;

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', '#38bdf8');
  line.setAttribute('stroke-width', '2');
  line.setAttribute('stroke-dasharray', '4,4');
  svg.appendChild(line);
}

function flashLaserBeam() {
  const svg = document.getElementById('laser-wire-svg');
  if (!svg) return;
  svg.querySelectorAll('line').forEach(l => {
    l.setAttribute('stroke', '#34d399');
    l.setAttribute('stroke-width', '3');
    setTimeout(() => {
      l.setAttribute('stroke', '#38bdf8');
      l.setAttribute('stroke-width', '2');
    }, 250);
  });
}

function clearLaserBeams() {
  const svg = document.getElementById('laser-wire-svg');
  if (svg) svg.innerHTML = '';
}

// Render Step 3 Sub-steps
function renderIdeSubStep(subStepIdx) {
  const stepData = PlayerState.cachedSteps[3];
  if (!stepData || !stepData.executionSteps) return;

  const sub = stepData.executionSteps[subStepIdx];
  if (!sub) return;

  // Highlight active code row
  document.querySelectorAll('.code-line-row').forEach(r => r.classList.remove('line-active'));
  const lineEl = document.getElementById('line-' + sub.activeLine);
  if (lineEl) lineEl.classList.add('line-active');

  const frameEl = document.getElementById('ide-active-frame-lbl');
  if (frameEl) frameEl.textContent = sub.frameName;

  const explEl = document.getElementById('ide-step-explainer');
  const isTelugish = PlayerState.language === 'telugish';
  if (explEl) explEl.textContent = isTelugish ? sub.explainer_telugish : sub.explainer_en;

  // Render Stack Slot Items
  const stackBody = document.getElementById('stack-slot-body');
  if (stackBody) {
    stackBody.innerHTML = sub.stack.map(item => `
      <div style="background:${item.highlight ? 'rgba(56, 189, 248, 0.16)' : '#0d0d11'}; border:1px solid ${item.highlight ? 'var(--accent-blue)' : '#27272a'}; border-radius:4px; padding:6px 10px; display:flex; justify-content:space-between; font-size:11px;">
        <span style="color:#ffffff; font-weight:700;">${item.name}</span>
        <span style="color:var(--accent-blue);">${item.val}</span>
      </div>
    `).join('');
  }

  // Render Heap Slot Items
  const heapBody = document.getElementById('heap-slot-body');
  if (heapBody) {
    heapBody.innerHTML = sub.heap.map(obj => `
      <div style="background:${obj.orphan ? 'rgba(244, 63, 94, 0.12)' : 'rgba(52, 211, 153, 0.12)'}; border:1px solid ${obj.orphan ? 'var(--accent-rose)' : 'var(--accent-emerald)'}; border-radius:6px; padding:8px 10px; font-size:11px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
          <span style="color:${obj.orphan ? 'var(--accent-rose)' : 'var(--accent-emerald)'}; font-weight:800;">${obj.addr}</span>
          <span style="color:#94a3b8;">${obj.type}</span>
        </div>
        <div style="color:#ffffff;">${obj.desc}</div>
      </div>
    `).join('');
  }
}

// 5. PLAYER TRANSPORT CONTROLLERS
function togglePlayPause() {
  if (PlayerState.isPlaying) {
    pausePlayback();
  } else {
    resumePlayback();
  }
}

function resumePlayback() {
  PlayerState.isPlaying = true;
  updatePlayPauseIconUI();
  const curStep = PlayerState.cachedSteps[PlayerState.currentStepIndex];
  if (curStep) runStepPresentation(curStep);
}

function pausePlayback() {
  PlayerState.isPlaying = false;
  updatePlayPauseIconUI();
  if (PlayerState.stepTimer) {
    clearTimeout(PlayerState.stepTimer);
    PlayerState.stepTimer = null;
  }
  window.AudioEngine.stopSpeech();
}

function stepForward() {
  if (PlayerState.currentStepIndex < PlayerState.totalSteps) {
    loadAndRenderStep(PlayerState.currentStepIndex + 1);
  }
}

function stepBackward() {
  if (PlayerState.currentStepIndex > 1) {
    loadAndRenderStep(PlayerState.currentStepIndex - 1);
  }
}

function toggleStepMode() {
  PlayerState.stepByStepMode = !PlayerState.stepByStepMode;
  if (DOM.modeBtn && DOM.modeIcon && DOM.modeLabel) {
    if (PlayerState.stepByStepMode) {
      DOM.modeBtn.classList.add('mode-step-active');
      DOM.modeIcon.textContent = '⏸';
      DOM.modeLabel.textContent = 'Mode: Step-by-Step';
      setSubtitleText("STEP-BY-STEP MODE: Plays current step and pauses for exploration and discussion.");
    } else {
      DOM.modeBtn.classList.remove('mode-step-active');
      DOM.modeIcon.textContent = '📺';
      DOM.modeLabel.textContent = 'Mode: Continuous';
      setSubtitleText("CONTINUOUS MODE: Auto-plays through steps with 5-second absorption pauses.");
    }
  }
  window.AudioEngine.playBeep(480, 0.05);
}

function setPlaybackSpeed(speed) {
  PlayerState.playbackSpeed = speed;
  document.querySelectorAll('.btn-speed-item').forEach(b => b.classList.remove('active-speed'));
  if (event && event.target) event.target.classList.add('active-speed');
  if (PlayerState.isPlaying) {
    resumePlayback();
  }
}

function setLanguage(lang) {
  PlayerState.language = lang;
  document.querySelectorAll('.btn-lang').forEach(b => b.classList.remove('active-lang'));
  const btn = document.getElementById('lang-' + lang);
  if (btn) btn.classList.add('active-lang');

  const curStep = PlayerState.cachedSteps[PlayerState.currentStepIndex];
  if (curStep) {
    renderStepView(curStep);
    if (PlayerState.isPlaying) runStepPresentation(curStep);
  }
  window.AudioEngine.playBeep(440, 0.05);
}

// 6. UI UPDATERS
function updateStepPillsUI(activeStep) {
  document.querySelectorAll('.step-pill-btn').forEach(b => b.classList.remove('pill-active'));
  const pill = document.getElementById('step-pill-' + activeStep);
  if (pill) pill.classList.add('pill-active');
}

function updatePlayPauseIconUI() {
  const icon = document.getElementById('play-pause-icon');
  if (!icon) return;
  icon.innerHTML = PlayerState.isPlaying 
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
}

function updateScrubberUI() {
  const pct = ((PlayerState.currentStepIndex - 1) / (PlayerState.totalSteps - 1)) * 100;
  if (DOM.scrubberFill) DOM.scrubberFill.style.width = Math.max(8, Math.min(100, pct)) + '%';
  if (DOM.timeCurrent) DOM.timeCurrent.textContent = `0${PlayerState.currentStepIndex}:00`;
}

function setSubtitleText(text) {
  if (DOM.subtitleText) {
    DOM.subtitleText.textContent = text;
  }
}

// 7. DRAGGABLE SUBTITLES (YouTube PIP Style)
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

function initDraggableSubtitles() {
  const card = document.getElementById('draggable-subtitles-card');
  const handle = document.getElementById('sub-drag-header');
  if (!card || !handle) return;

  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    isDragging = true;
    card.classList.add('is-dragging');
    const rect = card.getBoundingClientRect();
    dragStartX = e.clientX - rect.left;
    dragStartY = e.clientY - rect.top;

    card.style.transform = 'none';
    card.style.left = rect.left + 'px';
    card.style.top = rect.top + 'px';
    card.style.bottom = 'auto';

    try { handle.setPointerCapture(e.pointerId); } catch (err) {}
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    let newX = e.clientX - dragStartX;
    let newY = e.clientY - dragStartY;

    const maxX = window.innerWidth - card.offsetWidth - 10;
    const maxY = window.innerHeight - card.offsetHeight - 10;
    newX = Math.max(10, Math.min(newX, maxX));
    newY = Math.max(10, Math.min(newY, maxY));

    card.style.left = newX + 'px';
    card.style.top = newY + 'px';
  });

  const stopDrag = (e) => {
    if (isDragging) {
      isDragging = false;
      card.classList.remove('is-dragging');
      try { handle.releasePointerCapture(e.pointerId); } catch (err) {}
    }
  };

  window.addEventListener('pointerup', stopDrag);
  window.addEventListener('pointercancel', stopDrag);
}

function resetSubtitlePosition() {
  const card = document.getElementById('draggable-subtitles-card');
  if (!card) return;
  card.style.top = 'auto';
  card.style.bottom = '20px';
  card.style.left = '50%';
  card.style.transform = 'translateX(-50%)';
  window.AudioEngine.playBeep(520, 0.05);
}

function toggleSubtitlesVisible() {
  PlayerState.subtitlesVisible = !PlayerState.subtitlesVisible;
  const card = document.getElementById('draggable-subtitles-card');
  if (card) card.style.display = PlayerState.subtitlesVisible ? 'block' : 'none';
}

function toggleSubtitleSize() {
  PlayerState.subtitlesExpanded = !PlayerState.subtitlesExpanded;
  const card = document.getElementById('draggable-subtitles-card');
  if (card) {
    card.style.maxWidth = PlayerState.subtitlesExpanded ? '920px' : '680px';
    const body = card.querySelector('.sub-body');
    if (body) body.style.fontSize = PlayerState.subtitlesExpanded ? '15px' : '12.5px';
  }
}

// 8. KEYBOARD SHORTCUTS
function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      stepForward();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      stepBackward();
    } else if (e.key === '1') {
      loadAndRenderStep(1);
    } else if (e.key === '2') {
      loadAndRenderStep(2);
    } else if (e.key === '3') {
      loadAndRenderStep(3);
    } else if (e.key.toLowerCase() === 'm') {
      toggleStepMode();
    } else if (e.key.toLowerCase() === 'c') {
      toggleSubtitlesVisible();
    }
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Auto-boot on DOM ready
document.addEventListener('DOMContentLoaded', bootPlayerApp);

