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
  initThreeAmbientScene();
  initDomainPicker();

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
    { pattern: /\b(int deposit = 500|int deposit|localDeposit|deposit|int balance|balance)\b/gi, key: 'variable-primitive', cls: 'term-var' },
    { pattern: /\b(BankAccount account|BankAccount jointCard|BankAccount b|BankAccount|account|jointCard|b)\b/gi, key: 'bankaccount-vs-account', cls: 'term-obj' },
    { pattern: /\b(new BankAccount|new)\b/gi, key: 'new-keyword', cls: 'term-keyword' },
    { pattern: /\b(Stack Memory|Stack Desk|Stack trays|Call Stack|Stack)\b/gi, key: 'stack-memory', cls: 'term-mem' },
    { pattern: /\b(Heap Memory|Heap Warehouse|Central Vault|Bank Vault|Vault|Heap)\b/gi, key: 'heap-memory', cls: 'term-mem' },
    { pattern: /\b(0x4A2F|0x7B9C|0x1000)\b/gi, key: 'memory-address', cls: 'term-mem' },
    { pattern: /\b(Aliasing|Debit Card 1|Debit Card 2|debit card|joint card|duplicate card)\b/gi, key: 'aliasing', cls: 'term-obj' },
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

// ==========================================================================
// MOTION GRAPHICS ENGINE (Anime.js v3 Integration for 60fps Butter-Smooth UI)
// ==========================================================================
let lastFocusedContainerId = null;
let currentSyncPhase = 0;

const MotionFX = {
  springIn(targets, fromX = 0, fromY = 20, delay = 0) {
    if (window.anime && targets) {
      window.anime({
        targets: targets,
        translateX: [fromX, 0],
        translateY: [fromY, 0],
        scale: [0.96, 1],
        opacity: [0, 1],
        delay: delay,
        easing: 'spring(1, 80, 12, 0)',
        duration: 750
      });
    }
  },

  pulseElement(el) {
    if (!el || !window.anime) return;
    window.anime({
      targets: el,
      scale: [1, 1.06, 1],
      duration: 280,
      easing: 'cubicBezier(0.16, 1, 0.3, 1)'
    });
  },

  drawCurvedLaser(svg, fromEl, toEl, options = {}) {
    if (!svg || !fromEl || !toEl) return null;
    const pRect = svg.getBoundingClientRect();
    const fRect = fromEl.getBoundingClientRect();
    const tRect = toEl.getBoundingClientRect();

    const x1 = fRect.right - pRect.left;
    const y1 = fRect.top + fRect.height / 2 - pRect.top;
    const x2 = tRect.left - pRect.left;
    const y2 = tRect.top + tRect.height / 2 - pRect.top;

    const dx = x2 - x1;
    const cp1x = x1 + dx * 0.45;
    const cp1y = y1;
    const cp2x = x1 + dx * 0.55;
    const cp2y = y2;
    const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;

    // Background guide
    const glowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    glowPath.setAttribute('d', d);
    glowPath.setAttribute('stroke', options.glowColor || 'rgba(56, 189, 248, 0.2)');
    glowPath.setAttribute('stroke-width', '4');
    glowPath.setAttribute('fill', 'none');
    svg.appendChild(glowPath);

    // Living flowing laser core
    const mainPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    mainPath.setAttribute('d', d);
    mainPath.setAttribute('stroke', options.color || '#38bdf8');
    mainPath.setAttribute('stroke-width', '2');
    mainPath.setAttribute('fill', 'none');
    mainPath.classList.add('laser-pulse-line');
    svg.appendChild(mainPath);

    // Traveling Photon Particle Dot
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', '3.5');
    circle.setAttribute('fill', options.color || '#38bdf8');
    svg.appendChild(circle);

    if (window.anime) {
      const pathEl = window.anime.path(mainPath);
      window.anime({
        targets: circle,
        translateX: pathEl('x'),
        translateY: pathEl('y'),
        easing: 'linear',
        duration: 1600,
        loop: true
      });
    }

    return { glowPath, mainPath, circle };
  },

  shootDataPacket(fromRect, toRect, label = '0x4A2F', color = '#38bdf8') {
    const stage = document.getElementById('stage-body-mount');
    if (!stage) return;
    const pRect = stage.getBoundingClientRect();
    const packet = document.createElement('div');
    packet.className = 'floating-data-packet';
    packet.textContent = label;
    packet.style.borderColor = color;
    packet.style.color = color;
    packet.style.left = `${fromRect.right - pRect.left}px`;
    packet.style.top = `${fromRect.top + fromRect.height / 2 - pRect.top - 12}px`;
    stage.appendChild(packet);

    if (window.anime) {
      window.anime({
        targets: packet,
        left: [fromRect.right - pRect.left, toRect.left - pRect.left],
        top: [fromRect.top + fromRect.height / 2 - pRect.top - 12, toRect.top + toRect.height / 2 - pRect.top - 12],
        scale: [0.8, 1.1, 1],
        opacity: [0, 1, 1, 0],
        easing: 'cubicBezier(0.16, 1, 0.3, 1)',
        duration: 850,
        complete: () => packet.remove()
      });
    } else {
      setTimeout(() => packet.remove(), 850);
    }
  },

  revealTriad(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const cards = el.querySelectorAll('.world-card');
    if (window.anime && cards.length > 0) {
      window.anime({
        targets: cards,
        translateY: [24, 0],
        scale: [0.94, 1],
        opacity: [0, 1],
        delay: window.anime.stagger(100),
        easing: 'spring(1, 80, 12, 0)',
        duration: 700
      });
    }
  }
};
window.MotionFX = MotionFX;

