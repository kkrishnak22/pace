// d:\pace\client\js\app.js
// Visual Lesson Engine: Real-Time Word-Driven Screen Sync, Dual-View (Metaphor + RAM), Standardized HUD

const PlayerState = {
  manifest: null,
  currentStepIndex: 1,
  totalSteps: 3,
  isPlaying: false,
  stepByStepMode: false,
  language: 'en',
  playbackSpeed: 1.0,
  visualMode: 'metaphor', // 'metaphor' or 'ram'
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
  DOM.hudTooltip = document.getElementById('global-hud-tooltip');
  DOM.modalBackdrop = document.getElementById('deepdive-backdrop');
  DOM.deepdiveModal = document.getElementById('deepdive-modal');
}

function clearAllActiveTimers() {
  if (PlayerState.stepTimer) {
    clearTimeout(PlayerState.stepTimer);
    PlayerState.stepTimer = null;
  }
  clearSyncFocusClasses();
}

function clearSyncFocusClasses() {
  document.querySelectorAll('.sync-focused, .sync-focused-emerald, .sync-focused-amber')
    .forEach(el => el.classList.remove('sync-focused', 'sync-focused-emerald', 'sync-focused-amber'));
  document.querySelectorAll('.sync-text-highlight')
    .forEach(el => el.classList.remove('sync-text-highlight'));
  lastFocusedContainerId = null;
}

// 1. BOOT SEQUENCE
async function bootPlayerApp() {
  initDomReferences();
  initDraggableSubtitles();
  initKeyboardShortcuts();
  initHudMouseListeners();

  console.log('[PlayerApp] Booting visual lesson player engine...');

  // 1. Fetch Manifest
  const manifest = await window.LessonAPI.fetchManifest();
  if (manifest) {
    PlayerState.manifest = manifest;
    PlayerState.totalSteps = manifest.totalSteps || (manifest.stepsSummary ? manifest.stepsSummary.length : 3);
    const titleEl = document.getElementById('lesson-header-title');
    if (titleEl) titleEl.textContent = manifest.title_en;
    renderDynamicStepPills(manifest);
    updateScrubberUI();
  }

  // 2. Pre-fetch Step 1 and Step 2
  const [s1, s2] = await Promise.all([
    window.LessonAPI.fetchStep(1),
    window.LessonAPI.fetchStep(2)
  ]);

  if (s1) PlayerState.cachedSteps[1] = s1;
  if (s2) PlayerState.cachedSteps[2] = s2;

  // 3. Render initial Step 1 in ready state
  loadAndRenderStep(1, false);
}

// Dynamically Render Step Navigation Pills for Any Arbitrary Number of Steps N
function renderDynamicStepPills(manifest) {
  const container = document.getElementById('step-pills-container');
  if (!container || !manifest) return;
  container.innerHTML = '';

  const total = manifest.totalSteps || (manifest.stepsSummary ? manifest.stepsSummary.length : 3);
  const steps = (manifest.stepsSummary && manifest.stepsSummary.length > 0)
    ? manifest.stepsSummary
    : Array.from({ length: total }, (_, i) => ({
        step: i + 1,
        title_en: `Step ${i + 1}`,
        status: (i + 1 > 2) ? 'on-demand-api' : 'preloaded'
      }));

  steps.forEach(s => {
    const btn = document.createElement('button');
    btn.className = `step-pill-btn ${s.step === PlayerState.currentStepIndex ? 'pill-active' : ''}`;
    btn.id = `step-pill-${s.step}`;
    btn.onclick = () => loadAndRenderStep(s.step, true);

    const isTelugish = PlayerState.language === 'telugish';
    const title = (isTelugish && s.title_telugish) ? s.title_telugish : (s.title_en || `Step ${s.step}`);

    if (s.status === 'on-demand-api') {
      const isCached = !!PlayerState.cachedSteps[s.step];
      btn.innerHTML = `<span>${escapeHtml(title)}</span> <span class="pill-api-badge" style="${isCached ? 'background:#34d399;' : ''}">${isCached ? 'LIVE API' : 'ON-DEMAND API'}</span>`;
    } else {
      btn.innerHTML = `<span>${escapeHtml(title)}</span>`;
    }

    container.appendChild(btn);
  });
}

// 2. STEP RENDERER & ORCHESTRATION
async function loadAndRenderStep(stepNumber, autoStart = true) {
  if (stepNumber < 1 || stepNumber > PlayerState.totalSteps) return;

  clearAllActiveTimers();
  window.Typewriter.cancelAll();
  window.AudioEngine.stopSpeech();
  hideHudTooltip();

  PlayerState.currentStepIndex = stepNumber;
  updateStepPillsUI(stepNumber);
  updateScrubberUI();

  // If Step is not cached yet, fetch on-demand via dynamic API!
  if (!PlayerState.cachedSteps[stepNumber]) {
    await fetchDynamicStep(stepNumber);
  }

  const stepData = PlayerState.cachedSteps[stepNumber];
  if (!stepData) return;

  renderStepView(stepData);

  if (autoStart) {
    PlayerState.isPlaying = true;
    updatePlayPauseIconUI();
    runStepPresentation(stepData);
  } else {
    // Show ready state with cards visible so user/teacher can pause and read
    const isTelugish = PlayerState.language === 'telugish';
    setSubtitleText(isTelugish ? stepData.narration_telugish : stepData.narration_en);
    document.querySelectorAll('.staged-element, .staged-from-left, .staged-from-right, .staged-pop')
      .forEach(el => el.classList.add('revealed'));
    if (stepNumber === 2) {
      setTimeout(drawRemoteLaserBeams, 60);
    }
  }
}

// Dynamic On-Demand API Call for any Step N
async function fetchDynamicStep(stepNumber) {
  PlayerState.isGeneratingApi = true;
  if (DOM.apiOverlay) DOM.apiOverlay.style.display = 'flex';
  if (DOM.apiOverlayText) {
    DOM.apiOverlayText.textContent = `⚡ Calling Lesson Engine API: POST /api/lesson/generate-step (Step ${stepNumber})...`;
  }
  window.AudioEngine.playBeep(440, 0.1);

  const startTime = Date.now();
  const generated = await window.LessonAPI.generateStep(
    stepNumber,
    PlayerState.language,
    PlayerState.manifest?.id || 'java-memory'
  );

  const elapsed = Date.now() - startTime;
  if (elapsed < 600) {
    await new Promise(r => setTimeout(r, 600 - elapsed));
  }

  if (DOM.apiOverlay) DOM.apiOverlay.style.display = 'none';
  PlayerState.isGeneratingApi = false;

  if (generated && generated.step === stepNumber) {
    PlayerState.cachedSteps[stepNumber] = generated;
    const pill = document.getElementById(`step-pill-${stepNumber}`);
    if (pill) {
      const badge = pill.querySelector('.pill-api-badge');
      if (badge) {
        badge.style.background = '#34d399';
        badge.textContent = 'LIVE API';
      }
    }
    window.AudioEngine.playWhoosh();
  }
}

const fetchDynamicStep3 = () => fetchDynamicStep(3);

// DUAL SYNCHRONOUS WORD HIGHLIGHTING & INTERACTIVE CONCEPT TERMS
function formatScreenTextWithTerms(text) {
  if (!text) return '';
  const termPatterns = [
    { pattern: /\b(int age = 21|int age = 3|localAge|age)\b/gi, key: 'variable-primitive', cls: 'term-var' },
    { pattern: /\b(Dog dog|Dog d2|Dog d|Dog instance|Dog|dog|d2|d)\b/gi, key: 'object-reference', cls: 'term-obj' },
    { pattern: /\b(new Dog|new)\b/gi, key: 'new-keyword', cls: 'term-keyword' },
    { pattern: /\b(Stack Memory|Stack Desk|Stack trays|Call Stack|Stack)\b/gi, key: 'stack-memory', cls: 'term-mem' },
    { pattern: /\b(Heap Memory|Heap Warehouse|Heap Pool|Heap shelves|Heap)\b/gi, key: 'heap-memory', cls: 'term-mem' },
    { pattern: /\b(0x4A2F|0x7B9C|0x1000)\b/gi, key: 'memory-address', cls: 'term-mem' },
    { pattern: /\b(Aliasing|remote control|duplicate remote|TV remote)\b/gi, key: 'aliasing', cls: 'term-obj' },
    { pattern: /\b(Pass-by-Value|pass-by-value)\b/gi, key: 'pass-by-value', cls: 'term-var' },
    { pattern: /\b(Garbage Collector|GC)\b/gi, key: 'garbage-collector', cls: 'term-mem' },
    { pattern: /\b(StackOverflowError)\b/gi, key: 'stackoverflow-error', cls: 'term-error' },
    { pattern: /\b(OutOfMemoryError)\b/gi, key: 'outofmemory-error', cls: 'term-error' }
  ];

  const words = text.split(/(\s+)/);
  return words.map(w => {
    if (/^\s+$/.test(w)) return w;
    const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const item of termPatterns) {
      if (item.pattern.test(w)) {
        item.pattern.lastIndex = 0;
        return `<span class="screen-word concept-term ${item.cls}" data-clean="${clean}" onclick="openConceptPathway('${item.key}')" title="Click for Multi-Tab Concept Pathway">${escapeHtml(w)}</span>`;
      }
    }
    return `<span class="screen-word" data-clean="${clean}">${escapeHtml(w)}</span>`;
  }).join('');
}

function highlightScreenWords(wordStr) {
  if (!wordStr) return;
  const clean = wordStr.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!clean || clean.length < 2) return;

  const stage = document.getElementById('stage-body-mount');
  if (!stage) return;

  stage.querySelectorAll('.screen-word.word-active').forEach(el => {
    el.classList.remove('word-active');
    el.classList.add('word-spoken');
  });

  const matches = stage.querySelectorAll(`.screen-word[data-clean="${clean}"]`);
  matches.forEach(el => {
    const parentCard = el.closest('.revealed, .ide-editor-panel, .smart-tv-device');
    if (parentCard) {
      el.classList.add('word-active');
    }
  });
}

