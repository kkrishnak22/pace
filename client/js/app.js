// d:\pace\client\js\app.js
// Visual Lesson Engine: Bi-directional Visual Sync, Dual-View (Metaphor + RAM), Everywhere-Hover HUD

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
  activeTimelineTimers: [],
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
  if (PlayerState.activeTimelineTimers && PlayerState.activeTimelineTimers.length > 0) {
    PlayerState.activeTimelineTimers.forEach(t => clearTimeout(t));
    PlayerState.activeTimelineTimers = [];
  }
  clearSyncFocusClasses();
}

function clearSyncFocusClasses() {
  document.querySelectorAll('.sync-focused, .sync-focused-emerald, .sync-focused-amber')
    .forEach(el => el.classList.remove('sync-focused', 'sync-focused-emerald', 'sync-focused-amber'));
  document.querySelectorAll('.sync-text-highlight')
    .forEach(el => el.classList.remove('sync-text-highlight'));
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
    PlayerState.totalSteps = manifest.totalSteps || 3;
    const titleEl = document.getElementById('lesson-header-title');
    if (titleEl) titleEl.textContent = manifest.title_en;
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

// 2. STEP RENDERER & ORCHESTRATION
async function loadAndRenderStep(stepNumber, autoStart = true) {
  if (stepNumber < 1 || stepNumber > PlayerState.totalSteps) return;

  clearAllActiveTimers();
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

  if (autoStart) {
    PlayerState.isPlaying = true;
    updatePlayPauseIconUI();
    runStepPresentation(stepData);
  } else {
    // Show ready state with cards visible so user can pause and read
    const isTelugish = PlayerState.language === 'telugish';
    setSubtitleText(isTelugish ? stepData.narration_telugish : stepData.narration_en);
    document.querySelectorAll('.staged-element, .staged-from-left, .staged-from-right, .staged-pop')
      .forEach(el => el.classList.add('revealed'));
    if (stepNumber === 2) {
      setTimeout(drawRemoteLaserBeams, 60);
    }
  }
}

// Dynamic API Call for Step 3
async function fetchDynamicStep3() {
  PlayerState.isGeneratingApi = true;
  DOM.apiOverlay.style.display = 'flex';
  DOM.apiOverlayText.textContent = "⚡ Calling Lesson Engine API: POST /api/lesson/generate-step...";
  window.AudioEngine.playBeep(440, 0.1);

  const startTime = Date.now();
  const generated = await window.LessonAPI.generateStep(3, PlayerState.language);

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
      pill3.innerHTML = '<span>Step 3: Watching Memory Move</span> <span style="font-size:9px; background:#34d399; color:#09090b; padding:1px 5px; border-radius:3px; font-weight:800;">LIVE API</span>';
    }
    window.AudioEngine.playWhoosh();
  }
}