function highlightScreenWords(wordStr) {
  if (!wordStr) return;
  const clean = wordStr.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!clean || clean.length < 2) return;

  const stage = document.getElementById('stage-body-mount');
  if (!stage) return;

  // Clear previous word-active classes across the board
  stage.querySelectorAll('.screen-word.word-active').forEach(el => {
    el.classList.remove('word-active');
  });

  // STRICT CONTAINER SCOPING:
  // If no container is actively focused (e.g. general introduction),
  // NEVER randomly light up words inside cards that have not been reached!
  if (!lastFocusedContainerId) return;

  const targetContainer = document.getElementById(lastFocusedContainerId);
  if (!targetContainer) return;

  // Query ONLY within the actively focused container
  const scopedWords = targetContainer.querySelectorAll(`.screen-word[data-clean="${clean}"]`);
  let matchedElement = null;

  for (const el of scopedWords) {
    if (!el.classList.contains('word-spoken')) {
      matchedElement = el;
      break;
    }
  }

  // If all matching words in this card were already marked spoken, reuse the first occurrence
  if (!matchedElement && scopedWords.length > 0) {
    matchedElement = scopedWords[0];
  }

  if (matchedElement) {
    matchedElement.classList.add('word-active');
    MotionFX.pulseElement(matchedElement);
  }
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

    DOM.bodyMount.innerHTML = `
      <div class="step1-grid">
        <!-- Room 1: The Stack (Hardware LIFO Machine & Quick Study Desk) -->
        <div class="room-card room-desk staged-from-left revealed" id="card-desk">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div class="room-badge" style="color:var(--accent-indigo);">ROOM 1 // THE STACK (JVMS §2.6 LIFO)</div>
              <button class="info-bubble-btn" data-hud-topic="stack-memory" onclick="toggleHudTooltip(event, 'stack-memory')" title="Click for Stack Explainer">i</button>
            </div>
            <div class="room-title">${formatScreenTextWithTerms(isTelugish ? c1.title_telugish : c1.title_en)}</div>
            <div class="room-desc" id="c1-desc">${formatScreenTextWithTerms(isTelugish ? c1.desc_telugish : c1.desc_en)}</div>

            <!-- Living Stack Frame Slots Rack -->
            <div class="stack-rack-container" id="live-stack-rack">
              <div style="display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; font-family:var(--font-mono); margin-bottom:2px;">
                <span>CPU RSP &bull; main() Stack Frame</span>
                <span id="rsp-pointer-badge" style="color:var(--accent-indigo); font-weight:800;">RSP &rarr; Top of Stack</span>
              </div>
              <div class="stack-slot-cell" id="stack-slot-deposit">
                <span>Slot 1: <strong style="color:#ffffff;">int deposit</strong></span>
                <span style="color:var(--accent-blue); font-weight:800;">500 (Direct 32-bit Bits)</span>
              </div>
              <div class="stack-slot-cell" id="stack-slot-account">
                <span>Slot 2: <strong style="color:#ffffff;">BankAccount account</strong></span>
                <span style="color:var(--accent-emerald); font-weight:800;">0x4A2F (Debit Card Pointer)</span>
              </div>
            </div>

            <!-- Interactive Hardware Stack Stepper Buttons -->
            <div style="display:flex; gap:6px; margin-top:8px;">
              <button class="tactile-remote-btn" onclick="simulatePushFrame()" title="Simulate calling a helper method">+ Push Frame</button>
              <button class="tactile-remote-btn" onclick="simulatePopFrame()" title="Simulate method return">- Pop Frame</button>
            </div>
          </div>
          <div id="c1-stats-pill" style="font-size:10.5px; color:#818cf8; font-family:var(--font-mono); margin-top:8px; padding:4px 8px; border-radius:4px; background:rgba(129,140,248,0.08); border:1px solid rgba(129,140,248,0.2);">
            ⚡ 0.001ms Speed (Hardware RSP Register) &bull; If Full: StackOverflowError
          </div>
        </div>

        <!-- Room 2: The Heap (Central Bank Vault on the Heap) -->
        <div class="room-card room-warehouse staged-from-right revealed" id="card-warehouse">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div class="room-badge" style="color:var(--accent-emerald);">ROOM 2 // THE HEAP (JVMS §2.5.3 OBJECTS)</div>
              <button class="info-bubble-btn" data-hud-topic="heap-memory" onclick="toggleHudTooltip(event, 'heap-memory')" title="Click for Heap Explainer">i</button>
            </div>
            <div class="room-title">${formatScreenTextWithTerms(isTelugish ? c2.title_telugish : c2.title_en)}</div>
            <div class="room-desc" id="c2-desc">${formatScreenTextWithTerms(isTelugish ? c2.desc_telugish : c2.desc_en)}</div>

            <!-- Spatial Memory Grid & HotSpot 16B Anatomy -->
            <div class="heap-grid-visualizer">
              <div class="heap-shelf-block shelf-active" id="heap-shelf-4a2f">
                <div style="display:flex; justify-content:space-between; color:var(--accent-emerald); font-weight:800;">
                  <span>Vault 0x4A2F</span>
                  <span>16 Bytes RAM</span>
                </div>
                <div class="hotspot-byte-slice" style="background:#13131a; color:#a1a1aa;">
                  <span>Mark Word (8B):</span>
                  <span>HashCode &bull; GC Age 0</span>
                </div>
                <div class="hotspot-byte-slice" style="background:#0f172a; color:#38bdf8;">
                  <span>Klass Word (4B):</span>
                  <span>&rarr; BankAccount.class</span>
                </div>
                <div class="hotspot-byte-slice" style="background:#1c1917; color:#fbbf24;">
                  <span>Field 'balance' (4B):</span>
                  <span id="shelf-vault-bal">$500</span>
                </div>
              </div>

              <!-- Interactive Vault Manipulative Mini-Stage -->
              <div class="heap-shelf-block" style="justify-content:center; align-items:center; text-align:center;">
                <div class="vault-door-wheel-wrap" style="width:56px; height:56px;">
                  <div class="vault-lock-dial" id="step1-vault-dial" style="width:34px; height:34px; font-size:13px;">🔒</div>
                </div>
                <div id="heap-vault-balance-display" style="font-size:16px; color:var(--accent-emerald); font-weight:800; font-family:var(--font-mono); margin-top:4px;">$500</div>
                <div style="font-size:10px; color:#94a3b8; font-family:var(--font-mono);">Owner: Alice</div>
                <div style="display:flex; gap:4px; margin-top:4px;">
                  <button class="tactile-remote-btn" onclick="userDeposit(100, 1)" style="padding:3px 6px; font-size:9.5px;">+ $100</button>
                  <button class="tactile-remote-btn" onclick="userWithdraw(50, 1)" style="padding:3px 6px; font-size:9.5px;">- $50</button>
                  <button class="tactile-remote-btn" onclick="userAuditGc()" style="padding:3px 6px; font-size:9.5px;">🧹 GC</button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 30-Second Interview Mystery & Master Teacher Triad -->
          <div class="puzzle-box staged-pop revealed" id="card-puzzle" style="margin-top:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <div style="font-size:10.5px; font-weight:800; color:var(--accent-amber); font-family:var(--font-mono);">${pz.badge}</div>
              <button class="info-bubble-btn" data-hud-topic="bankaccount-vs-account" onclick="toggleHudTooltip(event, 'bankaccount-vs-account')" title="Reveal 3 Worlds Breakdown">i</button>
            </div>
            <pre class="code-snippet" id="puzzle-code-line" style="margin:4px 0; padding:6px; border-radius:4px;">${formatScreenTextWithTerms(pz.code)}</pre>
            <div id="puzzle-question-text" style="font-size:11.5px; color:#fafafa; margin-top:4px; line-height:1.4;">${formatScreenTextWithTerms(isTelugish ? pz.question_telugish : pz.question_en)}</div>
            <div style="margin-top:6px; display:flex; gap:8px;">
              <button onclick="revealPuzzleAnswer()" style="background:rgba(251,191,36,0.15); border:1px solid var(--accent-amber); color:var(--accent-amber); padding:4px 10px; border-radius:4px; font-size:10.5px; font-weight:800; cursor:pointer;">💡 Reveal 3 Worlds Breakdown</button>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (stepData.step === 2) {
    // Step 2: Tactical Debit Cards & Central Bank Vault
    DOM.bodyMount.innerHTML = `
      <div class="step2-sandbox" id="step2-sandbox">
        <svg id="laser-wire-svg"></svg>
        
        <!-- Left: Handheld Debit Cards (Stack References) -->
        <div class="remotes-column">
          
          <!-- Debit Card 1 (account: 0x4A2F) -->
          <div class="debit-card-chassis staged-from-left revealed" id="card-box-1">
            <div class="debit-card-top-row">
              <div class="debit-chip"></div>
              <div class="contactless-icon">📡</div>
            </div>
            <div class="card-emboss-addr" id="card-addr-1">${stepData.card1.addr}</div>
            <div class="card-holder-label">
              <span>HOLDER: <strong>${stepData.card1.holder}</strong></span>
              <span id="card-bal-preview-1" style="color:var(--accent-emerald); font-weight:800;">$500</span>
            </div>
            <div style="font-size:10px; color:#94a3b8; font-family:var(--font-mono); margin-top:2px;">
              STACK VAR: <span style="color:var(--accent-blue); font-weight:800;">account</span>
            </div>
            <div class="remote-keypad-grid" style="margin-top:6px;">
              <button class="tactile-remote-btn" onclick="userWithdraw(100, 1)">Withdraw $100</button>
              <button class="tactile-remote-btn" onclick="userDeposit(50, 1)">Deposit $50</button>
            </div>
          </div>

          <!-- Debit Card 2 (jointCard: 0x4A2F - Aliased Duplicate) -->
          <div class="debit-card-chassis staged-from-left revealed" id="card-box-2">
            <div class="debit-card-top-row">
              <div class="debit-chip"></div>
              <span style="font-size:9px; background:rgba(251,191,36,0.15); color:var(--accent-amber); border:1px solid var(--accent-amber); padding:1px 4px; border-radius:3px; font-weight:800; font-family:var(--font-mono);">JOINT (ALIASED)</span>
            </div>
            <div class="card-emboss-addr" id="card-addr-2">${stepData.card2.addr}</div>
            <div class="card-holder-label">
              <span>HOLDER: <strong>${stepData.card2.holder}</strong></span>
              <span id="card-bal-preview-2" style="color:var(--accent-emerald); font-weight:800;">$500</span>
            </div>
            <div style="font-size:10px; color:#94a3b8; font-family:var(--font-mono); margin-top:2px;">
              STACK VAR: <span style="color:var(--accent-emerald); font-weight:800;">jointCard</span>
            </div>
            <div class="remote-keypad-grid" style="margin-top:6px;">
              <button class="tactile-remote-btn" onclick="userWithdraw(100, 2)">Withdraw $100 (Bob)</button>
              <button class="tactile-remote-btn" onclick="userNullifyCard(2)" style="color:var(--accent-rose); border-color:rgba(239,68,68,0.3);">Shred Card (null)</button>
            </div>
          </div>

        </div>

        <!-- Right: Central Bank Vault Display (Heap Object) -->
        <div class="tv-column">
          <div class="bank-vault-cabinet staged-from-right revealed" id="bank-vault-box">
            <div class="vault-bezel-top">
              <span>CENTRAL BANK VAULT // HEAP MEMORY BLOCK</span>
              <span id="vault-hex-addr" style="color:var(--accent-emerald); font-weight:800;">0x4A2F</span>
            </div>
            <div class="vault-stage-body">
              <div class="vault-door-wheel-wrap">
                <div class="vault-lock-dial" id="main-vault-lock-dial">⚙️</div>
              </div>
              <div style="display:flex; flex-direction:column; gap:4px; font-family:var(--font-mono);">
                <div style="font-size:11px; color:#94a3b8;">SHARED VAULT BALANCE:</div>
                <div class="vault-balance-display" id="vault-balance-val">$${stepData.vault.balance}</div>
                <div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
                  <span class="vault-status-badge" id="vault-status-badge">
                    <span style="font-size:8px;">●</span>
                    <span id="vault-remotes-count">2 ACTIVE DEBIT CARDS</span>
                  </span>
                  <span style="font-size:10px; color:#94a3b8;">// 100% SOLVENT</span>
                </div>
              </div>
            </div>
            <div style="margin-top:10px; padding-top:6px; border-top:1px solid #22222a; font-family:var(--font-mono); font-size:10px; color:#94a3b8; display:flex; justify-content:space-between;">
              <span>HotSpot: 8B Mark + 4B Klass + 4B Balance = 16B</span>
              <span style="color:var(--accent-emerald); font-weight:800;">GC Roots Active</span>
            </div>
          </div>

          <!-- Pass-by-Value Golden Law Anchor -->
          <div class="staged-pop revealed" id="golden-rule-box" style="margin-top:10px; font-size:11.5px; background:#0d0d11; border:1px solid #27272a; border-radius:6px; padding:8px 12px; color:#cbd5e1; width:100%; position:relative;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-weight:800; color:var(--accent-amber); font-family:var(--font-mono); font-size:10px;">🌟 JLS §8.4.1 THE GOLDEN LAW</span>
              <button class="info-bubble-btn" data-hud-topic="golden-rule" onclick="toggleHudTooltip(event, 'golden-rule')" title="Pass-by-Value Rule">i</button>
            </div>
            <div id="golden-rule-text">${formatScreenTextWithTerms(isTelugish ? stepData.goldenAnchor_telugish : stepData.goldenAnchor_en)}</div>
          </div>
        </div>
      </div>
    `;
    setTimeout(drawRemoteLaserBeams, 80);
  } else if (stepData.step === 3) {
    // Step 3: JVMS Dual IDE & Live Memory Visualizer
    DOM.bodyMount.innerHTML = `
      <div class="step3-ide-grid">
        <div class="ide-editor-panel staged-from-left" id="step3-ide-panel">
          <div style="display:flex; justify-content:space-between; color:#71717a; font-size:10px; margin-bottom:6px; border-bottom:1px solid #27272a; padding-bottom:4px;">
            <span>BankingMasterclass.java</span>
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
              Token: int deposit = 500 &bull; Stored as 32-bit integer bits in Stack slot 1.
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
  // 1. Drive screen visuals & update active container focus FIRST
  syncScreenVisualsToSpokenPosition(charIndex);

  // 2. Highlight subtitle caption word and matching scoped screen words
  highlightCaptionWord(charIndex);
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

    if (charIndex < cue1) {
      if (lastFocusedContainerId !== null) {
        lastFocusedContainerId = null;
        clearSyncFocusClasses();
      }
    } else if (charIndex >= cue1 && charIndex < cue2) {
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
    const cue1 = Math.max(20, (text.indexOf("Debit Card 1") !== -1 ? text.indexOf("Debit Card 1") : (text.indexOf("Card 1") !== -1 ? text.indexOf("Card 1") : 75)) - 15);
    const cue2 = (text.indexOf("Central Bank Vault") !== -1 ? text.indexOf("Central Bank Vault") : (text.indexOf("Vault") !== -1 ? text.indexOf("Vault") : 180)) - 15;
    const cue3 = (text.indexOf("jointCard") !== -1 ? text.indexOf("jointCard") : text.indexOf("Aliasing")) - 15;
    const cue4 = (text.indexOf("Golden") !== -1 ? text.indexOf("Golden") : 400) - 15;

    if (charIndex >= cue1 && charIndex < cue2) {
      if (currentSyncPhase !== 1) {
        currentSyncPhase = 1;
        const card1 = document.getElementById('card-box-1');
        if (card1 && !card1.classList.contains('revealed')) {
          card1.classList.add('revealed');
          window.AudioEngine.playWhoosh();
        }
        setFocusedVisual('card-box-1', null, 'sync-focused');
      }
    } else if (charIndex >= cue2 && charIndex < cue3) {
      if (currentSyncPhase !== 2) {
        currentSyncPhase = 2;
        const vault = document.getElementById('bank-vault-box');
        if (vault && !vault.classList.contains('revealed')) {
          vault.classList.add('revealed');
          window.AudioEngine.playBeep(520, 0.08);
          setTimeout(drawRemoteLaserBeams, 100);
        }
        setFocusedVisual('bank-vault-box', null, 'sync-focused-emerald');
      }
    } else if (charIndex >= cue3 && charIndex < cue4) {
      if (currentSyncPhase !== 3) {
        currentSyncPhase = 3;
        const card2 = document.getElementById('card-box-2');
        if (card2 && !card2.classList.contains('revealed')) {
          card2.classList.add('revealed');
          window.AudioEngine.playBeep(580, 0.08);
          setTimeout(drawRemoteLaserBeams, 100);
          setTimeout(flashLaserBeam, 300);
        }
        setFocusedVisual('card-box-2', null, 'sync-focused');
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
// 5. OFFICIAL SPEC KNOWLEDGE PATHWAY REGISTRY (JLS / JVMS 4 MASTER TEACHER STAGES)
// ==========================================================================
const CONCEPT_REGISTRY = {
  'bankaccount-vs-account': {
    badge: '20+ YR MASTER TEACHER // 3 JVM REALMS',
    title: 'BankAccount (Class) vs. account (Variable) — The 3 Worlds of Java',
    analogy: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">💡 The 3 Worlds: Blueprint vs. Debit Card vs. Central Vault</div>
        <p>In the line <code>BankAccount account = new BankAccount("Alice", 1000);</code>, a beginner thinks there is only one entity called "account". A senior master teacher knows Java is coordinating <strong>three completely separate physical realms in computer RAM</strong>:</p>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin:12px 0;">
          <div style="background:#09090b; border:1px solid #38bdf8; border-radius:6px; padding:10px;">
            <div style="color:#38bdf8; font-weight:800; font-size:11px;">1. BankAccount (Capital B)</div>
            <div style="font-size:10.5px; color:#a1a1aa; margin-top:4px;"><strong>The Metaspace Blueprint</strong>. Just class metadata, bytecode, and method specifications. You cannot withdraw money from a blueprint!</div>
          </div>
          <div style="background:#09090b; border:1px solid #818cf8; border-radius:6px; padding:10px;">
            <div style="color:#818cf8; font-weight:800; font-size:11px;">2. account (Lowercase a)</div>
            <div style="font-size:10.5px; color:#a1a1aa; margin-top:4px;"><strong>The Debit Card in Your Pocket</strong> on the Stack desk. Holds only the 4-byte reference pointer <code>0x4A2F</code>. Reclaimed in 0.001ms when the method exits.</div>
          </div>
          <div style="background:#09090b; border:1px solid #34d399; border-radius:6px; padding:10px;">
            <div style="color:#34d399; font-weight:800; font-size:11px;">3. new BankAccount(...)</div>
            <div style="font-size:10.5px; color:#a1a1aa; margin-top:4px;"><strong>The Central Bank Vault</strong> on the Heap warehouse. Takes 16 bytes of RAM (Header + Fields). Managed and protected by the JVM Garbage Collector.</div>
          </div>
        </div>
      </div>
    `,
    spec: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🔬 JVMS §2.5, §2.6 & OpenJDK HotSpot Architecture</div>
        <div style="font-size:11.5px; color:#e4e4e7; line-height:1.5;">
          <p><strong>1. Metaspace (JVMS §2.5.4):</strong> Stores <code>InstanceKlass</code> metadata, constant pool, bytecode for <code>withdraw()</code> and <code>deposit()</code>. Loaded once into native process memory.</p>
          <p><strong>2. Stack Frame Local Variable Table (JVMS §2.6.1):</strong> Holds the 32-bit (Compressed OOP) or 64-bit reference address <code>0x4A2F</code> in Slot 2. Deallocated automatically on method return via CPU RSP register adjustment.</p>
          <p><strong>3. Heap Memory (JVMS §2.5.3):</strong> Allocates 16 bytes aligned to an 8-byte boundary:</p>
          <ul style="margin-left:18px; margin-top:4px; font-family:var(--font-mono); font-size:11px; color:#a1a1aa;">
            <li>[0..7] Mark Word (8 Bytes): Identity HashCode, GC Age (0..15), Biased Lock state bits.</li>
            <li>[8..11] Klass Word (4 Bytes): Compressed pointer to Metaspace <code>BankAccount.class</code>.</li>
            <li>[12..15] Payload Field: <code>int balance = 1000</code> (4 Bytes). Total = 16 bytes!</li>
          </ul>
        </div>
      </div>
    `,
    minilab: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">⚠️ The Classic Interview Trap (FAANG & University Exams)</div>
        <div style="background:#141418; padding:10px 12px; border-radius:6px; border:1px solid #27272a; margin:8px 0;">
          <div style="color:var(--accent-amber); font-weight:800; font-size:11px;">TRICK QUESTION:</div>
          <p style="margin:4px 0; font-size:11.5px;">If Bob executes <code>jointCard = null;</code>, did the Central Bank Vault in memory collapse?</p>
          <div style="margin-top:8px; padding-top:8px; border-top:1px solid #27272a; color:var(--accent-emerald); font-weight:700;">
            MASTER TEACHER VERDICT: Absolutely NOT!
          </div>
          <p style="font-size:11px; color:#a1a1aa; margin-top:4px;">Setting <code>jointCard = null</code> only zeros out Bob's 4-byte debit card pointer in his stack slot (<code>0x0000</code>). Alice's card (<code>account = 0x4A2F</code>) remains an active GC Root! The physical Central Bank Vault on the Heap remains 100% solvent, safe, and reachable.</p>
        </div>
      </div>
    `,
    pathway: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🧪 Interactive 3-World Banking Sandbox</div>
        <p>Experiment with modifying each of the 3 distinct realms:</p>
        <div style="display:flex; gap:8px; margin:10px 0; flex-wrap:wrap;">
          <button onclick="simulateWorldAction('nullify')" class="btn-ide-step" style="padding:6px 12px; background:rgba(239,68,68,0.2); border:1px solid var(--accent-rose); color:var(--accent-rose); border-radius:4px; font-weight:800; font-size:11px;">1. Shred Bob's Card (jointCard = null)</button>
          <button onclick="simulateWorldAction('withdraw')" class="btn-ide-step" style="padding:6px 12px; background:rgba(56,189,248,0.2); border:1px solid var(--accent-blue); color:var(--accent-blue); border-radius:4px; font-weight:800; font-size:11px;">2. Withdraw $200 (jointCard.withdraw(200))</button>
          <button onclick="simulateWorldAction('gc')" class="btn-ide-step" style="padding:6px 12px; background:rgba(52,211,153,0.2); border:1px solid var(--accent-emerald); color:var(--accent-emerald); border-radius:4px; font-weight:800; font-size:11px;">3. Audit GC Roots (System.gc())</button>
        </div>
        <div id="world-sim-status" style="font-family:var(--font-mono); font-size:11px; background:#09090b; border:1px solid #27272a; border-radius:6px; padding:8px 10px; color:#a1a1aa;">
          Ready. Click any action to watch the Stack, Heap, and Metaspace react in real time.
        </div>
      </div>
    `
  },
  'variable-primitive': {
    badge: 'JLS §4.2, §4.12 & JVMS §2.6.1 // VALUE-TYPE SEMANTICS',
    title: 'Primitive Variable (int deposit = 500 vs. account.balance = 1000)',
    analogy: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">💡 The Truth About Primitives: Local Variable vs. Object Field</div>
        <p>A common misconception in computer science is believing <em>"all primitive variables live on the Stack"</em>. In reality, <strong>where a variable is declared dictates where it lives in physical memory</strong>:</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:10px 0;">
          <div style="background:#09090b; border:1px solid #818cf8; border-radius:6px; padding:10px;">
            <div style="color:#818cf8; font-weight:800; font-size:11px;">1. Local Primitive (int deposit = 500)</div>
            <div style="font-size:10.5px; color:#a1a1aa; margin-top:4px;">Declared inside <code>main()</code>. Stored directly in the <strong>Thread's Stack Frame</strong> (Local Variable Table Slot 1). Holds the raw 32-bit integer bits directly. Zero GC overhead, cleared in 0.001 milliseconds when the method finishes!</div>
          </div>
          <div style="background:#09090b; border:1px solid #34d399; border-radius:6px; padding:10px;">
            <div style="color:#34d399; font-weight:800; font-size:11px;">2. Instance Field (account.balance = 1000)</div>
            <div style="font-size:10.5px; color:#a1a1aa; margin-top:4px;">Declared inside <code>class BankAccount { int balance; }</code>. Stored physically inside the <strong>BankAccount Object on the Heap</strong> at byte offset 12! It lives as long as the vault object is alive.</div>
          </div>
        </div>
        <p style="font-size:11px; color:#cbd5e1;">When you call <code>processTransaction(account, deposit)</code>, Java reads the raw 32 bits from <code>main</code>'s local deposit variable, copies them into the method's parameter slot, and isolates them completely. Modifying one has <strong>zero effect</strong> on the other!</p>
      </div>
    `,
    spec: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🔬 Official Specifications (JLS §4.2, §4.12 & JVMS §2.6.1)</div>
        <div style="font-size:11.5px; color:#e4e4e7; line-height:1.5;">
          <p><strong>1. Direct Value Storage (JLS §4.12.1):</strong> A variable of a primitive type always holds the raw value of that type, never a pointer or reference address. For <code>int</code>, this is a 32-bit signed two's-complement integer.</p>
          <p><strong>2. Bytecode Execution (JVMS §6.5):</strong></p>
          <ul style="margin-left:18px; margin-top:4px; font-family:var(--font-mono); font-size:11px; color:#a1a1aa;">
            <li><code>sipush 500</code> &rarr; Pushes literal integer 500 onto the operand stack.</li>
            <li><code>istore_1</code> &rarr; Pops 500 and writes raw 32 bits into Local Variable Array slot 1 (<code>deposit</code>).</li>
            <li><code>iload_1</code> &rarr; Reads 32 bits from slot 1 to evaluate expressions or pass to methods.</li>
          </ul>
          <p><strong>3. Zero Heap Footprint:</strong> A local primitive has no object header, no Klass pointer, and no garbage collection overhead. Managed entirely by the CPU hardware stack pointer (RSP) in 0.001 milliseconds.</p>
        </div>
      </div>
    `,
    minilab: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">⚠️ The Classic Interview Trap (Pass-by-Value Proof)</div>
        <div style="background:#141418; padding:10px 12px; border-radius:6px; border:1px solid #27272a; margin:8px 0;">
          <div style="color:var(--accent-amber); font-weight:800; font-size:11px;">TRICK QUESTION:</div>
          <pre class="code-snippet" style="margin:4px 0; padding:6px; font-size:11px;">void addBonus(int deposit) { deposit = deposit + 100; }
int myDeposit = 500;
addBonus(myDeposit);
System.out.println(myDeposit); // What prints: 500 or 600?</pre>
          <div style="margin-top:6px; padding-top:6px; border-top:1px solid #27272a; color:var(--accent-emerald); font-weight:700;">
            MASTER TEACHER VERDICT: Prints 500!
          </div>
          <p style="font-size:11px; color:#a1a1aa; margin-top:4px;">Under JLS §8.4.1, Java is <strong>strictly Pass-by-Value</strong>. The method <code>addBonus()</code> receives a completely separate copy of the 32 bits in its own isolated stack frame. When <code>addBonus()</code> returns, its stack frame is instantly destroyed by RSP. <code>main</code>'s <code>myDeposit</code> was never touched!</p>
        </div>
      </div>
    `,
    pathway: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🧪 Interactive Stack vs. Heap Deposit Simulator</div>
        <p>Watch how modifying the local variable compares to modifying the Heap object field:</p>
        <div style="background:#09090b; padding:10px 12px; border-radius:6px; border:1px solid #27272a; margin:8px 0; font-family:var(--font-mono); font-size:11px;">
          <div>[STACK FRAME] main() Slot 1: int deposit = <strong style="color:var(--accent-blue);" id="lab-prim-main">500</strong></div>
          <div>[STACK FRAME] processTransaction() Slot 1: int localDeposit = <strong style="color:var(--accent-emerald);" id="lab-prim-mod">500</strong></div>
          <div>[HEAP STORAGE] BankAccount at 0x4A2F &rarr; Field 'balance' = <strong style="color:var(--accent-amber);" id="lab-prim-heap">1000</strong></div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button onclick="testPrimitiveMutation()" class="btn-ide-step" style="padding:6px 12px; font-weight:800; background:var(--accent-blue); color:#09090b; border:none; border-radius:4px; font-size:11px;">1. Mutate localDeposit += 100</button>
          <button onclick="testHeapFieldMutation()" class="btn-ide-step" style="padding:6px 12px; font-weight:800; background:var(--accent-amber); color:#09090b; border:none; border-radius:4px; font-size:11px;">2. Mutate vault.balance -= 200</button>
        </div>
        <div id="lab-prim-result" style="margin-top:8px; font-size:11px; color:#94a3b8; font-family:var(--font-mono);">Click an action to verify memory isolation!</div>
      </div>
    `
  },
  'object-reference': {
    badge: 'JLS §4.3 // REFERENCE VALUES',
    title: 'Object Reference (e.g. BankAccount account)',
    analogy: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">💡 The Tactical Debit Card Model</div>
        <p>An object variable in Java is NOT the physical object! It is a <strong>Tactile Debit Card</strong> encoded with account address <code>0x4A2F</code>. The actual physical Central Bank Vault lives in the Heap Warehouse. Passing an object copies the debit card pointer, NEVER the vault itself!</p>
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
        <div class="cmodal-section-title">⚡ Debit Card Signal & Address Inspection</div>
        <div style="font-family:var(--font-mono); background:#141418; padding:8px 12px; border-radius:6px; border:1px solid #27272a; margin:8px 0;">
          Stack Slot: BankAccount account = <span style="color:var(--accent-emerald);">0x4A2F</span> &rarr; Points to Heap: BankAccount("Alice", $1000)
        </div>
        <button onclick="flashLaserBeam(); window.AudioEngine.playBeep(640, 0.08);" class="btn-ide-step" style="padding:6px 14px; background:var(--accent-emerald); color:#09090b; font-weight:800; border:none; border-radius:4px;">Fire Transaction Signal 📡</button>
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
        <div class="cmodal-section-title">💡 Constructing the Central Vault</div>
        <p>Writing <code>new</code> instructs the JVM to construct a brand new physical object on the Heap. It reserves space on an open heap block, runs the constructor to initialize fields, and hands you back the memory address (<code>0x4A2F</code>).</p>
      </div>
    `,
    spec: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🏛️ JVMS §6.5 Bytecode Sequence</div>
        <ol style="margin-left:18px; margin-top:6px;">
          <li><code>new #2 &lt;BankAccount&gt;</code>: Allocates memory on the heap and zeros fields.</li>
          <li><code>dup</code>: Duplicates reference on top of operand stack.</li>
          <li><code>invokespecial #3 &lt;BankAccount.&lt;init&gt;&gt;</code>: Calls constructor with arguments.</li>
        </ol>
      </div>
    `,
    minilab: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">⚡ Heap Allocation Simulation</div>
        <p>Memory reserved on heap: <strong>16 Bytes</strong> (12B header + 4B int balance).</p>
        <button onclick="window.AudioEngine.playWhoosh();" class="btn-ide-step" style="padding:6px 14px; background:var(--accent-amber); color:#09090b; font-weight:800; border:none; border-radius:4px;">Allocate New BankAccount Vault 📦</button>
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
          <li><strong>Local Variable Table:</strong> Method parameters and local primitives (int deposit = 500) and reference pointers (account = 0x4A2F).</li>
          <li><strong>Operand Stack:</strong> High-speed CPU workspace where calculations are performed.</li>
          <li><strong>Frame Data:</strong> Constant pool references and method return information.</li>
        </ul>
      </div>
    `,
    minilab: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">⚡ Call Stack LIFO Simulation</div>
        <div style="background:#141418; padding:8px 12px; border-radius:6px; border:1px solid #27272a; font-family:var(--font-mono);">
          <div>[TOP] Frame 2: processTransaction(BankAccount b, int localDeposit) - Active</div>
          <div>[ROOT] Frame 1: main(String[] args) - Paused</div>
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
    title: 'Heap Memory (The Central Bank Vault)',
    analogy: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">💡 The Shared Central Bank Vault</div>
        <p>A massive, global bank vault shared by all threads. Whenever you write <code>new BankAccount()</code>, an object is constructed on a heap shelf. It stays safe and solvent as long as an active debit card points to it.</p>
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
          Vault 0x7B9C: BankAccount("Bob", $2000) &bull; Active Debit Cards: 0 (Orphan)
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
        <div class="cmodal-section-title">💡 Bank Vault Account Coordinate</div>
        <p>Just like a bank routing number tells the clearing house where funds are kept, <code>0x4A2F</code> tells the CPU exactly which 16-byte block in physical RAM holds this BankAccount vault.</p>
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
        <p>Use <strong>JOL (Java Object Layout)</strong> to inspect memory addresses, object headers, and padding in real applications: <code>ClassLayout.parseInstance(account).toPrintable()</code>.</p>
      </div>
    `
  },
  'aliasing': {
    badge: 'JLS §4.3.1 // ALIASING',
    title: 'Aliasing (Two Debit Cards, One Bank Vault)',
    analogy: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">💡 Two Debit Cards, One Shared Bank Vault</div>
        <p>Writing <code>BankAccount jointCard = account;</code> does NOT build a second vault! It simply gives Bob a joint debit card programmed with the identical vault address (<code>0x4A2F</code>). Withdrawing through Bob's card immediately alters the balance Alice sees on her mobile app!</p>
      </div>
    `,
    spec: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🏛️ JLS §4.3.1 Specification</div>
        <p>Writing <code>jointCard = account;</code> copies the 4-byte reference pointer <code>0x4A2F</code> into <code>jointCard</code>'s stack slot. Both reference variables now point to the identical heap object instance.</p>
      </div>
    `,
    minilab: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">⚡ Aliasing Mutation Simulator</div>
        <div style="font-family:var(--font-mono); background:#141418; padding:8px 12px; border-radius:6px; border:1px solid #27272a; margin-bottom:8px;">
          Shared Vault Balance = <strong style="color:var(--accent-blue);" id="lab-alias-name">$1000</strong>
        </div>
        <button onclick="testAliasingLab()" class="btn-ide-step" style="padding:6px 14px; background:var(--accent-emerald); color:#09090b; font-weight:800; border:none; border-radius:4px;">Execute: jointCard.withdraw(200) 💳</button>
        <div id="lab-alias-result" style="margin-top:8px; font-size:11px; color:#94a3b8;">Click to verify that Card 1 (account) also sees $800!</div>
      </div>
    `,
    pathway: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">🎯 Architectural Defense</div>
        <p>How to prevent accidental aliasing bugs? Use <strong>Defensive Copying</strong> (Joshua Bloch <em>Effective Java</em> Item 50) or <strong>Immutable Objects</strong> (e.g. Java Records or <code>final</code> fields)!</p>
      </div>
    `
  },
  'pass-by-value': {
    badge: 'JLS §8.4.1 // PASS-BY-VALUE',
    title: 'Java is STRICTLY Pass-by-Value',
    analogy: `
      <div class="cmodal-section">
        <div class="cmodal-section-title">💡 Photocopying the Debit Card</div>
        <p>Java ALWAYS passes by value. Passing an object copies the debit card's 4-byte address code (<code>0x4A2F</code>). Both methods now have cards pointing to the same vault, but neither method has access to the caller's variable!</p>
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
        <p><code>void processTransaction(BankAccount b) { b = new BankAccount("Bob", 2000); }</code></p>
        <p style="color:var(--accent-emerald);">Does main's account change to Bob? <strong>NO!</strong> You only reassigned processTransaction's local copy of the debit card!</p>
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
        <p>An automated cleaning robot that periodically scans the heap warehouse. If a central bank vault has ZERO debit cards pointing to it (orphan with 0 GC roots), the robot safely dismantles and recycles the 16-byte memory block to free up space for future allocations.</p>
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
    'bankaccount': 'bankaccount-vs-account',
    'account': 'bankaccount-vs-account',
    'bankaccount-vs-account': 'bankaccount-vs-account',
    'debit-card': 'bankaccount-vs-account',
    'vault': 'heap-memory',
    'deposit': 'variable-primitive',
    'balance': 'variable-primitive',
    'class': 'bankaccount-vs-account',
    'blueprint': 'bankaccount-vs-account',
    'mystery-puzzle': 'bankaccount-vs-account',
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
    'gc': 'garbage-collector',
    'stackoverflow': 'stackoverflow-error',
    'outofmemory': 'outofmemory-error'
  };

  const resolvedKey = aliasMap[conceptKey] || conceptKey;
  const data = CONCEPT_REGISTRY[resolvedKey] || CONCEPT_REGISTRY['bankaccount-vs-account'];
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

function simulateWorldAction(action) {
  const statusEl = document.getElementById('world-sim-status');
  if (!statusEl) return;
  if (action === 'nullify') {
    statusEl.innerHTML = `<span style="color:var(--accent-rose); font-weight:800;">[1. STACK FRAME UPDATED]</span> Slot: jointCard = <strong style="color:var(--accent-rose);">null (0x0000)</strong>.<br>Bob's debit card is shredded, but Alice's card still points to Vault 0x4A2F &bull; Vault remains 100% solvent on the Heap!`;
    window.AudioEngine.playBeep(320, 0.1);
  } else if (action === 'withdraw') {
    statusEl.innerHTML = `<span style="color:var(--accent-blue); font-weight:800;">[2. SIGNAL INVOKED]</span> jointCard &rarr; Vault 0x4A2F &rarr; withdraw(200) &rarr; 💳 Vault balance updated from $1000 to $800! Alice also observes $800!`;
    window.AudioEngine.playBeep(720, 0.08);
  } else if (action === 'gc') {
    statusEl.innerHTML = `<span style="color:var(--accent-emerald); font-weight:800;">[3. TRACING GC AUDIT]</span> Garbage Collector traces from GC Roots (Thread stack). Alice's active card keeps Vault 0x4A2F reachable and safe!`;
    window.AudioEngine.playBeep(520, 0.12);
  }
}
window.simulateWorldAction = simulateWorldAction;

function testPrimitiveMutation() {
  const mainEl = document.getElementById('lab-prim-main');
  const modEl = document.getElementById('lab-prim-mod');
  const resEl = document.getElementById('lab-prim-result');
  if (modEl) {
    modEl.textContent = '600';
    modEl.style.color = '#34d399';
  }
  if (mainEl) {
    mainEl.textContent = '500';
    mainEl.style.color = '#38bdf8';
  }
  if (resEl) {
    resEl.innerHTML = '<span style="color:#34d399; font-weight:800;">PASS-BY-VALUE PROOF (JLS §8.4.1):</span> processTransaction() added 100 to its own local parameter (now 600), but main()\'s Stack slot is 100% UNTOUCHED (still 500)!';
  }
  window.AudioEngine.playBeep(640, 0.08);
}
window.testPrimitiveMutation = testPrimitiveMutation;

function testHeapFieldMutation() {
  const heapEl = document.getElementById('lab-prim-heap');
  const mainEl = document.getElementById('lab-prim-main');
  const resEl = document.getElementById('lab-prim-result');
  if (heapEl) {
    let cur = parseInt(heapEl.textContent, 10) || 1000;
    cur -= 200;
    heapEl.textContent = cur;
    heapEl.style.color = '#fbbf24';
  }
  if (mainEl) {
    mainEl.textContent = '500';
  }
  if (resEl) {
    resEl.innerHTML = '<span style="color:#fbbf24; font-weight:800;">HEAP ISOLATION PROOF:</span> Mutated field \'balance\' inside Central Vault object (now 800), while main()\'s local variable \'deposit\' on the Stack remains strictly 500!';
  }
  window.AudioEngine.playBeep(580, 0.08);
}
window.testHeapFieldMutation = testHeapFieldMutation;

function testAliasingLab() {
  const tvEl = document.getElementById('lab-alias-name');
  const resEl = document.getElementById('lab-alias-result');
  if (tvEl) {
    tvEl.textContent = '$800';
    tvEl.style.color = '#34d399';
  }
  if (resEl) {
    resEl.innerHTML = '<span style="color:#34d399; font-weight:800;">ALIASING PROOF:</span> Withdrawing through Card 2 (jointCard) instantly updated what Card 1 (account) observes in the shared vault!';
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
    shelf.innerHTML = '<span style="color:#f43f5e; font-weight:800;">[RECLAIMED BY TRACING GC] Free Vault Space</span>';
  }
  if (resEl) {
    resEl.innerHTML = '<span style="color:#34d399; font-weight:800;">AUTOMATIC CLEANUP:</span> Vault 0x7B9C had zero active debit card handles, so the Tracing GC recycled it!';
  }
  window.AudioEngine.playBeep(320, 0.1);
}
window.testGcSweepLab = testGcSweepLab;

// 5. STANDARDIZED & ACCURATE HUD TOOLTIP SYSTEM
const HUD_REGISTRY = {
  'stack-memory': {
    badge: 'JVMS §2.6 // THE QUICK DESK',
    title: 'Stack Memory (The Quick Study Desk)',
    analogy: '💡 <strong>Everyday Analogy:</strong> Think of a student study desk with trays. Every running method gets its own neat tray. It is right in front of you, blazing fast (0.001ms), and swept clean the moment your method finishes!',
    desc: 'Stores primitive variables (int deposit = 500) and debit card reference pointers. Managed by the CPU hardware RSP register in LIFO order with zero GC overhead.',
    actionLabel: '⚡ See LIFO Stack Rack',
    actionType: 'tray-demo'
  },
  'heap-memory': {
    badge: 'JVMS §2.5.3 // THE CENTRAL VAULT',
    title: 'Heap Memory (The Central Bank Vault)',
    analogy: '💡 <strong>Everyday Analogy:</strong> Think of a secure central bank vault. Whenever you write "new BankAccount()", a 16-byte vault is constructed on the heap. It stays secure and solvent as long as someone has a debit card for it.',
    desc: 'Universal shared storage pool where all Java object instances and arrays reside. Lifetime is dynamic, kept organized and clean by the JVM Garbage Collector.',
    actionLabel: '📦 Inspect Vault Block',
    actionType: 'warehouse-demo'
  },
  'mystery-puzzle': {
    badge: 'INTERVIEW PUZZLE // CORE SECRET',
    title: 'Where Does BankAccount account = new BankAccount() Live?',
    analogy: '💡 <strong>The Secret:</strong> The variable "account" and the physical "BankAccount" object live in TWO completely separate rooms! Never confuse the plastic debit card in your pocket with the steel vault on the heap.',
    desc: 'The variable "account" sits on your Quick Desk (Stack), holding a 4-byte reference pointer (0x4A2F). The actual BankAccount instance lives in the Central Vault (Heap).',
    actionLabel: '💡 Reveal Full Memory Map',
    actionType: 'puzzle-answer'
  },
  'bankaccount-vs-account': {
    badge: '20+ YR MASTER TEACHER // 3 REALMS',
    title: 'BankAccount (Class) vs. account (Variable)',
    analogy: '💡 <strong>The 3 Realms:</strong> Blueprint in Metaspace vs. Debit Card in Pocket (Stack) vs. Physical Vault on the Heap. They coordinate across 3 separate physical memory areas!',
    desc: 'Never confuse the blueprint with the reference card or the physical heap object instance.',
    actionLabel: '🔬 Open Concept Pathway',
    actionType: 'pathway-modal'
  },
  'debit-card': {
    badge: 'THE #1 MENTAL MODEL // REFERENCES',
    title: 'Object Reference = Tactical Debit Card',
    analogy: '💡 <strong>The Debit Card Model:</strong> You don\'t carry the bank vault around in your wallet; you hold a debit card encoded with account address 0x4A2F. That card is your Java reference variable!',
    desc: 'An object variable does not contain the object data. It contains only the hexadecimal memory address (0x4A2F) that points to the central vault in heap memory.',
    actionLabel: '📡 Fire Card Signal',
    actionType: 'flash-remote-1'
  },
  'tv-remote': {
    badge: 'THE #1 MENTAL MODEL // REFERENCES',
    title: 'Object Reference = Tactical Debit Card',
    analogy: '💡 <strong>The Debit Card Model:</strong> You hold a debit card encoded with address 0x4A2F. That card is your Java reference variable pointing to the vault on the heap!',
    desc: 'An object variable contains only the hexadecimal memory address (0x4A2F) that points to the object in heap memory.',
    actionLabel: '📡 Fire Card Signal',
    actionType: 'flash-remote-1'
  },
  'aliasing': {
    badge: 'CORE INTERVIEW CONCEPT // ALIASING',
    title: 'Aliasing (Two Debit Cards, One Bank Vault)',
    analogy: '💡 <strong>Joint Account:</strong> Writing BankAccount jointCard = account did NOT build a second vault! It simply issued Bob a joint debit card programmed with the same vault address (0x4A2F).',
    desc: 'When two reference variables hold the identical memory address, changing the balance through one card immediately affects what the second card observes.',
    actionLabel: '⚡ Test Aliasing (-$100)',
    actionType: 'test-aliasing'
  },
  'memory-address': {
    badge: 'PHYSICAL MEMORY ADDRESS // 0x4A2F',
    title: 'Memory Address (0x4A2F)',
    analogy: '💡 <strong>Physical Coordinate:</strong> Just like a bank account number: 0x4A2F tells the computer CPU exactly which 16-byte block in physical RAM holds this vault.',
    desc: 'A 32-bit (Compressed OOP) or 64-bit hexadecimal coordinate pointing to the object header, mark word, and instance variables residing in the JVM heap space.',
    actionLabel: '📡 Trace Laser Bus',
    actionType: 'trace-beam'
  },
  'golden-rule': {
    badge: 'THE GOLDEN ANCHOR // PASS-BY-VALUE',
    title: 'Java is STRICTLY Pass-by-Value',
    analogy: '💡 <strong>Photocopying the Debit Card:</strong> Passing an object to a method copies the card\'s 4-byte address bits. Both methods now have cards pointing to the same vault, but neither has access to the caller\'s variable!',
    desc: 'Java NEVER passes objects by reference. It copies the bits inside the caller\'s variable. For primitives, it copies the number. For objects, it copies the reference address.',
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
      openDeepdiveModal("Central Bank Vault & The Garbage Collector", `
        <div style="background:#09090b; padding:14px; border-radius:8px; border:1px solid #27272a; margin-bottom:12px;">
          <div style="font-size:11px; font-weight:800; color:var(--accent-emerald); margin-bottom:8px;">HEAP VAULT STORAGE (JVMS §2.5.3)</div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="background:rgba(52,211,153,0.14); border:1px solid var(--accent-emerald); padding:8px 12px; border-radius:4px;">
              <div style="display:flex; justify-content:space-between;">
                <span style="font-weight:700; color:#ffffff;">Vault 0x4A2F: BankAccount ("Alice", balance: $1000)</span>
                <span style="color:var(--accent-emerald); font-weight:800; font-size:10px;">2 Active Debit Cards</span>
              </div>
              <div style="font-size:10.5px; color:#94a3b8; margin-top:4px;">Safe! Pointed to by main.account and jointCard.</div>
            </div>
            <div style="background:rgba(244,63,94,0.12); border:1px solid var(--accent-rose); padding:8px 12px; border-radius:4px;">
              <div style="display:flex; justify-content:space-between;">
                <span style="font-weight:700; color:#ffffff;">Vault 0x7B9C: BankAccount ("Bob", balance: $2000)</span>
                <span style="color:var(--accent-rose); font-weight:800; font-size:10px;">0 Active Debit Cards</span>
              </div>
              <div style="font-size:10.5px; color:#fca5a5; margin-top:4px;">Orphaned! The Garbage Collector will safely recycle this memory block.</div>
            </div>
          </div>
        </div>
        <p><strong>The Garbage Collector Robot:</strong><br>
        If every debit card pointing to a bank vault in the heap is shredded or set to null, the vault becomes an unreachable orphan. The Garbage Collector sweeps the heap and recycles that space automatically!</p>
      `);
      break;

    case 'puzzle-answer':
      revealPuzzleAnswer();
      break;

    case 'test-aliasing':
      userWithdraw(100, 2);
      flashLaserBeam();
      break;

    case 'flash-remote-1':
      flashLaserBeam();
      window.AudioEngine.playBeep(520, 0.08);
      break;

    case 'trace-beam':
      flashLaserBeam();
      const addrEl = document.getElementById('vault-hex-addr');
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
      <div style="background:rgba(52,211,153,0.12); border:1px solid var(--accent-emerald); border-radius:6px; padding:10px 12px; margin-top:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="color:var(--accent-emerald); font-weight:800; font-family:var(--font-mono); font-size:11px;">✨ 20+ YEAR MASTER EDUCATOR MODEL // 3 JVM WORLDS</span>
          <button onclick="openConceptPathway('bankaccount-vs-account')" style="background:transparent; border:1px solid var(--accent-emerald); color:var(--accent-emerald); padding:2px 8px; border-radius:4px; font-size:10px; cursor:pointer; font-weight:700;">Deep Dive Guide ↗</button>
        </div>
        <div class="three-worlds-triad" id="three-worlds-triad">
          <!-- World 1: BankAccount (Metaspace Class Blueprint) -->
          <div class="world-card card-metaspace" onclick="openConceptPathway('bankaccount-vs-account')" title="Click for Master Teacher Guide">
            <div class="world-realm-badge" style="background:rgba(56,189,248,0.15); color:var(--accent-blue);">WORLD 1: METASPACE (JVMS §2.5.4)</div>
            <div class="world-token-title" style="color:var(--accent-blue);">BankAccount (Class)</div>
            <div class="world-analogy-text"><strong>The Blueprint:</strong> Class metadata, method bytecode, layout in native RAM. You cannot withdraw from a blueprint!</div>
            <div class="world-hardware-footer">
              <span>Metaspace</span>
              <span>BankAccount.class</span>
            </div>
          </div>

          <!-- World 2: account (Stack Debit Card) -->
          <div class="world-card card-stack" onclick="openConceptPathway('bankaccount-vs-account')" title="Click for Master Teacher Guide">
            <div class="world-realm-badge" style="background:rgba(129,140,248,0.15); color:#818cf8;">WORLD 2: STACK FRAME (JVMS §2.6.1)</div>
            <div class="world-token-title" style="color:#818cf8;">account (Variable)</div>
            <div class="world-analogy-text"><strong>The Debit Card:</strong> Local variable slot holding address <code>0x4A2F</code>. Cleared in 0.001ms on return!</div>
            <div class="world-hardware-footer">
              <span>Stack Frame</span>
              <span>32/64-bit Address</span>
            </div>
          </div>

          <!-- World 3: new BankAccount() (Heap Central Vault) -->
          <div class="world-card card-heap" onclick="openConceptPathway('bankaccount-vs-account')" title="Click for Master Teacher Guide">
            <div class="world-realm-badge" style="background:rgba(52,211,153,0.15); color:var(--accent-emerald);">WORLD 3: HEAP STORAGE (JVMS §2.5.3)</div>
            <div class="world-token-title" style="color:var(--accent-emerald);">new BankAccount("Alice", 1000)</div>
            <div class="world-analogy-text"><strong>The Central Vault:</strong> Physical 16B RAM block (8B Mark Word + 4B Klass Word + 4B balance). Managed by GC.</div>
            <div class="world-hardware-footer">
              <span>Heap Storage</span>
              <span>16B Allocated</span>
            </div>
          </div>
        </div>
      </div>
    `;
    MotionFX.revealTriad('three-worlds-triad');
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
  const text = `VOIDRD // SPATIAL SYSTEMS CINEMA: JAVA MEMORY ARCHITECTURE & PASS-BY-VALUE
================================================================================
1. THE TWO ROOMS OF MEMORY (JVMS §2.5, §2.6):
- Stack: Personal study desk for local variables & method call frames (int deposit = 500). Ultra-fast (0.001ms RSP adjust), automatic LIFO cleanup. If full: StackOverflowError.
- Heap: Big shared warehouse for all object instances created with 'new' (new BankAccount("Alice", 1000)). Managed by Garbage Collector. If full: OutOfMemoryError.

2. THE DEBIT CARD MODEL (JLS §4.3 & CAY HORSTMANN):
- Object variables are Debit Cards holding a reference address (0x4A2F), NOT the physical bank vault!
- 'BankAccount jointCard = account;' issues a duplicate debit card pointing to the SAME vault (Aliasing)!
- Withdrawing via jointCard mutates the shared vault balance for both cardholders.
- 'jointCard = null;' shreds Bob's card; the central vault remains alive and safe via Alice's card.

3. JAVA IS STRICTLY PASS-BY-VALUE (JLS §8.4.1):
- Java NEVER passes by reference. It strictly copies bits!
- For primitives: copies the raw 32/64-bit value bits.
- For objects: copies the 4-byte reference pointer address (0x4A2F).
- Reassigning 'b = new BankAccount(...)' inside a method only buys a new card for the local parameter; the caller's variable remains 100% untouched!
`;
  navigator.clipboard.writeText(text);
  alert("📋 Full VoidRD Masterclass Revision & Architecture Notes copied to clipboard!");
}

// ==========================================================================
// INTERACTIVE SIMULATION & MANIPULATIVES (Top YouTube Educational Engine)
// ==========================================================================
function simulatePushFrame() {
  const rack = document.getElementById('live-stack-rack');
  const rsp = document.getElementById('rsp-pointer-badge');
  if (!rack) return;
  const existingHelper = document.getElementById('helper-frame-slot');
  if (existingHelper) {
    simulatePopFrame();
    return;
  }
  const helperSlot = document.createElement('div');
  helperSlot.id = 'helper-frame-slot';
  helperSlot.className = 'stack-slot-cell';
  helperSlot.style.borderLeftColor = 'var(--accent-amber)';
  helperSlot.innerHTML = `
    <span>Slot 3: <strong style="color:var(--accent-amber);">processTransaction() frame</strong></span>
    <span style="color:var(--accent-amber); font-weight:800;">int localDeposit = 600</span>
  `;
  rack.appendChild(helperSlot);
  if (rsp) rsp.textContent = 'RSP -> modify() Frame (LIFO Top)';

  if (window.anime) {
    window.anime({
      targets: helperSlot,
      translateY: [-12, 0],
      opacity: [0, 1],
      easing: 'spring(1, 80, 12, 0)',
      duration: 500
    });
  }
  window.AudioEngine.playWhoosh();
}
window.simulatePushFrame = simulatePushFrame;

function simulatePopFrame() {
  const helper = document.getElementById('helper-frame-slot');
  const rsp = document.getElementById('rsp-pointer-badge');
  if (!helper) return;
  if (window.anime) {
    window.anime({
      targets: helper,
      translateY: [0, -12],
      opacity: [1, 0],
      duration: 300,
      easing: 'easeInQuad',
      complete: () => {
        helper.remove();
        if (rsp) rsp.textContent = 'RSP -> main() Stack Frame';
      }
    });
  } else {
    helper.remove();
    if (rsp) rsp.textContent = 'RSP -> main() Stack Frame';
  }
  window.AudioEngine.playBeep(420, 0.08);
}
window.simulatePopFrame = simulatePopFrame;

// 7. INTERACTIVE STEP 1 & 2 BANKING MANIPULATIVES (Living Vault & Debit Cards)
let activeVaultBalance = 500;
let card1Balance = 500;
let card2Balance = 500;
let card2Nullified = false;

function userWithdraw(amount, cardNum = 1) {
  if (cardNum === 2 && card2Nullified) {
    window.AudioEngine.playBeep(240, 0.15);
    return;
  }
  if (activeVaultBalance < amount) {
    window.AudioEngine.playBeep(220, 0.2);
    return;
  }
  const oldBal = activeVaultBalance;
  activeVaultBalance -= amount;
  card1Balance = activeVaultBalance;
  card2Balance = activeVaultBalance;

  updateVaultDisplay(oldBal, activeVaultBalance);
  updateCardsDisplay();
  spinVaultDial();

  const fromEl = document.getElementById(cardNum === 2 ? 'card-box-2' : 'card-box-1');
  const toEl = document.getElementById('bank-vault-box') || document.getElementById('card-warehouse');
  if (fromEl && toEl) {
    MotionFX.shootDataPacket(fromEl.getBoundingClientRect(), toEl.getBoundingClientRect(), `-$${amount}`, '#38bdf8');
  }
  flashLaserBeam();
  window.AudioEngine.playBeep(640, 0.08);
}
window.userWithdraw = userWithdraw;

function userDeposit(amount, cardNum = 1) {
  if (cardNum === 2 && card2Nullified) {
    window.AudioEngine.playBeep(240, 0.15);
    return;
  }
  const oldBal = activeVaultBalance;
  activeVaultBalance += amount;
  card1Balance = activeVaultBalance;
  card2Balance = activeVaultBalance;

  updateVaultDisplay(oldBal, activeVaultBalance);
  updateCardsDisplay();
  spinVaultDial();

  const fromEl = document.getElementById(cardNum === 2 ? 'card-box-2' : 'card-box-1');
  const toEl = document.getElementById('bank-vault-box') || document.getElementById('card-warehouse');
  if (fromEl && toEl) {
    MotionFX.shootDataPacket(fromEl.getBoundingClientRect(), toEl.getBoundingClientRect(), `+$${amount}`, '#34d399');
  }
  flashLaserBeam();
  window.AudioEngine.playBeep(720, 0.08);
}
window.userDeposit = userDeposit;

function userNullifyCard(cardNum = 2) {
  const cardBox = document.getElementById('card-box-' + cardNum);
  const addrEl = document.getElementById('card-addr-' + cardNum);
  const countEl = document.getElementById('vault-remotes-count');

  card2Nullified = true;
  if (cardBox) {
    cardBox.classList.add('card-nullified');
  }
  if (addrEl) {
    addrEl.textContent = '0x0000 (null)';
  }
  if (countEl) {
    countEl.textContent = '1 ACTIVE DEBIT CARD (Alice)';
  }

  clearLaserBeams();
  drawSingleLaser('card-box-1', 'bank-vault-box');
  window.AudioEngine.playBeep(320, 0.12);
}
window.userNullifyCard = userNullifyCard;

function userAuditGc() {
  const shelf = document.getElementById('heap-shelf-4a2f');
  const dial = document.getElementById('step1-vault-dial');
  if (shelf) MotionFX.pulseElement(shelf);
  if (dial && window.anime) {
    window.anime({
      targets: dial,
      rotate: '+=360',
      duration: 600,
      easing: 'spring(1, 80, 10, 0)'
    });
  }
  const disp = document.getElementById('heap-vault-balance-display');
  if (disp) {
    const orig = disp.textContent;
    disp.innerHTML = '<span style="color:#34d399; font-size:11px;">[GC ROOTS: 100% REACHABLE]</span>';
    setTimeout(() => {
      if (disp) disp.textContent = orig;
    }, 2200);
  }
  window.AudioEngine.playBeep(520, 0.12);
}
window.userAuditGc = userAuditGc;

function spinVaultDial() {
  const dials = document.querySelectorAll('.vault-lock-dial');
  if (window.anime && dials.length > 0) {
    window.anime({
      targets: dials,
      rotate: '+=360',
      duration: 650,
      easing: 'spring(1, 80, 10, 0)'
    });
  }
}

function updateVaultDisplay(oldBal, newBal) {
  const valEl = document.getElementById('vault-balance-val');
  const shelfBal = document.getElementById('shelf-vault-bal');
  const step1Bal = document.getElementById('heap-vault-balance-display');

  if (valEl) {
    if (window.anime) {
      const obj = { val: oldBal };
      window.anime({
        targets: obj,
        val: newBal,
        round: 1,
        easing: 'easeOutQuad',
        duration: 400,
        update: () => {
          valEl.textContent = `$${obj.val}`;
        }
      });
    } else {
      valEl.textContent = `$${newBal}`;
    }
  }
  if (shelfBal) shelfBal.textContent = `$${newBal}`;
  if (step1Bal) step1Bal.textContent = `$${newBal}`;
}

function updateCardsDisplay() {
  const p1 = document.getElementById('card-bal-preview-1');
  const p2 = document.getElementById('card-bal-preview-2');
  if (p1) p1.textContent = `$${card1Balance}`;
  if (p2) p2.textContent = `$${card2Balance}`;
}

function drawRemoteLaserBeams() {
  const svg = document.getElementById('laser-wire-svg');
  if (!svg) return;
  svg.innerHTML = '';
  drawSingleLaser('card-box-1', 'bank-vault-box');
  const card2 = document.getElementById('card-box-2');
  if (card2 && !card2Nullified) {
    drawSingleLaser('card-box-2', 'bank-vault-box');
  }
}

function drawSingleLaser(fromId, toId, options = {}) {
  const svg = document.getElementById('laser-wire-svg');
  const fromEl = document.getElementById(fromId);
  const toEl = document.getElementById(toId);
  if (!svg || !fromEl || !toEl) return null;
  return MotionFX.drawCurvedLaser(svg, fromEl, toEl, options);
}

function flashLaserBeam() {
  const svg = document.getElementById('laser-wire-svg');
  if (!svg) return;
  svg.querySelectorAll('path.laser-pulse-line').forEach(p => {
    p.setAttribute('stroke', '#34d399');
    p.setAttribute('stroke-width', '3.5');
    setTimeout(() => {
      p.setAttribute('stroke', '#38bdf8');
      p.setAttribute('stroke-width', '2');
    }, 320);
  });
  const vault = document.getElementById('bank-vault-box');
  if (vault) MotionFX.pulseElement(vault);
}

function clearLaserBeams() {
  const svg = document.getElementById('laser-wire-svg');
  if (svg) svg.innerHTML = '';
}

// 8. RENDER STEP 3 SUB-STEPS
const IDE_TOKEN_BREAKDOWNS = [
  {
    token: "int deposit = 500;",
    desc_en: "🔍 <strong>Token Breakdown:</strong> <code>int</code> (32-bit primitive type) &bull; <code>deposit</code> (local variable identifier) &bull; <code>= 500</code> (raw 32-bit integer bits stored directly in main's Stack Slot 1). JVMS Bytecode: <code>sipush 500</code> &rarr; <code>istore_1</code>.",
    desc_telugish: "🔍 <strong>Token Breakdown:</strong> <code>int</code> (32-bit primitive) &bull; <code>deposit</code> (local variable) &bull; <code>= 500</code> (raw bits direct ga main stack slot 1 lo store ayyayi). Bytecode: <code>sipush 500</code> &rarr; <code>istore_1</code>."
  },
  {
    token: "BankAccount account = new BankAccount(\"Alice\", 1000);",
    desc_en: "🔍 <strong>Token Breakdown:</strong> <code>new BankAccount(...)</code> allocates 16-byte vault on Heap at <code>0x4A2F</code> &bull; <code>account</code> (Stack slot 2) receives only the 4-byte reference pointer (The Debit Card!). JVMS Bytecode: <code>new #2</code> &rarr; <code>dup</code> &rarr; <code>invokespecial #3</code> &rarr; <code>astore_2</code>.",
    desc_telugish: "🔍 <strong>Token Breakdown:</strong> <code>new BankAccount(...)</code> Heap warehouse lo <code>0x4A2F</code> daggara 16-byte vault build chesindi &bull; <code>account</code> variable ki kevalam debit card address vachindi. Bytecode: <code>new</code> &rarr; <code>dup</code> &rarr; <code>invokespecial</code> &rarr; <code>astore</code>."
  },
  {
    token: "processTransaction(account, deposit);",
    desc_en: "🔍 <strong>Token Breakdown:</strong> Pushes new Frame for <code>processTransaction()</code> &bull; Parameter <code>b</code> gets duplicate debit card (<code>0x4A2F</code>) &bull; Parameter <code>localDeposit</code> gets independent copy of number <code>500</code> (Pass-by-Value). JVMS Bytecode: <code>aload_2</code> &rarr; <code>iload_1</code> &rarr; <code>invokestatic #4</code>.",
    desc_telugish: "🔍 <strong>Token Breakdown:</strong> <code>processTransaction()</code> kosam kotha stack frame push ayyindi &bull; <code>b</code> ki duplicate debit card (<code>0x4A2F</code>) &bull; <code>localDeposit</code> ki 500 independent copy vachindi. Bytecode: <code>aload_2</code> &rarr; <code>iload_1</code> &rarr; <code>invokestatic</code>."
  },
  {
    token: "localDeposit = localDeposit + 100;",
    desc_en: "🔍 <strong>Token Breakdown:</strong> <code>localDeposit + 100</code> evaluates to 600 on operand stack &bull; Overwrites ONLY processTransaction's local Slot 1. main's deposit ($500) is in an isolated frame and completely untouched! JVMS Bytecode: <code>iload_1</code> &rarr; <code>bipush 100</code> &rarr; <code>iadd</code> &rarr; <code>istore_1</code>.",
    desc_telugish: "🔍 <strong>Token Breakdown:</strong> <code>localDeposit + 100</code> processTransaction frame meeda 600 ga marindi &bull; main frame lo unna deposit ($500) alane safe ga undi! Bytecode: <code>iload_1</code> &rarr; <code>bipush 100</code> &rarr; <code>iadd</code> &rarr; <code>istore_1</code>."
  },
  {
    token: "b.withdraw(200);",
    desc_en: "🔍 <strong>Token Breakdown:</strong> Dereferences debit card handle <code>0x4A2F</code> to reach single shared vault on Heap &bull; Mutates field 'balance' from $1000 to $800. Both cards observe $800! JVMS Bytecode: <code>aload_0</code> &rarr; <code>sipush 200</code> &rarr; <code>invokevirtual #5</code>.",
    desc_telugish: "🔍 <strong>Token Breakdown:</strong> Debit card <code>0x4A2F</code> dwara Heap vault lo unna balance $1000 nundi $800 ki marindi &bull; Rendu cards ki ippudu $800 kanipisthundi! Bytecode: <code>aload_0</code> &rarr; <code>invokevirtual</code>."
  },
  {
    token: "b = new BankAccount(\"Bob\", 2000);",
    desc_en: "🔍 <strong>Token Breakdown:</strong> <code>new BankAccount(...)</code> builds a second vault at heap address <code>0x7B9C</code> &bull; Reassigns ONLY processTransaction's local parameter <code>b</code>. main's <code>account</code> STILL points to Alice's vault ($800 at <code>0x4A2F</code>)! JVMS Bytecode: <code>new #2</code> &rarr; <code>dup</code> &rarr; <code>invokespecial</code> &rarr; <code>astore_0</code>.",
    desc_telugish: "🔍 <strong>Token Breakdown:</strong> <code>0x7B9C</code> daggara kotha vault kattindi &bull; processTransaction local card ni daaniki marchindi. main card inka Alice vault (<code>0x4A2F</code>) ke point chesthundi! Bytecode: <code>new</code> &rarr; <code>astore_0</code>."
  },
  {
    token: "return (Method Cleanup)",
    desc_en: "🔍 <strong>Token Breakdown:</strong> processTransaction returns &bull; Stack frame popped by RSP register &bull; Vault at 0x7B9C has 0 debit cards (0 GC roots) and is swept by the Garbage Collector!",
    desc_telugish: "🔍 <strong>Token Breakdown:</strong> processTransaction frame destroy ayyindi &bull; 0x7B9C vault ki cards levu kabatti Garbage Collector clean chesindi!"
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

// 13. THREE.JS 3D AMBIENT BACKGROUND ENGINE (YouTube / Manim High-End Studio)
let threeScene, threeCamera, threeRenderer, threeParticles, threeGrid;

function initThreeAmbientScene() {
  const canvas = document.getElementById('three-ambient-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  try {
    const parent = canvas.parentElement;
    const width = parent ? parent.clientWidth : window.innerWidth;
    const height = parent ? parent.clientHeight : window.innerHeight;

    threeScene = new THREE.Scene();
    threeCamera = new THREE.PerspectiveCamera(50, (width || 1280) / (height || 720), 0.1, 1000);
    threeCamera.position.set(0, 4, 18);
    threeCamera.lookAt(0, 0, 0);

    threeRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    threeRenderer.setSize(width || 1280, height || 720);
    threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // Subtle isometric grid
    threeGrid = new THREE.GridHelper(36, 18, 0x38bdf8, 0x1e293b);
    threeGrid.position.y = -5;
    threeGrid.material.opacity = 0.22;
    threeGrid.material.transparent = true;
    threeScene.add(threeGrid);

    // Floating ambient memory data particles
    const particleCount = 60;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 30;
      positions[i + 1] = (Math.random() - 0.5) * 16;
      positions[i + 2] = (Math.random() - 0.5) * 16;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.16,
      transparent: true,
      opacity: 0.45
    });
    threeParticles = new THREE.Points(geometry, material);
    threeScene.add(threeParticles);

    let mouseX = 0, mouseY = 0;
    window.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    function animateThree() {
      requestAnimationFrame(animateThree);
      if (threeParticles) {
        threeParticles.rotation.y += 0.0006;
        const pos = threeParticles.geometry.attributes.position.array;
        for (let i = 1; i < particleCount * 3; i += 3) {
          pos[i] += 0.012;
          if (pos[i] > 10) pos[i] = -8;
        }
        threeParticles.geometry.attributes.position.needsUpdate = true;
      }
      if (threeCamera) {
        threeCamera.position.x += (mouseX * 1.5 - threeCamera.position.x) * 0.02;
        threeCamera.position.y += (-mouseY * 1.2 + 4 - threeCamera.position.y) * 0.02;
        threeCamera.lookAt(0, 0, 0);
      }
      threeRenderer.render(threeScene, threeCamera);
    }
    animateThree();

    window.addEventListener('resize', () => {
      if (!canvas || !canvas.parentElement || !threeRenderer || !threeCamera) return;
      const w = canvas.parentElement.clientWidth;
      const h = canvas.parentElement.clientHeight;
      if (w > 0 && h > 0) {
        threeCamera.aspect = w / h;
        threeCamera.updateProjectionMatrix();
        threeRenderer.setSize(w, h);
      }
    });
  } catch (err) {
    console.warn('[ThreeAmbient] WebGL initialization skipped:', err);
  }
}
window.initThreeAmbientScene = initThreeAmbientScene;

// ==========================================================================
// VOIDRD DYNAMIC RESEARCHED DOMAIN ENGINE
// ==========================================================================
let currentResearchedDomains = [];
let activeDomainId = 'banking';

async function initDomainPicker() {
  try {
    const res = await fetch('/api/lesson/domains');
    const json = await res.json();
    if (json.success && json.data) {
      currentResearchedDomains = json.data;
      renderDomainOptions();
    }
  } catch (err) {
    console.warn('[VoidRD] Failed to load researched domains:', err);
  }
}
window.initDomainPicker = initDomainPicker;

function renderDomainOptions() {
  const container = document.getElementById('domain-options-list');
  if (!container) return;
  container.innerHTML = currentResearchedDomains.map(d => `
    <div class="domain-option-item ${d.id === activeDomainId ? 'active-domain' : ''}" onclick="selectDomain('${d.id}')">
      <div class="domain-option-icon">${d.icon}</div>
      <div class="domain-option-content">
        <div class="domain-option-title-row">
          <span class="domain-option-title">${d.name}</span>
          <span class="domain-option-badge">${d.badge}</span>
        </div>
        <div class="domain-option-tagline">${d.tagline}</div>
      </div>
    </div>
  `).join('');
}
window.renderDomainOptions = renderDomainOptions;

function toggleDomainPicker() {
  const panel = document.getElementById('domain-dropdown-panel');
  if (!panel) return;
  const isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? 'flex' : 'none';
}
window.toggleDomainPicker = toggleDomainPicker;

async function selectDomain(domainId) {
  activeDomainId = domainId;
  const panel = document.getElementById('domain-dropdown-panel');
  if (panel) panel.style.display = 'none';

  const domain = currentResearchedDomains.find(d => d.id === domainId);
  if (domain) {
    const iconEl = document.getElementById('active-domain-icon');
    const nameEl = document.getElementById('active-domain-name');
    if (iconEl) iconEl.textContent = domain.icon;
    if (nameEl) nameEl.textContent = domain.name;
  }
  renderDomainOptions();

  showApiOverlay(`⚡ VoidRD Dynamic Synthesis: Synthesizing '${domain?.name || domainId}' mental model...`);
  try {
    const res = await fetch('/api/lesson/generate-example', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: domainId, topic: 'java-memory' })
    });
    const json = await res.json();
    hideApiOverlay();
    if (json.success && json.data) {
      applyDynamicDomainData(json.data);
    }
  } catch (err) {
    hideApiOverlay();
    console.error('[VoidRD] Domain generation error:', err);
  }
}
window.selectDomain = selectDomain;

function applyDynamicDomainData(data) {
  const card1Owner = document.querySelector('#card-box-1 .debit-owner-name');
  const card2Owner = document.querySelector('#card-box-2 .debit-owner-name');
  const card1Num = document.querySelector('#card-box-1 .debit-card-num');
  const card2Num = document.querySelector('#card-box-2 .debit-card-num');
  const vaultTitle = document.querySelector('#bank-vault-box .vault-door-title');
  const vaultBal = document.getElementById('vault-balance-num');
  const codeLine = document.getElementById('golden-rule-code');
  const addrBadges = document.querySelectorAll('.card-address-badge');

  if (card1Owner && data.card1) card1Owner.textContent = data.card1.owner;
  if (card2Owner && data.card2) card2Owner.textContent = data.card2.owner;
  if (card1Num) card1Num.textContent = data.address;
  if (card2Num) card2Num.textContent = data.address;
  if (vaultTitle && data.vault) vaultTitle.textContent = data.vault.title_en;
  if (vaultBal && data.vault) vaultBal.textContent = data.vault.stat;
  if (codeLine) codeLine.textContent = data.codeSnippet;
  addrBadges.forEach(el => el.textContent = data.address);

  // Trigger laser bus flash to illustrate address alignment
  if (typeof flashLaserBeam === 'function') setTimeout(flashLaserBeam, 150);
  window.AudioEngine.playWhoosh();
}
window.applyDynamicDomainData = applyDynamicDomainData;

// Auto-boot on DOM ready
document.addEventListener('DOMContentLoaded', bootPlayerApp);