// Render HTML layout for each step inside fixed blackboard
function renderStepView(stepData) {
  const isTelugish = PlayerState.language === 'telugish';
  const isRamView = PlayerState.visualMode === 'ram';
  const title = isTelugish ? stepData.title_telugish : stepData.title_en;
  const desc = isTelugish ? stepData.subtitle_telugish : stepData.subtitle_en;

  DOM.stepBadge.textContent = `STEP 0${stepData.step} // ${stepData.status === 'dynamically-generated' ? 'DYNAMIC ON-DEMAND API' : 'CORE PRINCIPLES'}`;
  DOM.stepTitle.innerHTML = formatScreenTextWithTerms(title);
  DOM.stepDesc.innerHTML = formatScreenTextWithTerms(desc);

  DOM.bodyMount.innerHTML = '';

  if (stepData.step === 1) {
    const c1 = stepData.cards[0];
    const c2 = stepData.cards[1];
    const pz = stepData.puzzle;

    if (isRamView) {
      // Physical RAM View (Real Computer Memory Reality)
      DOM.bodyMount.innerHTML = `
        <div class="step1-grid">
          <div class="room-card room-desk staged-from-left revealed" id="card-desk">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="room-badge" style="color:var(--accent-indigo);">PHYSICAL RAM // CALL STACK FRAME</div>
                <button class="info-bubble-btn" data-hud-topic="stack-memory" onclick="toggleHudTooltip(event, 'stack-memory')" title="Click for Stack Explainer">i</button>
              </div>
              <div class="room-title">CPU Stack Memory (RSP Pointer)</div>
              <div style="font-family:var(--font-mono); font-size:11px; background:#09090b; border:1px solid #27272a; border-radius:6px; padding:8px 10px; margin:8px 0;">
                <div style="color:#71717a; margin-bottom:4px;">Thread 1 &bull; main() Stack Frame (LIFO):</div>
                <div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid #18181b;">
                  <span style="color:#ffffff;">Slot 0: int age</span>
                  <span style="color:var(--accent-blue);">${formatScreenTextWithTerms("21 (Direct 32-bit Value)")}</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding:3px 0;">
                  <span style="color:#ffffff;">Slot 1: Dog dog</span>
                  <span style="color:var(--accent-emerald);">${formatScreenTextWithTerms("0x4A2F (64-bit Heap Pointer)")}</span>
                </div>
              </div>
            </div>
            <div id="c1-stats-pill" style="font-size:11px; color:#818cf8; font-family:var(--font-mono); margin-top:8px; padding:4px 8px; border-radius:4px; background:rgba(129,140,248,0.08); border:1px solid rgba(129,140,248,0.2);">
              Speed: 0.001ms (CPU Hardware RSP Register) &bull; If Full: StackOverflowError
            </div>
          </div>

          <div class="room-card room-warehouse staged-from-right revealed" id="card-warehouse">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="room-badge" style="color:var(--accent-emerald);">PHYSICAL RAM // HEAP STORAGE POOL</div>
                <button class="info-bubble-btn" data-hud-topic="heap-memory" onclick="toggleHudTooltip(event, 'heap-memory')" title="Click for Heap Explainer">i</button>
              </div>
              <div class="room-title">Heap Memory Object Pool (RAM Shelf)</div>
              <div style="font-family:var(--font-mono); font-size:11px; background:#09090b; border:1px solid #27272a; border-radius:6px; padding:8px 10px; margin:8px 0;">
                <div style="display:flex; justify-content:space-between; color:var(--accent-emerald); font-weight:800; margin-bottom:4px;">
                  <span>Shelf Address: 0x4A2F</span>
                  <span>24 Bytes Allocated</span>
                </div>
                <div style="padding:2px 0; color:#94a3b8;">[64-bit Mark Word: HashCode &bull; GC Age 1]</div>
                <div style="padding:2px 0; color:#94a3b8;">[64-bit Klass Word: Pointer to Dog.class]</div>
                <div style="padding:4px 0; color:#ffffff; border-top:1px solid #18181b; margin-top:2px;">
                  Field 'name' &rarr; <span style="color:var(--accent-blue);">"Bruno"</span> &bull; Field 'age' &rarr; <span style="color:var(--accent-amber);">3</span>
                </div>
              </div>
            </div>
            <div class="puzzle-box staged-pop revealed" id="card-puzzle">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:var(--accent-amber); font-weight:800; font-family:var(--font-mono); font-size:10px;">JVMS MEMORY MAPPING</span>
                <button class="info-bubble-btn" data-hud-topic="mystery-puzzle" onclick="toggleHudTooltip(event, 'mystery-puzzle')">i</button>
              </div>
              <div style="font-size:11.5px; color:#fafafa; margin-top:4px; line-height:1.4;">
                ${formatScreenTextWithTerms("Stack slot holds 0x4A2F (bits). Heap shelf holds instance payload. Java always copies the bits in the stack slot!")}
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      // Intuitive Metaphor View (Desk & Warehouse)
      DOM.bodyMount.innerHTML = `
        <div class="step1-grid">
          <div class="room-card room-desk staged-from-left" id="card-desk">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="room-badge">${c1.badge}</div>
                <button class="info-bubble-btn" data-hud-topic="stack-memory" onclick="toggleHudTooltip(event, 'stack-memory')" title="Click for Simple English Explainer">i</button>
              </div>
              <div class="room-title">${formatScreenTextWithTerms(isTelugish ? c1.title_telugish : c1.title_en)}</div>
              <div class="room-desc" id="c1-desc">${formatScreenTextWithTerms(isTelugish ? c1.desc_telugish : c1.desc_en)}</div>
            </div>
            <div id="c1-stats-pill" style="font-size:11px; color:#818cf8; font-family:var(--font-mono); margin-top:8px; padding:4px 8px; border-radius:4px; background:rgba(129,140,248,0.08); border:1px solid rgba(129,140,248,0.2);">
              ${c1.stats}
            </div>
          </div>

          <div class="room-card room-warehouse staged-from-right" id="card-warehouse">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="room-badge">${c2.badge}</div>
                <button class="info-bubble-btn" data-hud-topic="heap-memory" onclick="toggleHudTooltip(event, 'heap-memory')" title="Click for Simple English Explainer">i</button>
              </div>
              <div class="room-title">${formatScreenTextWithTerms(isTelugish ? c2.title_telugish : c2.title_en)}</div>
              <div class="room-desc" id="c2-desc">${formatScreenTextWithTerms(isTelugish ? c2.desc_telugish : c2.desc_en)}</div>
            </div>
            
            <div class="puzzle-box staged-pop" id="card-puzzle">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <div style="font-size:10.5px; font-weight:800; color:var(--accent-amber); font-family:var(--font-mono);">${pz.badge}</div>
                <button class="info-bubble-btn" data-hud-topic="mystery-puzzle" onclick="toggleHudTooltip(event, 'mystery-puzzle')" title="Reveal Secret Answer">i</button>
              </div>
              <pre class="code-snippet" id="puzzle-code-line" style="margin:4px 0; padding:6px; border-radius:4px;">${formatScreenTextWithTerms(pz.code)}</pre>
              <div id="puzzle-question-text" style="font-size:11.5px; color:#fafafa; margin-top:6px; line-height:1.4;">${formatScreenTextWithTerms(isTelugish ? pz.question_telugish : pz.question_en)}</div>
              <div style="margin-top:8px; display:flex; gap:8px;">
                <button onclick="revealPuzzleAnswer()" style="background:rgba(251,191,36,0.15); border:1px solid var(--accent-amber); color:var(--accent-amber); padding:4px 10px; border-radius:4px; font-size:10.5px; font-weight:800; cursor:pointer;">💡 Reveal Secret Answer</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  } else if (stepData.step === 2) {
    // Step 2: TV Remote & Smart TV
    DOM.bodyMount.innerHTML = `
      <div class="step2-sandbox" id="step2-sandbox">
        <svg id="laser-wire-svg"></svg>
        <div class="remotes-column">
          <div class="remote-box remote-active staged-from-left" id="remote-box-1">
            <div class="remote-header">
              <div style="display:flex; align-items:center; gap:6px;">
                <span>${stepData.remote1.name}</span>
                <button class="info-bubble-btn" data-hud-topic="tv-remote" onclick="toggleHudTooltip(event, 'tv-remote')" title="What is a TV Remote?">i</button>
              </div>
              <span class="freq-tag">${stepData.remote1.freq}</span>
            </div>
            <code class="code-snippet">${formatScreenTextWithTerms(stepData.remote1.decl)}</code>
            <div class="remote-actions">
              <button class="btn-remote-action" onclick="userTuneTv(1)">Age + 1</button>
              <button class="btn-remote-action" onclick="userRenameTv('Rocky')">Rename ("Rocky")</button>
            </div>
          </div>

          <div class="remote-box staged-from-left" id="remote-box-2">
            <div class="remote-header">
              <div style="display:flex; align-items:center; gap:6px;">
                <span>${stepData.remote2.name}</span>
                <button class="info-bubble-btn" data-hud-topic="aliasing" onclick="toggleHudTooltip(event, 'aliasing')" title="What is Aliasing?">i</button>
              </div>
              <span class="freq-tag">${stepData.remote2.freq}</span>
            </div>
            <code class="code-snippet">${formatScreenTextWithTerms(stepData.remote2.decl)}</code>
            <div class="remote-actions">
              <button class="btn-remote-action" onclick="userTuneTv(1)">Age + 1 (Via Remote 2)</button>
              <button class="btn-remote-action" onclick="userDisconnectRemote(2)">Nullify Remote 2</button>
            </div>
          </div>
        </div>

        <div class="tv-column">
          <div class="smart-tv-device staged-from-right" id="smart-tv-box">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:800; color:var(--accent-emerald); font-family:var(--font-mono);">
              <div style="display:flex; align-items:center; gap:6px;">
                <span>${stepData.tv.label}</span>
                <button class="info-bubble-btn" data-hud-topic="memory-address" onclick="toggleHudTooltip(event, 'memory-address')" title="What is address 0x4A2F?">i</button>
              </div>
              <span id="tv-hex-addr">${stepData.tv.address}</span>
            </div>
            <div class="tv-screen-content">
              <div>Dog Name: <strong id="tv-name-val" style="color:var(--accent-blue);">"${stepData.tv.name}"</strong></div>
              <div>Dog Age:&nbsp; <strong id="tv-age-val" style="color:var(--accent-amber);">${stepData.tv.age}</strong></div>
              <div style="font-size:10px; color:#71717a; margin-top:6px;">Active Remotes Pointing Here: <span id="tv-remotes-count" style="color:var(--accent-emerald); font-weight:800;">2</span></div>
            </div>
          </div>
          <div class="staged-pop" id="golden-rule-box" style="margin-top:12px; font-size:11.5px; background:#0d0d11; border:1px solid #27272a; border-radius:6px; padding:8px 12px; color:#cbd5e1; width:100%; position:relative;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-weight:800; color:var(--accent-amber); font-family:var(--font-mono); font-size:10px;">🌟 GOLDEN MEMORY LAW</span>
              <button class="info-bubble-btn" data-hud-topic="golden-rule" onclick="toggleHudTooltip(event, 'golden-rule')" title="Pass-by-Value Rule">i</button>
            </div>
            <div id="golden-rule-text">${formatScreenTextWithTerms(isTelugish ? stepData.goldenAnchor_telugish : stepData.goldenAnchor_en)}</div>
          </div>
        </div>
      </div>
    `;
  } else if (stepData.step === 3) {
    // Step 3: JVMS Dual IDE & Live Memory Visualizer
    DOM.bodyMount.innerHTML = `
      <div class="step3-ide-grid">
        <div class="ide-editor-panel staged-from-left" id="step3-ide-panel">
          <div style="display:flex; justify-content:space-between; color:#71717a; font-size:10px; margin-bottom:6px; border-bottom:1px solid #27272a; padding-bottom:4px;">
            <span>MemoryMasterclass.java</span>
            <span id="ide-active-frame-lbl" style="color:var(--accent-blue);">FRAME: main()</span>
          </div>
          <div id="code-rows-container">
            ${stepData.codeLines.map(l => `<div class="code-line-row" id="line-${l.num}"><span style="color:#64748b; width:18px;">${l.num}</span><span>${formatScreenTextWithTerms(l.text)}</span></div>`).join('')}
          </div>
          <div style="margin-top:auto; padding-top:8px; border-top:1px solid #27272a;">
            <div style="font-size:11.5px; color:#ffffff; font-weight:700;" id="ide-step-explainer">
              Step 1: main() initialized on top of the Call Stack.
            </div>
            <div style="font-size:10.5px; color:var(--accent-blue); font-family:var(--font-mono); margin-top:4px;" id="ide-token-breakdown">
              Token: int age = 3 &bull; Stored as 32-bit integer bits in Stack slot 1.
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding-top:6px; border-top:1px solid #27272a;">
              <div style="display:flex; gap:6px;">
                <button class="btn-ide-step" onclick="prevIdeSubStep()" title="Previous execution line">⏮ Prev Line</button>
                <button class="btn-ide-step" onclick="nextIdeSubStep()" title="Next execution line">Next Line ⏭</button>
              </div>
              <span style="font-size:10px; color:#71717a; font-family:var(--font-mono);" id="ide-step-counter">STEP 1 / 7</span>
            </div>
          </div>
        </div>

        <div class="mem-inspector-panel staged-from-right" id="step3-mem-panel">
          <div class="mem-card-slot" id="slot-call-stack" style="border-left:3px solid var(--accent-indigo);">
            <div class="mem-slot-header" style="color:var(--accent-indigo);">
              <span>CALL STACK (JVMS §2.6 LIFO FRAMES)</span>
              <span>RSP Pointer</span>
            </div>
            <div id="stack-slot-body" style="display:flex; flex-direction:column; gap:6px;"></div>
          </div>

          <div class="mem-card-slot" id="slot-heap-storage" style="border-left:3px solid var(--accent-emerald);">
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
  } else if (stepData.diagnostics) {
    // Dynamic Step View: Crash Diagnostics
    DOM.bodyMount.innerHTML = `
      <div class="step1-grid" style="grid-template-columns: 1fr 1fr; gap:16px;">
        ${stepData.diagnostics.map((d, idx) => `
          <div class="room-card staged-${idx === 0 ? 'from-left' : 'from-right'} revealed" id="${d.id}" style="display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="room-badge" style="color:${idx === 0 ? 'var(--accent-rose)' : 'var(--accent-amber)'};">${d.badge}</div>
                <button class="info-bubble-btn" data-hud-topic="golden-rule" onclick="toggleHudTooltip(event, 'golden-rule')">i</button>
              </div>
              <div class="room-title" style="color:${idx === 0 ? 'var(--accent-rose)' : 'var(--accent-amber)'};">${isTelugish ? d.title_telugish : d.title_en}</div>
              <pre class="code-snippet" style="margin:8px 0; padding:8px; border-radius:4px;">${escapeHtml(d.code)}</pre>
              <div class="room-desc">${isTelugish ? d.cause_telugish : d.cause_en}</div>
            </div>
            <div style="background:#09090b; border:1px solid #27272a; padding:6px 10px; border-radius:4px; font-family:var(--font-mono); font-size:11px; color:${idx === 0 ? 'var(--accent-rose)' : 'var(--accent-amber)'}; font-weight:700;">
              JVM Error: ${d.errorType}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (stepData.cards) {
    // Dynamic Step View: Generic Adaptive Cards
    DOM.bodyMount.innerHTML = `
      <div class="step1-grid">
        ${stepData.cards.map((c, idx) => `
          <div class="room-card staged-${idx === 0 ? 'from-left' : 'from-right'} revealed" id="${c.id || 'card-' + idx}">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="room-badge">${c.badge || `PHASE 0${stepData.step}`}</div>
              </div>
              <div class="room-title">${isTelugish ? (c.title_telugish || c.title_en) : c.title_en}</div>
              <div class="room-desc">${isTelugish ? (c.desc_telugish || c.desc_en) : c.desc_en}</div>
            </div>
            ${c.stats ? `<div style="font-size:11px; color:var(--accent-blue); font-family:var(--font-mono); margin-top:8px; padding:4px 8px; border-radius:4px; background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.2);">${c.stats}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }
}

// 3. STEP PRESENTATION RUNNER (Real-time Word-Driven Synchronization)
let currentSyncPhase = 0;
let lastFocusedContainerId = null;

function setFocusedVisual(containerId, textSpanId, focusClass) {
  if (lastFocusedContainerId === containerId) return;
  lastFocusedContainerId = containerId;

  clearSyncFocusClasses();

  if (containerId) {
    const el = document.getElementById(containerId);
    if (el) el.classList.add(focusClass);
  }
  if (textSpanId) {
    const span = document.getElementById(textSpanId);
    if (span) span.classList.add('sync-text-highlight');
  }
}

function runStepPresentation(stepData) {
  clearAllActiveTimers();
  window.Typewriter.cancelAll();
  currentSyncPhase = 0;
  lastFocusedContainerId = null;

  const isTelugish = PlayerState.language === 'telugish';
  const narration = isTelugish ? stepData.narration_telugish : stepData.narration_en;
  const title = isTelugish ? stepData.title_telugish : stepData.title_en;
  const desc = isTelugish ? stepData.subtitle_telugish : stepData.subtitle_en;
  const speed = PlayerState.playbackSpeed || 1.0;

  // Stream header letter-by-letter live
  window.Typewriter.stream('step-title-live', title, 16, () => {
    window.Typewriter.stream('step-desc-live', desc, 14);
  });

  // Render Subtitles with Karaoke word spans directly matching screen text
  setSubtitleText(narration);

  // Blackboard begins with elements hidden; they swoop in when spoken!
  document.querySelectorAll('.staged-element, .staged-from-left, .staged-from-right, .staged-pop')
    .forEach(el => el.classList.remove('revealed'));
  clearLaserBeams();

  if (stepData.step === 3) {
    const ide = document.getElementById('step3-ide-panel');
    const mem = document.getElementById('step3-mem-panel');
    if (ide) ide.classList.add('revealed');
    if (mem) mem.classList.add('revealed');
  }

  // AUDIO SPEECH WITH REAL-TIME ON-BOUNDARY SCREEN SYNC
  window.AudioEngine.speak(narration, {
    language: PlayerState.language,
    onWordBoundary: onPlaybackWordBoundary,
    onComplete: () => {
      document.querySelectorAll('.caption-word').forEach(w => {
        w.className = 'caption-word word-spoken';
      });

      // Clear sync focuses so all cards sit calmly
      clearSyncFocusClasses();

      if (!PlayerState.isPlaying) return;

      if (PlayerState.stepByStepMode) {
        pausePlayback();
        setSubtitleText(`✨ Step ${stepData.step} Complete • Press [→] or Space for Next Step ▶`);
        return;
      }

      // Continuous Mode: Grant 5 seconds of calm absorption soak pause
      const soakTime = Math.round(5000 / speed);
      PlayerState.stepTimer = setTimeout(() => {
        if (PlayerState.isPlaying) {
          if (PlayerState.currentStepIndex < PlayerState.totalSteps) {
            loadAndRenderStep(PlayerState.currentStepIndex + 1, true);
          } else {
            pausePlayback();
            setSubtitleText("🎓 JAVA MEMORY MASTERCLASS COMPLETE // CONGRATULATIONS!");
          }
        }
      }, soakTime);
    }
  });
}

// REAL-TIME EVENT-DRIVEN VISUAL SYNCHRONIZATION
function onPlaybackWordBoundary(charIndex, charLength) {
  // 1. Highlight subtitle word
  highlightCaptionWord(charIndex);

  // 2. Drive screen visuals in 100% mechanical lockstep with spoken word
  syncScreenVisualsToSpokenPosition(charIndex);
}

function syncScreenVisualsToSpokenPosition(charIndex) {
  const stepIdx = PlayerState.currentStepIndex;
  const curStep = PlayerState.cachedSteps[stepIdx];
  if (!curStep) return;

  const isTelugish = PlayerState.language === 'telugish';
  const text = isTelugish ? curStep.narration_telugish : curStep.narration_en;
  if (!text) return;

  if (stepIdx === 1) {
    // Dynamic cue boundaries from actual narration text
    const cue1 = Math.max(20, text.indexOf("Room 1") !== -1 ? text.indexOf("Room 1") - 15 : 100);
    const cue2 = text.indexOf("Room 2") !== -1 ? text.indexOf("Room 2") - 15 : 300;
    const cue3 = text.indexOf("30-Second Mystery") !== -1 ? text.indexOf("30-Second Mystery") - 15 : 480;

    if (charIndex >= cue1 && charIndex < cue2) {
      if (currentSyncPhase !== 1) {
        currentSyncPhase = 1;
        const desk = document.getElementById('card-desk');
        if (desk && !desk.classList.contains('revealed')) {
          desk.classList.add('revealed');
          window.AudioEngine.playWhoosh();
        }
        setFocusedVisual('card-desk', 'c1-desc', 'sync-focused');
      }
    } else if (charIndex >= cue2 && charIndex < cue3) {
      if (currentSyncPhase !== 2) {
        currentSyncPhase = 2;
        const warehouse = document.getElementById('card-warehouse');
        if (warehouse && !warehouse.classList.contains('revealed')) {
          warehouse.classList.add('revealed');
          window.AudioEngine.playWhoosh();
        }
        setFocusedVisual('card-warehouse', 'c2-desc', 'sync-focused-emerald');
      }
    } else if (charIndex >= cue3) {
      if (currentSyncPhase !== 3) {
        currentSyncPhase = 3;
        const puzzle = document.getElementById('card-puzzle');
        if (puzzle && !puzzle.classList.contains('revealed')) {
          puzzle.classList.add('revealed');
          window.AudioEngine.playBeep(620, 0.1);
        }
        setFocusedVisual('card-puzzle', 'puzzle-code-line', 'sync-focused-amber');
      }
    }
  } else if (stepIdx === 2) {
    const cue1 = Math.max(20, text.indexOf("Remote 1") !== -1 ? text.indexOf("Remote 1") - 15 : 85);
    const cue2 = text.indexOf("Smart TV") !== -1 ? text.indexOf("Smart TV") - 15 : 180;
    const cue3 = (text.indexOf("d2 = dog") !== -1 ? text.indexOf("d2 = dog") : text.indexOf("Aliasing")) - 15;
    const cue4 = text.indexOf("Golden") !== -1 ? text.indexOf("Golden") - 15 : 420;

    if (charIndex >= cue1 && charIndex < cue2) {
      if (currentSyncPhase !== 1) {
        currentSyncPhase = 1;
        const rem1 = document.getElementById('remote-box-1');
        if (rem1 && !rem1.classList.contains('revealed')) {
          rem1.classList.add('revealed');
          window.AudioEngine.playWhoosh();
        }
        setFocusedVisual('remote-box-1', null, 'sync-focused');
      }
    } else if (charIndex >= cue2 && charIndex < cue3) {
      if (currentSyncPhase !== 2) {
        currentSyncPhase = 2;
        const tv = document.getElementById('smart-tv-box');
        if (tv && !tv.classList.contains('revealed')) {
          tv.classList.add('revealed');
          window.AudioEngine.playBeep(520, 0.08);
          setTimeout(drawRemoteLaserBeams, 100);
        }
        setFocusedVisual('smart-tv-box', null, 'sync-focused-emerald');
      }
    } else if (charIndex >= cue3 && charIndex < cue4) {
      if (currentSyncPhase !== 3) {
        currentSyncPhase = 3;
        const rem2 = document.getElementById('remote-box-2');
        if (rem2 && !rem2.classList.contains('revealed')) {
          rem2.classList.add('revealed');
          window.AudioEngine.playBeep(580, 0.08);
          setTimeout(drawRemoteLaserBeams, 100);
          setTimeout(flashLaserBeam, 300);
        }
        setFocusedVisual('remote-box-2', null, 'sync-focused');
      }
    } else if (charIndex >= cue4) {
      if (currentSyncPhase !== 4) {
        currentSyncPhase = 4;
        const gBox = document.getElementById('golden-rule-box');
        if (gBox && !gBox.classList.contains('revealed')) {
          gBox.classList.add('revealed');
          window.AudioEngine.playBeep(640, 0.1);
        }
        setFocusedVisual('golden-rule-box', null, 'sync-focused-amber');
      }
    }
  } else if (stepIdx === 3) {
    const ratio = charIndex / text.length;
    const subIdx = Math.min(6, Math.floor(ratio * 7));
    if (subIdx !== PlayerState.ideSubStep) {
      PlayerState.ideSubStep = subIdx;
      renderIdeSubStep(subIdx);
      window.AudioEngine.playBeep(480 + subIdx * 35, 0.05);

      const stackSlot = document.getElementById('slot-call-stack');
      const heapSlot = document.getElementById('slot-heap-storage');
      if (subIdx === 1 || subIdx === 4) {
        if (heapSlot) {
          heapSlot.classList.add('sync-focused-emerald');
          setTimeout(() => heapSlot.classList.remove('sync-focused-emerald'), 1800);
        }
      } else {
        if (stackSlot) {
          stackSlot.classList.add('sync-focused');
          setTimeout(() => stackSlot.classList.remove('sync-focused'), 1800);
        }
      }
    }
  }
}

// 4. REAL-TIME KARAOKE WORD TOKENIZER & HIGHLIGHTER
let currentCaptionWords = [];

function setSubtitleText(text) {
  if (!DOM.subtitleText) return;
  if (!text) {
    DOM.subtitleText.innerHTML = '';
    currentCaptionWords = [];
    return;
  }

  currentCaptionWords = [];
  const regex = /(\S+)/g;
  let match;
  let html = '';
  let lastIndex = 0;
  let wordIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    const word = match[0];
    const start = match.index;
    const end = start + word.length;

    if (start > lastIndex) {
      html += escapeHtml(text.substring(lastIndex, start));
    }

    currentCaptionWords.push({
      index: wordIdx,
      word: word,
      start: start,
      end: end
    });

    html += `<span class="caption-word" id="cap-w-${wordIdx}" data-start="${start}" data-end="${end}">${escapeHtml(word)}</span>`;
    lastIndex = end;
    wordIdx++;
  }

  if (lastIndex < text.length) {
    html += escapeHtml(text.substring(lastIndex));
  }

  DOM.subtitleText.innerHTML = html;
}

function highlightCaptionWord(charIndex) {
  if (!currentCaptionWords || currentCaptionWords.length === 0) return;

  let activeWord = null;
  for (let i = 0; i < currentCaptionWords.length; i++) {
    const w = currentCaptionWords[i];
    if (charIndex >= w.start && charIndex <= w.end) {
      activeWord = w;
      break;
    }
  }

  if (!activeWord) {
    for (let i = 0; i < currentCaptionWords.length; i++) {
      if (currentCaptionWords[i].start >= charIndex) {
        activeWord = currentCaptionWords[i];
        break;
      }
    }
  }

  if (activeWord) {
    for (let i = 0; i < currentCaptionWords.length; i++) {
      const el = document.getElementById(`cap-w-${i}`);
      if (!el) continue;
      if (i < activeWord.index) {
        el.className = 'caption-word word-spoken';
      } else if (i === activeWord.index) {
        el.className = 'caption-word word-active';
      } else {
        el.className = 'caption-word';
      }
    }

    // Synchronous Kinetic Highlighting of words on screen chalkboard
    highlightScreenWords(activeWord.word);
  }
}

// ==========================================================================
// 5. OFFICIAL SPEC KNOWLEDGE PATHWAY REGISTRY (JLS / JVMS 4 MULTI-TABS)
// ==========================================================================
const CONCEPT_REGISTRY = {
  'variable-primitive': {
    badge: 'JLS §4.2 // PRIMITIVE VALUES',
    title: 'Local Primitive Variable (e.g. int age = 3)',
    analogy: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">💡 The Sticky Note on Your Personal Desk</div>
        <p>Think of writing the number <code>3</code> directly on a sticky note sitting on your personal study desk. It holds the actual raw bits directly, not a phone number or address to another location. If you pass it to a friend, you copy the number onto a new sticky note. When they erase their note, yours remains completely untouched!</p>
      </div>
    `,
    spec: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🏛️ JVMS §2.6.1 & JLS §4.2 Architecture</div>
        <p>In the JVM, primitive types (<code>byte</code>, <code>short</code>, <code>int</code>, <code>long</code>, <code>float</code>, <code>double</code>, <code>char</code>, <code>boolean</code>) store direct value bits in the Local Variable Array of the executing method's Stack Frame.</p>
        <ul style="margin-left:18px; margin-top:6px;">
          <li><strong>Memory Footprint:</strong> 32-bit slot for <code>int</code> directly on the CPU Stack.</li>
          <li><strong>Hardware Management:</strong> CPU RSP Register adjusts stack depth with zero Garbage Collection pauses.</li>
          <li><strong>Lifecycle:</strong> Deallocated in 0.001ms the instant the method frame pops.</li>
        </ul>
      </div>
    `,
    minilab: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">⚡ Live Primitive Slot Mutation Test</div>
        <p>Test modifying <code>localAge</code> inside a helper method:</p>
        <div style="background:#141418; padding:8px 12px; border-radius:6px; border:1px solid #27272a; margin:8px 0; font-family:var(--font-mono);">
          <div>main() Slot 1: int age = <strong style="color:var(--accent-blue);" id="lab-prim-main">3</strong></div>
          <div>modify() Slot 1: int localAge = <strong style="color:var(--accent-emerald);" id="lab-prim-mod">3</strong></div>
        </div>
        <button onclick="testPrimitiveMutation()" class="btn-ide-step" style="padding:6px 14px; font-weight:800; background:var(--accent-blue); color:#09090b; border:none; border-radius:4px;">Execute: localAge += 5</button>
        <div id="lab-prim-result" style="margin-top:8px; font-size:11px; color:#94a3b8;">Click to verify that main()'s age is 100% untouched!</div>
      </div>
    `,
    pathway: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🎯 Interview Mastery & Traps</div>
        <p><strong>Trap Q: Are primitive variables always stored on the Stack?</strong><br>
        <strong style="color:var(--accent-emerald);">Answer: NO!</strong> Only <em>local method variables</em> live on the stack. Primitive <em>fields</em> of an object (e.g. <code>class Dog { int age; }</code>) live on the <strong>Heap</strong> inside the object's instance payload!</p>
        <div style="margin-top:8px; font-weight:700; color:var(--accent-blue);">Recommended Next Milestone: Object Instance Memory Layout (JOL)</div>
      </div>
    `
  },
  'object-reference': {
    badge: 'JLS §4.3 // REFERENCE VALUES',
    title: 'Object Reference (e.g. Dog dog)',
    analogy: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">💡 The TV Remote Control Model</div>
        <p>An object variable in Java is NOT the physical object! It is an infrared <strong>TV Remote Control</strong> tuned to frequency code <code>0x4A2F</code>. The actual 65-inch Smart TV lives in the Heap Warehouse. Passing an object copies the remote control frequency, NEVER the television!</p>
      </div>
    `,
    spec: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🏛️ JLS §4.3.1 & HotSpot Compressed OOPs</div>
        <p>Under JLS §4.3.1, reference types contain pointers to dynamically created object instances on the Heap. In 64-bit JVMs with Compressed Ordinary Object Pointers (Compressed OOPs, <code>-XX:+UseCompressedOops</code>), references occupy 32 bits and point to 8-byte aligned addresses on the heap, supporting up to 32GB heap spaces.</p>
      </div>
    `,
    minilab: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">⚡ Remote Signal & Address Inspection</div>
        <div style="font-family:var(--font-mono); background:#141418; padding:8px 12px; border-radius:6px; border:1px solid #27272a; margin:8px 0;">
          Stack Slot: Dog dog = <span style="color:var(--accent-emerald);">0x4A2F</span> &rarr; Points to Heap: Dog("Bruno", 3)
        </div>
        <button onclick="flashLaserBeam(); window.AudioEngine.playBeep(640, 0.08);" class="btn-ide-step" style="padding:6px 14px; background:var(--accent-emerald); color:#09090b; font-weight:800; border:none; border-radius:4px;">Fire Remote Signal 📡</button>
      </div>
    `,
    pathway: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🎯 Interview Mastery & Traps</div>
        <p><strong>Trap Q: What is the size of an empty Java object?</strong><br>
        <strong style="color:var(--accent-emerald);">Answer: 16 bytes!</strong> 12 bytes of object header (8-byte Mark Word + 4-byte Compressed Klass pointer) + 4 bytes of padding to align to an 8-byte boundary.</p>
      </div>
    `
  },
  'new-keyword': {
    badge: 'JVMS §6.5 // JVM OPCODES',
    title: 'new Keyword (Heap Object Allocation)',
    analogy: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">💡 Ordering From the Factory</div>
        <p>Writing <code>new</code> is like calling the manufacturer to build a brand new physical device. It reserves space on an open warehouse shelf, constructs the instance, and hands you back the shelf address (<code>0x4A2F</code>).</p>
      </div>
    `,
    spec: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🏛️ JVMS §6.5 Bytecode Sequence</div>
        <ol style="margin-left:18px; margin-top:6px;">
          <li><code>new #2 &lt;Dog&gt;</code>: Allocates memory on the heap and zeros fields.</li>
          <li><code>dup</code>: Duplicates reference on top of operand stack.</li>
          <li><code>invokespecial #3 &lt;Dog.&lt;init&gt;&gt;</code>: Calls constructor with arguments.</li>
        </ol>
      </div>
    `,
    minilab: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">⚡ Heap Allocation Simulation</div>
        <p>Memory reserved on heap: <strong>24 Bytes</strong> (16B header + 4B int age + 4B reference pointer).</p>
        <button onclick="window.AudioEngine.playWhoosh();" class="btn-ide-step" style="padding:6px 14px; background:var(--accent-amber); color:#09090b; font-weight:800; border:none; border-radius:4px;">Allocate New Heap Instance 📦</button>
      </div>
    `,
    pathway: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🎯 Senior Interview Trap</div>
        <p><strong>Q: Can objects created with new ever be allocated on the Stack?</strong><br>
        <strong style="color:var(--accent-emerald);">Answer: YES!</strong> HotSpot JVM JIT compiler uses <em>Escape Analysis</em>. If an object does not escape the allocating method, the JIT optimizes it via <em>Scalar Replacement</em>, breaking it into primitives on the stack with zero heap allocation!</p>
      </div>
    `
  },
  'stack-memory': {
    badge: 'JVMS §2.6 // JVM CALL STACK',
    title: 'Stack Memory (The Quick Study Desk)',
    analogy: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">💡 Personal Study Desk Trays</div>
        <p>Think of your personal study desk with work trays. Every running method gets its own neat tray. It is right in front of you, blazing fast (0.001ms), and swept clean the instant your method returns!</p>
      </div>
    `,
    spec: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🏛️ JVMS §2.5.2 & §2.6 Specification</div>
        <p>Each JVM thread has a private stack created at thread startup. Stores LIFO frames containing:</p>
        <ul style="margin-left:18px; margin-top:4px;">
          <li><strong>Local Variable Array:</strong> Method parameters and local primitive / reference variables.</li>
          <li><strong>Operand Stack:</strong> Workspace where JVM bytecode executes calculations.</li>
          <li><strong>Frame Data:</strong> Constant pool references and method return information.</li>
        </ul>
      </div>
    `,
    minilab: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">⚡ Call Stack LIFO Simulation</div>
        <div style="background:#141418; padding:8px 12px; border-radius:6px; border:1px solid #27272a; font-family:var(--font-mono);">
          <div>[TOP] Tray 2: modify(Dog d, int localAge) - Active</div>
          <div>[ROOT] Tray 1: main(String[] args) - Paused</div>
        </div>
      </div>
    `,
    pathway: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🎯 Interview Question</div>
        <p><strong>Q: What causes StackOverflowError?</strong><br>
        Exceeding the thread stack size (configured via <code>-Xss</code>, usually 1MB). Caused by infinite recursion without a base case!</p>
      </div>
    `
  },
  'heap-memory': {
    badge: 'JVMS §2.5.3 // HEAP STORAGE POOL',
    title: 'Heap Memory (The Big Shared Warehouse)',
    analogy: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">💡 The Big Shared Warehouse</div>
        <p>A massive, global IKEA warehouse shared by all threads. Whenever you write <code>new</code>, an object is placed on a warehouse shelf. It stays safe as long as someone has a remote control for it.</p>
      </div>
    `,
    spec: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🏛️ JVMS §2.5.3 Specification</div>
        <p>The Heap is the runtime data area from which memory for all class instances and arrays is allocated. Created at JVM start and managed by an automatic Garbage Collector. Throws <code>OutOfMemoryError</code> when capacity is exhausted.</p>
      </div>
    `,
    minilab: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">⚡ Garbage Collector Reachability Check</div>
        <div id="lab-gc-shelf" style="background:#141418; padding:8px 12px; border-radius:6px; border:1px solid #27272a; font-family:var(--font-mono); margin-bottom:8px;">
          Shelf 0x7B9C: Dog("Max", 1) &bull; Active Remotes: 0 (Orphan)
        </div>
        <button onclick="testGcSweepLab()" class="btn-ide-step" style="padding:6px 14px; background:var(--accent-rose); color:#ffffff; font-weight:800; border:none; border-radius:4px;">Run GC Sweep 🤖</button>
        <div id="lab-gc-result" style="margin-top:8px; font-size:11px; color:#94a3b8;">Click Run to simulate tracing GC sweep!</div>
      </div>
    `,
    pathway: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🎯 JVM Tuning Flags</div>
        <p><code>-Xms</code>: Initial Heap Size &bull; <code>-Xmx</code>: Maximum Heap Size &bull; <code>-XX:+UseG1GC</code>: Garbage-First Collector.</p>
      </div>
    `
  },
  'memory-address': {
    badge: 'HOTSPOT ARCH // 0x4A2F',
    title: 'Memory Address Coordinate (0x4A2F)',
    analogy: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">💡 Street Address on RAM Street</div>
        <p>Just like a house number tells the mail carrier exactly which house to deliver to, <code>0x4A2F</code> tells the CPU exactly which shelf in physical RAM holds this Dog.</p>
      </div>
    `,
    spec: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🏛️ Object Header Layout in OpenJDK</div>
        <p>Every object in heap memory begins with a 2-word header:</p>
        <ul style="margin-left:18px; margin-top:4px;">
          <li><strong>Mark Word (64-bit):</strong> HashCode, GC Age (0-15), Biased Lock flag, Lock state bits.</li>
          <li><strong>Klass Word (64-bit / 32-bit compressed):</strong> Pointer to class metadata in Metaspace.</li>
        </ul>
      </div>
    `,
    minilab: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">⚡ Address Decoder</div>
        <div style="font-family:var(--font-mono); background:#09090b; padding:8px 12px; border-radius:6px; border:1px solid #27272a;">
          0x4A2F &rarr; Binary: 0100 1010 0010 1111 &rarr; Byte Offset: 18991
        </div>
      </div>
    `,
    pathway: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🎯 Tooling Knowledge</div>
        <p>Use <strong>JOL (Java Object Layout)</strong> to inspect memory addresses, object headers, and padding in real applications: <code>ClassLayout.parseInstance(dog).toPrintable()</code>.</p>
      </div>
    `
  },
  'aliasing': {
    badge: 'JLS §4.3.1 // ALIASING',
    title: 'Aliasing (Two Remotes, One TV)',
    analogy: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">💡 Two Remotes, One Living Room Screen</div>
        <p>Writing <code>Dog d2 = dog;</code> does NOT build a second TV! It simply gives your friend a second remote tuned to the same living room TV. Changing channels on Remote 2 immediately changes what Remote 1 sees!</p>
      </div>
    `,
    spec: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🏛️ JLS §4.3.1 Specification</div>
        <p>Writing <code>d2 = dog;</code> copies the 64-bit address value <code>0x4A2F</code> into <code>d2</code>'s slot. Both reference variables now point to the identical heap object instance.</p>
      </div>
    `,
    minilab: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">⚡ Aliasing Mutation Simulator</div>
        <div style="font-family:var(--font-mono); background:#141418; padding:8px 12px; border-radius:6px; border:1px solid #27272a; margin-bottom:8px;">
          Shared TV Screen: Name = <strong style="color:var(--accent-blue);" id="lab-alias-name">"Bruno"</strong>
        </div>
        <button onclick="testAliasingLab()" class="btn-ide-step" style="padding:6px 14px; background:var(--accent-emerald); color:#09090b; font-weight:800; border:none; border-radius:4px;">Execute: d2.setName("Rocky") 📡</button>
        <div id="lab-alias-result" style="margin-top:8px; font-size:11px; color:#94a3b8;">Click to verify that Remote 1 also sees "Rocky"!</div>
      </div>
    `,
    pathway: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🎯 Architectural Defense</div>
        <p>How to prevent accidental aliasing bugs? Use <strong>Defensive Copying</strong> or <strong>Immutable Objects</strong> (e.g. Java Records or <code>final</code> fields)!</p>
      </div>
    `
  },
  'pass-by-value': {
    badge: 'JLS §8.4.1 // PASS-BY-VALUE',
    title: 'Java is STRICTLY Pass-by-Value',
    analogy: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">💡 Photocopying the Remote</div>
        <p>Java ALWAYS passes by value. Passing an object copies the remote control's frequency code (<code>0x4A2F</code>). Both methods now have remotes pointing to the same TV, but neither method has access to the caller's variable!</p>
      </div>
    `,
    spec: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🏛️ JLS §8.4.1 & §15.12.4.2</div>
        <p>When an argument is evaluated, its value is copied into the method's formal parameter slot. Java NEVER passes by reference. For primitives, it copies the number. For objects, it copies the reference address.</p>
      </div>
    `,
    minilab: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">⚡ Reassignment Test</div>
        <p><code>void modify(Dog d) { d = new Dog("Max", 1); }</code></p>
        <p style="color:var(--accent-emerald);">Does main's dog change to Max? <strong>NO!</strong> You only reassigned modify's local copy of the remote!</p>
      </div>
    `,
    pathway: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🎯 The #1 Technical Interview Question</div>
        <p><strong>Q: Why does Java not support swap(a, b)?</strong><br>
        Because Java passes copies of variable values. Swapping parameters inside a method only swaps the local copies—the caller variables remain completely unaffected!</p>
      </div>
    `
  },
  'garbage-collector': {
    badge: 'JVMS §2.5.3 // GARBAGE COLLECTION',
    title: 'Garbage Collector (The Warehouse Cleaner)',
    analogy: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">💡 Automated Warehouse Recycling Robot</div>
        <p>An automated cleaning robot that periodically scans the warehouse. If a television has ZERO remotes pointing to it (orphan), the robot safely dismantles it to free the shelf for future objects.</p>
      </div>
    `,
    spec: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🏛️ JVMS §2.5.3 Specification</div>
        <p>The JVM specification does not dictate a specific garbage collector algorithm. Tracing collectors determine object reachability via directed graphs starting from GC Roots.</p>
      </div>
    `,
    minilab: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">⚡ GC Root Tracer</div>
        <p>Active GC Roots: Thread 1 execution stack frame &bull; Static class fields.</p>
      </div>
    `,
    pathway: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🎯 Modern Garbage Collectors</div>
        <p>G1GC (Default in Java 17+), ZGC (Sub-millisecond low-latency), Shenandoah.</p>
      </div>
    `
  },
  'stackoverflow-error': {
    badge: 'JVMS §2.5.2 // STACK OVERFLOW',
    title: 'StackOverflowError (Desk Overflow)',
    analogy: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">💡 Stacking Trays to the Ceiling</div>
        <p>Stacking work trays on your desk so high that they crash into the ceiling and knock everything over!</p>
      </div>
    `,
    spec: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🏛️ JVMS §2.5.2 Specification</div>
        <p>Thrown when the computation in a thread requires a larger JVM stack than is permitted by the <code>-Xss</code> configuration.</p>
      </div>
    `,
    minilab: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">⚡ Recursive Crash Trigger</div>
        <pre class="code-snippet" style="padding:6px; border-radius:4px;">void recurse() { recurse(); } // StackOverflowError!</pre>
      </div>
    `,
    pathway: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🎯 Fix Strategy</div>
        <p>Always verify base conditions in recursive methods, or convert recursion to iterative loops.</p>
      </div>
    `
  },
  'outofmemory-error': {
    badge: 'JVMS §2.5.3 // HEAP OVERFLOW',
    title: 'OutOfMemoryError (Warehouse Overflow)',
    analogy: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">💡 Warehouse Packed to the Doors</div>
        <p>Continuously purchasing giant furniture and hoarding it in the warehouse until every single shelf is occupied and the doors can't close!</p>
      </div>
    `,
    spec: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🏛️ JVMS §2.5.3 Specification</div>
        <p>Thrown when the automatic storage management system cannot make available sufficient heap memory to allocate an object.</p>
      </div>
    `,
    minilab: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">⚡ Heap Leak Simulation</div>
        <pre class="code-snippet" style="padding:6px; border-radius:4px;">while(true) { list.add(new byte[1024*1024]); } // OutOfMemoryError!</pre>
      </div>
    `,
    pathway: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🎯 Diagnostic Tooling</div>
        <p>Generate heap dump on crash via <code>-XX:+HeapDumpOnOutOfMemoryError</code> and analyze with Eclipse Memory Analyzer Tool (MAT).</p>
      </div>
    `
  }
};

function openConceptPathway(conceptKey) {
  const aliasMap = {
    'stack': 'stack-memory',
    'heap': 'heap-memory',
    'variable': 'variable-primitive',
    'primitive': 'variable-primitive',
    'object': 'object-reference',
    'reference': 'object-reference',
    'new': 'new-keyword',
    'address': 'memory-address',
    'pass-by-value': 'pass-by-value',
    'golden-rule': 'pass-by-value',
    'mystery-puzzle': 'object-reference',
    'tv-remote': 'object-reference',
    'gc': 'garbage-collector',
    'stackoverflow': 'stackoverflow-error',
    'outofmemory': 'outofmemory-error'
  };

  const resolvedKey = aliasMap[conceptKey] || conceptKey;
  const data = CONCEPT_REGISTRY[resolvedKey] || CONCEPT_REGISTRY['object-reference'];
  if (!data) return;

  hideHudTooltip();
  pausePlayback();

  const badgeEl = document.getElementById('modal-badge');
  const titleEl = document.getElementById('modal-title');
  if (badgeEl) badgeEl.textContent = data.badge;
  if (titleEl) titleEl.textContent = data.title;

  const paneAnalogy = document.getElementById('ctab-pane-analogy');
  const paneSpec = document.getElementById('ctab-pane-spec');
  const paneMinilab = document.getElementById('ctab-pane-minilab');
  const panePathway = document.getElementById('ctab-pane-pathway');

  if (paneAnalogy) paneAnalogy.innerHTML = data.analogy;
  if (paneSpec) paneSpec.innerHTML = data.spec;
  if (paneMinilab) paneMinilab.innerHTML = data.minilab;
  if (panePathway) panePathway.innerHTML = data.pathway;

  switchConceptTab('analogy');

  if (DOM.modalBackdrop) DOM.modalBackdrop.classList.add('backdrop-active');
  if (DOM.deepdiveModal) DOM.deepdiveModal.classList.add('modal-active');
  window.AudioEngine.playBeep(560, 0.06);
}
window.openConceptPathway = openConceptPathway;

function switchConceptTab(tabName) {
  const tabs = ['analogy', 'spec', 'minilab', 'pathway'];
  tabs.forEach(t => {
    const btn = document.getElementById('ctab-btn-' + t);
    const pane = document.getElementById('ctab-pane-' + t);
    if (btn) btn.classList.toggle('ctab-active', t === tabName);
    if (pane) pane.style.display = (t === tabName) ? 'block' : 'none';
  });
  window.AudioEngine.playBeep(520, 0.04);
}
window.switchConceptTab = switchConceptTab;

function testPrimitiveMutation() {
  const mainEl = document.getElementById('lab-prim-main');
  const modEl = document.getElementById('lab-prim-mod');
  const resEl = document.getElementById('lab-prim-result');
  if (modEl) {
    modEl.textContent = '8';
    modEl.style.color = '#34d399';
  }
  if (mainEl) {
    mainEl.textContent = '3';
    mainEl.style.color = '#38bdf8';
  }
  if (resEl) {
    resEl.innerHTML = '<span style="color:#34d399; font-weight:800;">PASS-BY-VALUE PROOF:</span> modify\'s localAge changed from 3 to 8, but main\'s age is STILL 3!';
  }
  window.AudioEngine.playBeep(640, 0.08);
}
window.testPrimitiveMutation = testPrimitiveMutation;

function testAliasingLab() {
  const tvEl = document.getElementById('lab-alias-name');
  const resEl = document.getElementById('lab-alias-result');
  if (tvEl) {
    tvEl.textContent = '"Rocky"';
    tvEl.style.color = '#34d399';
  }
  if (resEl) {
    resEl.innerHTML = '<span style="color:#34d399; font-weight:800;">ALIASING PROOF:</span> Mutating through Remote 2 instantly updated what Remote 1 sees on screen!';
  }
  window.AudioEngine.playBeep(580, 0.08);
}
window.testAliasingLab = testAliasingLab;

function testGcSweepLab() {
  const shelf = document.getElementById('lab-gc-shelf');
  const resEl = document.getElementById('lab-gc-result');
  if (shelf) {
    shelf.style.opacity = '0.35';
    shelf.style.border = '1px dashed #f43f5e';
    shelf.innerHTML = '<span style="color:#f43f5e; font-weight:800;">[RECLAIMED BY TRACING GC] Free Shelf Space</span>';
  }
  if (resEl) {
    resEl.innerHTML = '<span style="color:#34d399; font-weight:800;">AUTOMATIC CLEANUP:</span> Object 0x7B9C had zero active remote handles, so the Tracing GC recycled it!';
  }
  window.AudioEngine.playBeep(320, 0.1);
}
window.testGcSweepLab = testGcSweepLab;

// 5. STANDARDIZED & ACCURATE HUD TOOLTIP SYSTEM
const HUD_REGISTRY = {
  'stack-memory': {
    badge: 'JVMS §2.6 // THE QUICK DESK',
    title: 'Stack Memory (The Quick Study Desk)',
    analogy: '💡 <strong>Everyday Analogy:</strong> Think of a student study desk with trays. Every running method gets its own neat tray. It is right in front of you, blazing fast, and swept clean in 0.001 milliseconds the moment your method finishes!',
    desc: 'Stores primitive variables (int, double, boolean) and object remote addresses. Allocated in Last-In First-Out (LIFO) order with zero garbage collection overhead.',
    actionLabel: '⚡ See 3-Tray LIFO Stack',
    actionType: 'tray-demo'
  },
  'heap-memory': {
    badge: 'JVMS §2.5.3 // THE BIG WAREHOUSE',
    title: 'Heap Memory (The Big Warehouse)',
    analogy: '💡 <strong>Everyday Analogy:</strong> Think of a giant shared IKEA warehouse. Whenever you write "new", a big object is built and placed on a warehouse shelf. It stays safe as long as someone has a remote control for it.',
    desc: 'Universal shared storage pool where all Java object instances and arrays reside. Lifetime is dynamic, kept organized and clean by the JVM Garbage Collector robot.',
    actionLabel: '📦 Inspect Warehouse Shelf',
    actionType: 'warehouse-demo'
  },
  'mystery-puzzle': {
    badge: 'INTERVIEW PUZZLE // CORE SECRET',
    title: 'Where Does Dog dog = new Dog() Live?',
    analogy: '💡 <strong>The Secret:</strong> The variable "dog" and the physical "Dog" object live in TWO completely separate rooms! You must never confuse the TV remote with the television.',
    desc: 'The variable "dog" sits on your Quick Desk (Stack), holding a 64-bit frequency address (0x4A2F). The actual Dog instance lives in the Big Warehouse (Heap).',
    actionLabel: '💡 Reveal Full Memory Map',
    actionType: 'puzzle-answer'
  },
  'tv-remote': {
    badge: 'THE #1 MENTAL MODEL // REFERENCES',
    title: 'Object Reference = TV Remote Control',
    analogy: '💡 <strong>The Remote Model:</strong> When you buy a TV, you don\'t carry the TV around in your hand; you hold a remote control with an infrared frequency. That remote is your Java variable!',
    desc: 'An object variable does not contain the object data. It contains only the hexadecimal memory address (0x4A2F) that points to the object in heap memory.',
    actionLabel: '📡 Fire Signal to TV',
    actionType: 'flash-remote-1'
  },
  'aliasing': {
    badge: 'CORE INTERVIEW CONCEPT // ALIASING',
    title: 'Aliasing (Two Remotes, One TV)',
    analogy: '💡 <strong>Two Remotes, One Screen:</strong> Writing Dog d2 = dog does NOT build a second TV! It simply gives your friend a second identical remote tuned to the same living room TV.',
    desc: 'When two reference variables hold the identical memory address, changing an object field through one remote immediately changes what the second remote sees on screen.',
    actionLabel: '⚡ Test Aliasing (+1 Age)',
    actionType: 'test-aliasing'
  },
  'memory-address': {
    badge: 'PHYSICAL MEMORY ADDRESS // 0x4A2F',
    title: 'Memory Address (0x4A2F)',
    analogy: '💡 <strong>Physical Address:</strong> Just like a house number on your street: 0x4A2F tells the computer CPU exactly which shelf in physical RAM holds this Dog.',
    desc: 'A 64-bit hexadecimal coordinate pointing to the object header, mark word, and instance variables residing in the JVM heap space.',
    actionLabel: '📡 Trace Frequency Wire',
    actionType: 'trace-beam'
  },
  'golden-rule': {
    badge: 'THE GOLDEN ANCHOR // PASS-BY-VALUE',
    title: 'Java is STRICTLY Pass-by-Value',
    analogy: '💡 <strong>Photocopying the Remote:</strong> Passing an object to a method makes a photocopy of the remote control\'s frequency code. Both methods now have remotes pointing to the same TV!',
    desc: 'Java NEVER passes objects by reference. It copies the bits inside the caller\'s variable. For primitives, it copies the number. For objects, it copies the remote control address.',
    actionLabel: '📝 Open Revision Notes',
    actionType: 'open-notes'
  }
};

let currentHudTopic = null;
let hudHideTimeout = null;
let isHudPinned = false;

function initHudMouseListeners() {
  const stage = document.getElementById('blackboard-stage');
  if (!stage) return;

  // STRICT TARGETING: Only listen to explicit (i) buttons or tagged badges
  stage.addEventListener('mouseover', (e) => {
    const btn = e.target.closest('.info-bubble-btn, .hud-trigger-badge');
    if (btn) {
      // Must be inside a revealed card
      const parentCard = btn.closest('.room-card, .puzzle-box, .remote-box, .smart-tv-device, .canvas-header');
      if (parentCard && !parentCard.classList.contains('revealed') && !parentCard.classList.contains('canvas-header')) {
        return; // card is still hidden during staging
      }
      const topicKey = btn.getAttribute('data-hud-topic');
      if (topicKey) {
        showHudTooltipForButton(btn, topicKey);
      }
    }
  });

  stage.addEventListener('mouseout', (e) => {
    const btn = e.target.closest('.info-bubble-btn, .hud-trigger-badge');
    if (btn && !isHudPinned) {
      scheduleHideHudTooltip();
    }
  });

  const hudCard = document.getElementById('global-hud-tooltip');
  if (hudCard) {
    hudCard.addEventListener('mouseenter', () => {
      if (hudHideTimeout) {
        clearTimeout(hudHideTimeout);
        hudHideTimeout = null;
      }
    });
    hudCard.addEventListener('mouseleave', () => {
      if (!isHudPinned) scheduleHideHudTooltip();
    });
  }

  // Dismiss on clicking outside
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#global-hud-tooltip') || e.target.closest('.info-bubble-btn')) return;
    isHudPinned = false;
    hideHudTooltip();
  });
}

function showHudTooltipForButton(btnEl, topicKey) {
  if (hudHideTimeout) {
    clearTimeout(hudHideTimeout);
    hudHideTimeout = null;
  }

  const data = HUD_REGISTRY[topicKey];
  if (!data) return;

  currentHudTopic = topicKey;

  const badgeEl = document.getElementById('hud-topic-badge');
  const titleEl = document.getElementById('hud-title-txt');
  const analogyEl = document.getElementById('hud-analogy-txt');
  const descEl = document.getElementById('hud-desc-txt');
  const actionLbl = document.getElementById('hud-action-label');

  if (badgeEl) badgeEl.textContent = data.badge;
  if (titleEl) titleEl.textContent = data.title;
  if (analogyEl) analogyEl.innerHTML = data.analogy;
  if (descEl) descEl.textContent = data.desc;
  if (actionLbl) actionLbl.textContent = data.actionLabel;

  const hud = DOM.hudTooltip;
  if (!hud) return;

  // DETERMINISTIC ANCHORING: Pin directly next to the (i) button!
  const rect = btnEl.getBoundingClientRect();
  const tooltipWidth = 320;
  const tooltipHeight = 240;

  let left = rect.right + 12;
  let top = rect.top - 20;

  // If overflows right, position to the left of the button
  if (left + tooltipWidth > window.innerWidth - 20) {
    left = rect.left - tooltipWidth - 12;
  }
  // Clamp vertical bounds
  if (top + tooltipHeight > window.innerHeight - 20) {
    top = window.innerHeight - tooltipHeight - 20;
  }
  if (top < 60) top = 60;

  hud.style.left = `${left}px`;
  hud.style.top = `${top}px`;
  hud.classList.add('hud-visible');
}

function toggleHudTooltip(e, topicKey) {
  e.stopPropagation();
  const btn = e.currentTarget || e.target.closest('.info-bubble-btn');
  if (!btn) return;

  if (isHudPinned && currentHudTopic === topicKey) {
    isHudPinned = false;
    hideHudTooltip();
  } else {
    isHudPinned = true;
    showHudTooltipForButton(btn, topicKey);
    window.AudioEngine.playBeep(520, 0.05);
  }
}

function scheduleHideHudTooltip() {
  if (hudHideTimeout) clearTimeout(hudHideTimeout);
  hudHideTimeout = setTimeout(() => {
    if (!isHudPinned) hideHudTooltip();
  }, 220);
}

function hideHudTooltip() {
  isHudPinned = false;
  if (DOM.hudTooltip) {
    DOM.hudTooltip.classList.remove('hud-visible');
  }
}

function triggerHudAction() {
  if (!currentHudTopic) return;
  const data = HUD_REGISTRY[currentHudTopic];
  if (!data) return;

  hideHudTooltip();
  window.AudioEngine.playBeep(640, 0.08);

  switch (data.actionType) {
    case 'tray-demo':
      openDeepdiveModal("Stack LIFO Trays Demo", `
        <div style="background:#09090b; padding:14px; border-radius:8px; border:1px solid #27272a; margin-bottom:12px;">
          <div style="font-size:11px; font-weight:800; color:var(--accent-indigo); margin-bottom:8px;">CALL STACK // LAST-IN, FIRST-OUT (LIFO)</div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="background:rgba(129,140,248,0.18); border:1px solid var(--accent-indigo); padding:8px 12px; border-radius:4px; display:flex; justify-content:space-between;">
              <span style="font-weight:700; color:#ffffff;">Tray 3: calculateTax(price)</span>
              <span style="color:#a1a1aa; font-size:10px;">TOP OF STACK (Active)</span>
            </div>
            <div style="background:rgba(56,189,248,0.12); border:1px solid #27272a; padding:8px 12px; border-radius:4px; display:flex; justify-content:space-between;">
              <span style="font-weight:700; color:#ffffff;">Tray 2: processOrder(orderId)</span>
              <span style="color:#71717a; font-size:10px;">Waiting for Tray 3</span>
            </div>
            <div style="background:rgba(56,189,248,0.06); border:1px solid #27272a; padding:8px 12px; border-radius:4px; display:flex; justify-content:space-between;">
              <span style="font-weight:700; color:#ffffff;">Tray 1: main(args)</span>
              <span style="color:#71717a; font-size:10px;">Root Method Tray</span>
            </div>
          </div>
        </div>
        <p><strong>Why is Stack so fast (0.001ms)?</strong><br>
        Because CPU hardware only moves a single pointer (RSP) up and down! It never scans or organizes: it just pushes a tray onto the top, and pops it off when done.</p>
      `);
      break;

    case 'warehouse-demo':
      openDeepdiveModal("Heap Warehouse & The GC Robot", `
        <div style="background:#09090b; padding:14px; border-radius:8px; border:1px solid #27272a; margin-bottom:12px;">
          <div style="font-size:11px; font-weight:800; color:var(--accent-emerald); margin-bottom:8px;">HEAP WAREHOUSE STORAGE (JVMS §2.5.3)</div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="background:rgba(52,211,153,0.14); border:1px solid var(--accent-emerald); padding:8px 12px; border-radius:4px;">
              <div style="display:flex; justify-content:space-between;">
                <span style="font-weight:700; color:#ffffff;">Shelf 0x4A2F: Dog ("Bruno", age: 3)</span>
                <span style="color:var(--accent-emerald); font-weight:800; font-size:10px;">2 Active Remotes</span>
              </div>
              <div style="font-size:10.5px; color:#94a3b8; margin-top:4px;">Safe! Pointed to by main.dog and modify.d.</div>
            </div>
            <div style="background:rgba(244,63,94,0.12); border:1px solid var(--accent-rose); padding:8px 12px; border-radius:4px;">
              <div style="display:flex; justify-content:space-between;">
                <span style="font-weight:700; color:#ffffff;">Shelf 0x7B9C: Dog ("Ghost", age: 1)</span>
                <span style="color:var(--accent-rose); font-weight:800; font-size:10px;">0 Active Remotes</span>
              </div>
              <div style="font-size:10.5px; color:#fca5a5; margin-top:4px;">Orphaned! The Garbage Collector robot will safely recycle this memory.</div>
            </div>
          </div>
        </div>
        <p><strong>The Garbage Collector Robot:</strong><br>
        If every remote pointing to a television in the warehouse is dropped or set to null, the TV becomes an orphan. The Garbage Collector robot sweeps the warehouse and recycles that space automatically!</p>
      `);
      break;

    case 'puzzle-answer':
      revealPuzzleAnswer();
      break;

    case 'test-aliasing':
      userTuneTv(1);
      flashLaserBeam();
      break;

    case 'flash-remote-1':
      flashLaserBeam();
      window.AudioEngine.playBeep(520, 0.08);
      break;

    case 'trace-beam':
      flashLaserBeam();
      const addrEl = document.getElementById('tv-hex-addr');
      if (addrEl) {
        addrEl.classList.add('sync-text-highlight');
        setTimeout(() => addrEl.classList.remove('sync-text-highlight'), 1200);
      }
      break;

    case 'open-notes':
      toggleNotesDrawer();
      break;
  }
}

function revealPuzzleAnswer() {
  const pCode = document.getElementById('puzzle-code-line');
  const pText = document.getElementById('puzzle-question-text');
  if (pCode) pCode.classList.add('sync-text-highlight');
  if (pText) {
    pText.innerHTML = `
      <div style="background:rgba(52,211,153,0.15); border:1px solid var(--accent-emerald); border-radius:5px; padding:8px 10px; margin-top:4px;">
        <span style="color:var(--accent-emerald); font-weight:800;">✨ THE ANSWER:</span><br>
        <strong>1. Variable <code>dog</code>:</strong> Lives on the <strong>Stack (Quick Desk)</strong> holding remote frequency <code>0x4A2F</code>.<br>
        <strong>2. Physical <code>Dog</code> object:</strong> Lives in the <strong>Heap (Big Warehouse)</strong> on shelf <code>0x4A2F</code>!
      </div>
    `;
  }
  window.AudioEngine.playBeep(640, 0.1);
}

function openDeepdiveModal(title, htmlContent) {
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body-content');
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = htmlContent;

  if (DOM.modalBackdrop) DOM.modalBackdrop.classList.add('backdrop-active');
  if (DOM.deepdiveModal) DOM.deepdiveModal.classList.add('modal-active');
}

function closeDeepdiveModal() {
  if (DOM.modalBackdrop) DOM.modalBackdrop.classList.remove('backdrop-active');
  if (DOM.deepdiveModal) DOM.deepdiveModal.classList.remove('modal-active');
}

// 6. DUAL-VIEW & NOTES DRAWER CONTROLS
function switchVisualView(viewMode) {
  PlayerState.visualMode = viewMode;
  const btnMet = document.getElementById('view-btn-metaphor');
  const btnRam = document.getElementById('view-btn-ram');
  if (viewMode === 'ram') {
    if (btnRam) btnRam.classList.add('active-view');
    if (btnMet) btnMet.classList.remove('active-view');
  } else {
    if (btnMet) btnMet.classList.add('active-view');
    if (btnRam) btnRam.classList.remove('active-view');
  }

  const curStep = PlayerState.cachedSteps[PlayerState.currentStepIndex];
  if (curStep) {
    renderStepView(curStep);
    document.querySelectorAll('.staged-element, .staged-from-left, .staged-from-right, .staged-pop')
      .forEach(el => el.classList.add('revealed'));
    if (curStep.step === 2) setTimeout(drawRemoteLaserBeams, 60);
  }
  window.AudioEngine.playBeep(560, 0.05);
}

function switchNotesTab(tabName) {
  const tabRev = document.getElementById('tab-btn-revision');
  const tabDet = document.getElementById('tab-btn-detailed');
  const contentRev = document.getElementById('notes-content-revision');
  const contentDet = document.getElementById('notes-content-detailed');

  if (tabName === 'revision') {
    if (tabRev) tabRev.classList.add('notes-tab-active');
    if (tabDet) tabDet.classList.remove('notes-tab-active');
    if (contentRev) contentRev.style.display = 'block';
    if (contentDet) contentDet.style.display = 'none';
  } else {
    if (tabDet) tabDet.classList.add('notes-tab-active');
    if (tabRev) tabRev.classList.remove('notes-tab-active');
    if (contentRev) contentRev.style.display = 'none';
    if (contentDet) contentDet.style.display = 'block';
  }
}

function copyMasterNotes() {
  const text = `JAVA MEMORY ARCHITECTURE & PASS-BY-VALUE MASTERCLASS NOTES
==========================================================
1. THE TWO ROOMS:
- Stack: Personal study desk for local variables & method call frames. Ultra-fast (0.001ms), automatic LIFO cleanup. If full: StackOverflowError.
- Heap: Big shared warehouse for all objects created with 'new'. Managed by Garbage Collector. If full: OutOfMemoryError.

2. THE TV REMOTE MODEL:
- Variables are TV Remotes holding an address (e.g. 0x4A2F), NOT the physical TV.
- 'Dog d2 = dog;' creates a duplicate remote pointed at the SAME TV (Aliasing)!

3. PASS-BY-VALUE:
- Java is 100% strictly Pass-by-Value!
- Passing an object copies the remote control's frequency code (0x4A2F), NEVER the physical television!
`;
  navigator.clipboard.writeText(text);
  alert("📋 Full Masterclass Revision & Architecture Notes copied to clipboard!");
}

// 7. INTERACTIVE STEP 2 MANIPULATIVES
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

// 8. RENDER STEP 3 SUB-STEPS
const IDE_TOKEN_BREAKDOWNS = [
  {
    token: "int age = 3;",
    desc_en: "🔍 <strong>Token Breakdown:</strong> <code>int</code> (32-bit primitive type) &bull; <code>age</code> (local variable identifier) &bull; <code>= 3</code> (direct integer bits placed into main's Stack Slot 1). JVMS Bytecode: <code>iconst_3</code> &rarr; <code>istore_1</code>.",
    desc_telugish: "🔍 <strong>Token Breakdown:</strong> <code>int</code> (32-bit primitive) &bull; <code>age</code> (local variable) &bull; <code>= 3</code> (direct raw value bits main stack slot 1 lo store aindi). Bytecode: <code>iconst_3</code> &rarr; <code>istore_1</code>."
  },
  {
    token: "Dog dog = new Dog(\"Bruno\", age);",
    desc_en: "🔍 <strong>Token Breakdown:</strong> <code>new Dog(...)</code> allocates 16-byte object on Heap at <code>0x4A2F</code> &bull; <code>dog</code> (Stack slot 2) receives only the 64-bit reference address (The TV Remote!). JVMS Bytecode: <code>new #2</code> &rarr; <code>dup</code> &rarr; <code>invokespecial #3</code> &rarr; <code>astore_2</code>.",
    desc_telugish: "🔍 <strong>Token Breakdown:</strong> <code>new Dog(...)</code> Heap warehouse lo <code>0x4A2F</code> daggara object build chesindi &bull; <code>dog</code> variable ki kevalam TV remote address vachindi. Bytecode: <code>new</code> &rarr; <code>dup</code> &rarr; <code>invokespecial</code> &rarr; <code>astore</code>."
  },
  {
    token: "modify(dog, age);",
    desc_en: "🔍 <strong>Token Breakdown:</strong> Pushes new Frame for <code>modify()</code> &bull; Parameter <code>d</code> gets duplicate remote (<code>0x4A2F</code>) &bull; Parameter <code>localAge</code> gets independent copy of number <code>3</code> (Pass-by-Value). JVMS Bytecode: <code>aload_2</code> &rarr; <code>iload_1</code> &rarr; <code>invokestatic #4</code>.",
    desc_telugish: "🔍 <strong>Token Breakdown:</strong> <code>modify()</code> kosam kotha tray push ayyindi &bull; <code>d</code> ki duplicate remote (<code>0x4A2F</code>) &bull; <code>localAge</code> ki 3 independent copy vachindi. Bytecode: <code>aload_2</code> &rarr; <code>iload_1</code> &rarr; <code>invokestatic</code>."
  },
  {
    token: "localAge = localAge + 5;",
    desc_en: "🔍 <strong>Token Breakdown:</strong> <code>localAge + 5</code> evaluates to 8 on operand stack &bull; Overwrites ONLY modify's local Slot 1. main's age note (3) is in an isolated frame and completely untouched! JVMS Bytecode: <code>iload_1</code> &rarr; <code>iconst_5</code> &rarr; <code>iadd</code> &rarr; <code>istore_1</code>.",
    desc_telugish: "🔍 <strong>Token Breakdown:</strong> <code>localAge + 5</code> modify tray meeda 8 ga marindi &bull; main frame lo unna age 3 alane safe ga undi! Bytecode: <code>iload_1</code> &rarr; <code>iconst_5</code> &rarr; <code>iadd</code> &rarr; <code>istore_1</code>."
  },
  {
    token: "d.setName(\"Rocky\");",
    desc_en: "🔍 <strong>Token Breakdown:</strong> Dereferences remote handle <code>0x4A2F</code> to reach single shared object on Heap shelf &bull; Mutates field 'name' to \"Rocky\". Both remotes see \"Rocky\" on screen! JVMS Bytecode: <code>aload_0</code> &rarr; <code>ldc #5</code> &rarr; <code>invokevirtual #6</code>.",
    desc_telugish: "🔍 <strong>Token Breakdown:</strong> Remote <code>0x4A2F</code> dwara Heap shelf meeda unna TV peru \"Rocky\" ga marindi &bull; Rendu remotes ki ippudu Rocky kanipisthundi! Bytecode: <code>aload_0</code> &rarr; <code>invokevirtual</code>."
  },
  {
    token: "d = new Dog(\"Max\", 1);",
    desc_en: "🔍 <strong>Token Breakdown:</strong> <code>new Dog(\"Max\", 1)</code> buys a second TV at heap address <code>0x7B9C</code> &bull; Reassigns ONLY modify's local remote. main's remote STILL points to Rocky (<code>0x4A2F</code>)! JVMS Bytecode: <code>new #2</code> &rarr; <code>dup</code> &rarr; <code>invokespecial</code> &rarr; <code>astore_0</code>.",
    desc_telugish: "🔍 <strong>Token Breakdown:</strong> <code>0x7B9C</code> daggara kotha TV konindi &bull; modify local remote ni daaniki marchindi. main remote inka Rocky (<code>0x4A2F</code>) ke point chesthundi! Bytecode: <code>new</code> &rarr; <code>astore_0</code>."
  },
  {
    token: "return (Method Cleanup)",
    desc_en: "🔍 <strong>Token Breakdown:</strong> <code>modify()</code> frame pops off Call Stack (RSP increments) &bull; Object <code>0x7B9C</code> has 0 active references (orphan) &rarr; Garbage Collector sweeps it safely! JVMS Bytecode: <code>return</code>.",
    desc_telugish: "🔍 <strong>Token Breakdown:</strong> <code>modify()</code> frame wipe aindi &bull; Object <code>0x7B9C</code> ki remotes levu kabatti Garbage Collector robot sweep chesthundi! Bytecode: <code>return</code>."
  }
];

function prevIdeSubStep() {
  if (PlayerState.ideSubStep > 0) {
    PlayerState.ideSubStep--;
    renderIdeSubStep(PlayerState.ideSubStep);
    window.AudioEngine.playBeep(440, 0.05);
  }
}

function nextIdeSubStep() {
  const stepData = PlayerState.cachedSteps[3];
  const max = (stepData && stepData.executionSteps) ? stepData.executionSteps.length - 1 : 6;
  if (PlayerState.ideSubStep < max) {
    PlayerState.ideSubStep++;
    renderIdeSubStep(PlayerState.ideSubStep);
    window.AudioEngine.playBeep(520, 0.05);
  }
}
window.prevIdeSubStep = prevIdeSubStep;
window.nextIdeSubStep = nextIdeSubStep;

function renderIdeSubStep(subStepIdx) {
  const stepData = PlayerState.cachedSteps[3];
  if (!stepData || !stepData.executionSteps) return;

  const sub = stepData.executionSteps[subStepIdx];
  if (!sub) return;

  document.querySelectorAll('.code-line-row').forEach(r => r.classList.remove('line-active'));
  const lineEl = document.getElementById('line-' + sub.activeLine);
  if (lineEl) lineEl.classList.add('line-active');

  const frameEl = document.getElementById('ide-active-frame-lbl');
  if (frameEl) frameEl.textContent = sub.frameName;

  const explEl = document.getElementById('ide-step-explainer');
  const isTelugish = PlayerState.language === 'telugish';
  if (explEl) explEl.innerHTML = formatScreenTextWithTerms(isTelugish ? sub.explainer_telugish : sub.explainer_en);

  const tokenBreakdownEl = document.getElementById('ide-token-breakdown');
  if (tokenBreakdownEl && IDE_TOKEN_BREAKDOWNS[subStepIdx]) {
    const b = IDE_TOKEN_BREAKDOWNS[subStepIdx];
    tokenBreakdownEl.innerHTML = isTelugish ? b.desc_telugish : b.desc_en;
  }

  const counterEl = document.getElementById('ide-step-counter');
  if (counterEl) counterEl.textContent = `STEP ${subStepIdx + 1} / 7`;

  const stackBody = document.getElementById('stack-slot-body');
  if (stackBody) {
    stackBody.innerHTML = sub.stack.map(item => `
      <div style="background:${item.highlight ? 'rgba(56, 189, 248, 0.16)' : '#0d0d11'}; border:1px solid ${item.highlight ? 'var(--accent-blue)' : '#27272a'}; border-radius:4px; padding:6px 10px; display:flex; justify-content:space-between; font-size:11px;">
        <span style="color:#ffffff; font-weight:700;">${item.name}</span>
        <span style="color:var(--accent-blue);">${item.val}</span>
      </div>
    `).join('');
  }

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

// 9. PLAYER TRANSPORT CONTROLLERS
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
  clearAllActiveTimers();
  window.AudioEngine.stopSpeech(); // Strictly silences all audio
}

function stepForward() {
  if (PlayerState.currentStepIndex < PlayerState.totalSteps) {
    loadAndRenderStep(PlayerState.currentStepIndex + 1, PlayerState.isPlaying);
  }
}

function stepBackward() {
  if (PlayerState.currentStepIndex > 1) {
    loadAndRenderStep(PlayerState.currentStepIndex - 1, PlayerState.isPlaying);
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

  if (PlayerState.manifest) renderDynamicStepPills(PlayerState.manifest);

  const curStep = PlayerState.cachedSteps[PlayerState.currentStepIndex];
  if (curStep) {
    renderStepView(curStep);
    if (PlayerState.isPlaying) {
      runStepPresentation(curStep);
    } else {
      document.querySelectorAll('.staged-element, .staged-from-left, .staged-from-right, .staged-pop')
        .forEach(el => el.classList.add('revealed'));
      if (curStep.step === 2) setTimeout(drawRemoteLaserBeams, 60);
    }
  }
  window.AudioEngine.playBeep(440, 0.05);
}

// 10. UI UPDATERS
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
  const total = PlayerState.totalSteps || 3;
  const cur = PlayerState.currentStepIndex;
  const pct = total > 1 ? ((cur - 1) / (total - 1)) * 100 : 100;
  if (DOM.scrubberFill) DOM.scrubberFill.style.width = Math.max(6, Math.min(100, pct)) + '%';
  if (DOM.timeCurrent) DOM.timeCurrent.textContent = `0${cur}:00`;
  if (DOM.timeTotal) DOM.timeTotal.textContent = `0${total}:00`;
}

function seekByClick(e) {
  const wrap = document.getElementById('scrubber-bar-wrap');
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const total = PlayerState.totalSteps || 3;
  const targetStep = Math.min(total, Math.max(1, Math.floor(ratio * total) + 1));
  loadAndRenderStep(targetStep, true);
}
window.seekByClick = seekByClick;

// 11. DRAGGABLE SUBTITLES (YouTube PIP Style)
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

// 12. KEYBOARD SHORTCUTS
function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      stepForward();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      stepBackward();
    } else if (e.key.toLowerCase() === 'm') {
      toggleStepMode();
    } else if (e.key.toLowerCase() === 'c') {
      toggleSubtitlesVisible();
    } else if (e.key.toLowerCase() === 'n') {
      toggleNotesDrawer();
    } else {
      // Dynamic keyboard navigation for ANY step 1..N
      const numKey = parseInt(e.key, 10);
      if (!isNaN(numKey) && numKey >= 1 && numKey <= PlayerState.totalSteps) {
        loadAndRenderStep(numKey, true);
      }
    }
  });
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Auto-boot on DOM ready
document.addEventListener('DOMContentLoaded', bootPlayerApp);