// Render HTML layout for each step inside fixed blackboard (Metaphor vs Physical RAM)
function renderStepView(stepData) {
  const isTelugish = PlayerState.language === 'telugish';
  const isRamView = PlayerState.visualMode === 'ram';
  const title = isTelugish ? stepData.title_telugish : stepData.title_en;
  const desc = isTelugish ? stepData.subtitle_telugish : stepData.subtitle_en;

  DOM.stepBadge.textContent = `STEP 0${stepData.step} // ${stepData.status === 'dynamically-generated' ? 'DYNAMIC ON-DEMAND API' : 'CORE PRINCIPLES'}`;
  DOM.stepTitle.innerHTML = title;
  DOM.stepDesc.innerHTML = desc;

  DOM.bodyMount.innerHTML = '';

  if (stepData.step === 1) {
    const c1 = stepData.cards[0];
    const c2 = stepData.cards[1];
    const pz = stepData.puzzle;

    if (isRamView) {
      // Physical RAM View (Real Computer Memory Reality)
      DOM.bodyMount.innerHTML = `
        <div class="step1-grid">
          <div class="room-card room-desk staged-from-left revealed" id="card-desk" data-hud-topic="stack-memory">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="room-badge" style="color:var(--accent-indigo);">PHYSICAL RAM // CALL STACK FRAME</div>
                <button class="info-bubble-btn" onclick="openHudTooltip(event, 'stack-memory')" title="Click for Stack Explainer">i</button>
              </div>
              <div class="room-title">CPU Stack Memory (RSP Pointer)</div>
              <div style="font-family:var(--font-mono); font-size:11px; background:#09090b; border:1px solid #27272a; border-radius:6px; padding:8px 10px; margin:8px 0;">
                <div style="color:#71717a; margin-bottom:4px;">Thread 1 &bull; main() Stack Frame (LIFO):</div>
                <div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid #18181b;">
                  <span style="color:#ffffff;">Slot 0: int age</span>
                  <span style="color:var(--accent-blue);">21 (Direct 32-bit Value)</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding:3px 0;">
                  <span style="color:#ffffff;">Slot 1: Dog dog</span>
                  <span style="color:var(--accent-emerald);">0x4A2F (64-bit Heap Pointer)</span>
                </div>
              </div>
            </div>
            <div id="c1-stats-pill" style="font-size:11px; color:#818cf8; font-family:var(--font-mono); margin-top:8px; padding:4px 8px; border-radius:4px; background:rgba(129,140,248,0.08); border:1px solid rgba(129,140,248,0.2);">
              Speed: 0.001ms (CPU Hardware RSP Register) &bull; If Full: StackOverflowError
            </div>
          </div>

          <div class="room-card room-warehouse staged-from-right revealed" id="card-warehouse" data-hud-topic="heap-memory">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="room-badge" style="color:var(--accent-emerald);">PHYSICAL RAM // HEAP STORAGE POOL</div>
                <button class="info-bubble-btn" onclick="openHudTooltip(event, 'heap-memory')" title="Click for Heap Explainer">i</button>
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
            <div class="puzzle-box staged-pop revealed" id="card-puzzle" data-hud-topic="mystery-puzzle">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:var(--accent-amber); font-weight:800; font-family:var(--font-mono); font-size:10px;">JVMS MEMORY MAPPING</span>
                <button class="info-bubble-btn" onclick="openHudTooltip(event, 'mystery-puzzle')">i</button>
              </div>
              <div style="font-size:11.5px; color:#fafafa; margin-top:4px; line-height:1.4;">
                Stack slot holds <strong>0x4A2F</strong> (bits). Heap shelf holds <strong>instance payload</strong>. Java always copies the bits in the stack slot!
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      // Intuitive Metaphor View (Desk & Warehouse)
      DOM.bodyMount.innerHTML = `
        <div class="step1-grid">
          <div class="room-card room-desk staged-from-left" id="card-desk" data-hud-topic="stack-memory">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="room-badge">${c1.badge}</div>
                <button class="info-bubble-btn" onclick="openHudTooltip(event, 'stack-memory')" title="Click for Simple English Explainer">i</button>
              </div>
              <div class="room-title">${isTelugish ? c1.title_telugish : c1.title_en}</div>
              <div class="room-desc" id="c1-desc">${isTelugish ? c1.desc_telugish : c1.desc_en}</div>
            </div>
            <div id="c1-stats-pill" style="font-size:11px; color:#818cf8; font-family:var(--font-mono); margin-top:8px; padding:4px 8px; border-radius:4px; background:rgba(129,140,248,0.08); border:1px solid rgba(129,140,248,0.2);">
              ${c1.stats}
            </div>
          </div>

          <div class="room-card room-warehouse staged-from-right" id="card-warehouse" data-hud-topic="heap-memory">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="room-badge">${c2.badge}</div>
                <button class="info-bubble-btn" onclick="openHudTooltip(event, 'heap-memory')" title="Click for Simple English Explainer">i</button>
              </div>
              <div class="room-title">${isTelugish ? c2.title_telugish : c2.title_en}</div>
              <div class="room-desc" id="c2-desc">${isTelugish ? c2.desc_telugish : c2.desc_en}</div>
            </div>
            
            <div class="puzzle-box staged-pop" id="card-puzzle" data-hud-topic="mystery-puzzle">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <div style="font-size:10.5px; font-weight:800; color:var(--accent-amber); font-family:var(--font-mono);">${pz.badge}</div>
                <button class="info-bubble-btn" onclick="openHudTooltip(event, 'mystery-puzzle')" title="Reveal Secret Answer">i</button>
              </div>
              <pre class="code-snippet" id="puzzle-code-line" style="margin:4px 0; padding:6px; border-radius:4px;">${pz.code}</pre>
              <div id="puzzle-question-text" style="font-size:11.5px; color:#fafafa; margin-top:6px; line-height:1.4;">${isTelugish ? pz.question_telugish : pz.question_en}</div>
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
          <div class="remote-box remote-active staged-from-left" id="remote-box-1" data-hud-topic="tv-remote">
            <div class="remote-header">
              <div style="display:flex; align-items:center; gap:6px;">
                <span>${stepData.remote1.name}</span>
                <button class="info-bubble-btn" onclick="openHudTooltip(event, 'tv-remote')" title="What is a TV Remote?">i</button>
              </div>
              <span class="freq-tag">${stepData.remote1.freq}</span>
            </div>
            <code class="code-snippet">${stepData.remote1.decl}</code>
            <div class="remote-actions">
              <button class="btn-remote-action" onclick="userTuneTv(1)">Age + 1</button>
              <button class="btn-remote-action" onclick="userRenameTv('Rocky')">Rename ("Rocky")</button>
            </div>
          </div>

          <div class="remote-box staged-from-left" id="remote-box-2" data-hud-topic="aliasing">
            <div class="remote-header">
              <div style="display:flex; align-items:center; gap:6px;">
                <span>${stepData.remote2.name}</span>
                <button class="info-bubble-btn" onclick="openHudTooltip(event, 'aliasing')" title="What is Aliasing?">i</button>
              </div>
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
          <div class="smart-tv-device staged-from-right" id="smart-tv-box" data-hud-topic="memory-address">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:800; color:var(--accent-emerald); font-family:var(--font-mono);">
              <div style="display:flex; align-items:center; gap:6px;">
                <span>${stepData.tv.label}</span>
                <button class="info-bubble-btn" onclick="openHudTooltip(event, 'memory-address')" title="What is address 0x4A2F?">i</button>
              </div>
              <span id="tv-hex-addr">${stepData.tv.address}</span>
            </div>
            <div class="tv-screen-content">
              <div>Dog Name: <strong id="tv-name-val" style="color:var(--accent-blue);">"${stepData.tv.name}"</strong></div>
              <div>Dog Age:&nbsp; <strong id="tv-age-val" style="color:var(--accent-amber);">${stepData.tv.age}</strong></div>
              <div style="font-size:10px; color:#71717a; margin-top:6px;">Active Remotes Pointing Here: <span id="tv-remotes-count" style="color:var(--accent-emerald); font-weight:800;">2</span></div>
            </div>
          </div>
          <div class="staged-pop" id="golden-rule-box" data-hud-topic="golden-rule" style="margin-top:12px; font-size:11.5px; background:#0d0d11; border:1px solid #27272a; border-radius:6px; padding:8px 12px; color:#cbd5e1; width:100%; position:relative;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-weight:800; color:var(--accent-amber); font-family:var(--font-mono); font-size:10px;">🌟 GOLDEN MEMORY LAW</span>
              <button class="info-bubble-btn" onclick="openHudTooltip(event, 'golden-rule')" title="Pass-by-Value Rule">i</button>
            </div>
            <div id="golden-rule-text">${isTelugish ? stepData.goldenAnchor_telugish : stepData.goldenAnchor_en}</div>
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
            ${stepData.codeLines.map(l => `<div class="code-line-row" id="line-${l.num}"><span style="color:#64748b; width:18px;">${l.num}</span><span>${escapeHtml(l.text)}</span></div>`).join('')}
          </div>
          <div style="margin-top:auto; padding-top:8px; border-top:1px solid #27272a; font-size:11.5px; color:#ffffff; font-weight:700;" id="ide-step-explainer">
            Step 1: main() initialized on top of the Call Stack.
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
  }
}

// 3. STEP PRESENTATION RUNNER (Live Synchronized Staging & Word-by-Word Voice Sync)
function runStepPresentation(stepData) {
  clearAllActiveTimers();
  window.Typewriter.cancelAll();

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

  // If starting presentation, reset staged elements to empty
  document.querySelectorAll('.staged-element, .staged-from-left, .staged-from-right, .staged-pop')
    .forEach(el => el.classList.remove('revealed'));
  clearLaserBeams();

  // BI-DIRECTIONAL TIMELINE SYNCHRONIZATION CUES (Voice & Screen Sync)
  if (stepData.step === 1) {
    // Cue 1 (T ~ 3.8s): Voice reaches "Room 1 is the Stack, your quick study desk..."
    const t1 = setTimeout(() => {
      const desk = document.getElementById('card-desk');
      const c1Desc = document.getElementById('c1-desc');
      const c1Pill = document.getElementById('c1-stats-pill');
      if (desk) {
        desk.classList.add('revealed', 'sync-focused');
        if (c1Desc) c1Desc.classList.add('sync-text-highlight');
        if (c1Pill) c1Pill.classList.add('sync-focused');
        window.AudioEngine.playWhoosh();
      }
    }, Math.round(3800 / speed));
    PlayerState.activeTimelineTimers.push(t1);

    // Cue 2 (T ~ 10.5s): Voice reaches "Room 2 is the Heap, the big shared warehouse..."
    const t2 = setTimeout(() => {
      const desk = document.getElementById('card-desk');
      const c1Desc = document.getElementById('c1-desc');
      if (desk) desk.classList.remove('sync-focused');
      if (c1Desc) c1Desc.classList.remove('sync-text-highlight');

      const warehouse = document.getElementById('card-warehouse');
      const c2Desc = document.getElementById('c2-desc');
      if (warehouse) {
        warehouse.classList.add('revealed', 'sync-focused-emerald');
        if (c2Desc) c2Desc.classList.add('sync-text-highlight');
        window.AudioEngine.playWhoosh();
      }
    }, Math.round(10500 / speed));
    PlayerState.activeTimelineTimers.push(t2);

    // Cue 3 (T ~ 17.5s): Voice reaches "Finally, look at our 30-Second Mystery at the bottom..."
    const t3 = setTimeout(() => {
      const warehouse = document.getElementById('card-warehouse');
      const c2Desc = document.getElementById('c2-desc');
      if (warehouse) warehouse.classList.remove('sync-focused-emerald');
      if (c2Desc) c2Desc.classList.remove('sync-text-highlight');

      const puzzle = document.getElementById('card-puzzle');
      const pCode = document.getElementById('puzzle-code-line');
      if (puzzle) {
        puzzle.classList.add('revealed', 'sync-focused-amber');
        if (pCode) pCode.classList.add('sync-text-highlight');
        window.AudioEngine.playBeep(620, 0.1);
      }
    }, Math.round(17500 / speed));
    PlayerState.activeTimelineTimers.push(t3);

    // Cue 4 (T ~ 24.0s): Smooth settle
    const t4 = setTimeout(() => {
      clearSyncFocusClasses();
    }, Math.round(24000 / speed));
    PlayerState.activeTimelineTimers.push(t4);

  } else if (stepData.step === 2) {
    // Cue 1 (T ~ 3.5s): Voice reaches "Instead, look at Remote 1 on the left..."
    const t1 = setTimeout(() => {
      const rem1 = document.getElementById('remote-box-1');
      if (rem1) {
        rem1.classList.add('revealed', 'sync-focused');
        window.AudioEngine.playWhoosh();
      }
    }, Math.round(3500 / speed));
    PlayerState.activeTimelineTimers.push(t1);

    // Cue 2 (T ~ 8.5s): Voice reaches "On the right, look at the Smart TV: this is the real Dog object..."
    const t2 = setTimeout(() => {
      const tv = document.getElementById('smart-tv-box');
      if (tv) {
        tv.classList.add('revealed', 'sync-focused-emerald');
        window.AudioEngine.playBeep(520, 0.08);
        setTimeout(drawRemoteLaserBeams, 250);
      }
    }, Math.round(8500 / speed));
    PlayerState.activeTimelineTimers.push(t2);

    // Cue 3 (T ~ 13.5s): Voice reaches "Now, what happens when you write Dog d2 = dog? ... Aliasing!"
    const t3 = setTimeout(() => {
      const rem2 = document.getElementById('remote-box-2');
      if (rem2) {
        rem2.classList.add('revealed', 'sync-focused');
        window.AudioEngine.playBeep(580, 0.08);
        setTimeout(drawRemoteLaserBeams, 250);
        setTimeout(flashLaserBeam, 600);
      }
    }, Math.round(13500 / speed));
    PlayerState.activeTimelineTimers.push(t3);

    // Cue 4 (T ~ 19.5s): Voice reaches "Remember our Golden Anchor: Java is always strictly pass-by-value..."
    const t4 = setTimeout(() => {
      const gBox = document.getElementById('golden-rule-box');
      if (gBox) {
        gBox.classList.add('revealed', 'sync-focused-amber');
        window.AudioEngine.playBeep(640, 0.1);
      }
    }, Math.round(19500 / speed));
    PlayerState.activeTimelineTimers.push(t4);

    // Cue 5 (T ~ 26.0s): Relax state
    const t5 = setTimeout(() => {
      clearSyncFocusClasses();
    }, Math.round(26000 / speed));
    PlayerState.activeTimelineTimers.push(t5);

  } else if (stepData.step === 3) {
    // Reveal IDE & Memory panels
    const t0 = setTimeout(() => {
      const ide = document.getElementById('step3-ide-panel');
      const mem = document.getElementById('step3-mem-panel');
      if (ide) ide.classList.add('revealed');
      if (mem) mem.classList.add('revealed');
      window.AudioEngine.playWhoosh();
    }, Math.round(600 / speed));
    PlayerState.activeTimelineTimers.push(t0);

    const subTimings = [800, 3600, 7500, 11500, 15500, 19500, 23000];
    subTimings.forEach((tMs, idx) => {
      const timer = setTimeout(() => {
        PlayerState.ideSubStep = idx;
        renderIdeSubStep(idx);
        window.AudioEngine.playBeep(480 + idx * 35, 0.05);

        const stackSlot = document.getElementById('slot-call-stack');
        const heapSlot = document.getElementById('slot-heap-storage');
        if (idx === 1 || idx === 4) {
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
      }, Math.round(tMs / speed));
      PlayerState.activeTimelineTimers.push(timer);
    });
  }

  // AUDIO SPEECH WITH REAL-TIME KARAOKE TRACKING
  window.AudioEngine.speak(narration, {
    language: PlayerState.language,
    onWordBoundary: highlightCaptionWord,
    onComplete: () => {
      document.querySelectorAll('.caption-word').forEach(w => {
        w.className = 'caption-word word-spoken';
      });

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
  }
}

// 5. EVERYWHERE-HOVER HUD TOOLTIP SYSTEM
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

function initHudMouseListeners() {
  const stage = document.getElementById('blackboard-stage');
  if (!stage) return;

  stage.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-hud-topic]');
    if (target) {
      const topicKey = target.getAttribute('data-hud-topic');
      showHudTooltip(e, topicKey);
    }
  });

  stage.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-hud-topic]');
    if (target) {
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
      scheduleHideHudTooltip();
    });
  }
}

function showHudTooltip(e, topicKey) {
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

  const x = e.clientX || 200;
  const y = e.clientY || 200;

  const tooltipWidth = 330;
  const tooltipHeight = 240;

  let left = x + 16;
  let top = y - 40;

  if (left + tooltipWidth > window.innerWidth - 20) {
    left = x - tooltipWidth - 16;
  }
  if (top + tooltipHeight > window.innerHeight - 20) {
    top = window.innerHeight - tooltipHeight - 20;
  }
  if (top < 60) top = 60;

  hud.style.left = `${left}px`;
  hud.style.top = `${top}px`;
  hud.classList.add('hud-visible');
}

function openHudTooltip(e, topicKey) {
  e.stopPropagation();
  showHudTooltip(e, topicKey);
  window.AudioEngine.playBeep(520, 0.05);
}

function scheduleHideHudTooltip() {
  if (hudHideTimeout) clearTimeout(hudHideTimeout);
  hudHideTimeout = setTimeout(() => {
    hideHudTooltip();
  }, 280);
}

function hideHudTooltip() {
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
  if (explEl) explEl.textContent = isTelugish ? sub.explainer_telugish : sub.explainer_en;

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
  const pct = ((PlayerState.currentStepIndex - 1) / (PlayerState.totalSteps - 1)) * 100;
  if (DOM.scrubberFill) DOM.scrubberFill.style.width = Math.max(8, Math.min(100, pct)) + '%';
  if (DOM.timeCurrent) DOM.timeCurrent.textContent = `0${PlayerState.currentStepIndex}:00`;
}

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
    } else if (e.key === '1') {
      loadAndRenderStep(1, true);
    } else if (e.key === '2') {
      loadAndRenderStep(2, true);
    } else if (e.key === '3') {
      loadAndRenderStep(3, true);
    } else if (e.key.toLowerCase() === 'm') {
      toggleStepMode();
    } else if (e.key.toLowerCase() === 'c') {
      toggleSubtitlesVisible();
    } else if (e.key.toLowerCase() === 'n') {
      toggleNotesDrawer();
    }
  });
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Auto-boot on DOM ready
document.addEventListener('DOMContentLoaded', bootPlayerApp);
