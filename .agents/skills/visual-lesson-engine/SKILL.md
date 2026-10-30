---
name: visual-lesson-engine
description: >-
  Interactive Visual Lesson Player and Dynamic Generation Engine designed for university lecture halls,
  smartboards, and self-paced mastery. Features a client-server architecture with a fixed-viewport (non-scrollable)
  studio video player, dynamic on-demand API step generation (backend), clean matte black blackboard aesthetic,
  live letter-by-letter streaming, everywhere-hover HUD tooltips, interactive manipulatives, and dual-language support.
---

# Visual Lesson Engine: Full-Stack Architecture & Pedagogical Standards

The **Visual Lesson Engine** is a full-stack educational platform and authoring standard for delivering interactive, animated, video-player-grade computer science masterclasses. It embodies the mind of a **50-Year Master Teacher & Chief Solution Architect**: Combining the physical geometric intuition of **3Blue1Brown**, the theatrical stagecraft and physical manipulatives of **David Malan (CS50)**, the rapid visual cadence of **Fireship**, and the culturally relatable vernacular of **Hyderabad B.Tech engineering students**.

- **Frontend:** A fixed-viewport, **non-scrollable** video player (`100vw x 100vh`, `overflow: hidden`) featuring an interactive 16:9 blackboard theater stage, live letter-by-letter typewriter streaming, interactive manipulatives, and pro-player transport controls.
- **Backend:** A REST API engine serving lesson manifests, foundational steps (Step 1, Step 2), and dynamically generating advanced steps (Step 3+) on demand via `/api/lesson/generate-step` to optimize token consumption and maintain dynamic pedagogical precision.

---

## 1. System Architecture: Client Player + Dynamic API Backend

```
+---------------------------------------------------------------------------------+
|                       VISUAL LESSON ENGINE SYSTEM TOPOLOGY                      |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  [ CLIENT: Fixed Theater Video Player ] <-------- HTTP / JSON API --------->   |
|   - Fixed viewport (100vw x 100vh, zero page scroll)                           |
|   - 16:9 Studio Blackboard Stage Canvas                                         |
|   - Live letter-by-letter screen typewriter                                     |
|   - Interactive manipulatives (TV Remote & Smart TV, JVMS Call Stack & Heap)    |
|   - Draggable PIP captions & audio synthesizer                                  |
|   - Scrubber timeline, step track pills, Continuous vs Step-by-Step mode        |
|                                                                                 |
|  [ BACKEND: Dynamic Lesson & Step API Server ]                                  |
|   - GET  /api/lesson/manifest       -> Lesson metadata, steps list, duration    |
|   - GET  /api/lesson/step/:id       -> Step payload (narration, visuals, state) |
|   - POST /api/lesson/generate-step  -> Dynamically synthesizes Step 3+ on demand|
|                                                                                 |
+---------------------------------------------------------------------------------+
```

### 1.1 Non-Scrollable Player Contract (Fixed-Stage UI)
Traditional scrollable web pages overwhelm learners and fail on classroom smartboards. The lesson interface **must strictly operate as a video/presentation player**:
- `html, body { width: 100vw; height: 100vh; overflow: hidden; margin: 0; }`
- The entire application lives inside a centered, responsive 16:9 theater stage canvas.
- No scrollbars. All transitions, card reveals, code line traces, and explanations occur inside the fixed blackboard player frame.
- Player controls are pinned within the player console: scrubber bar, step tracker pills, play/pause, step forward/backward, and mode toggle.

### 1.2 Dynamic Step-by-Step API Generation Lifecycle
Rather than dumping an entire course into a static monolithic file that consumes excessive tokens and lacks adaptability:
1. **Step 1 (First Principles / Curiosity Hook):** Pre-loaded and ready immediately on player boot.
2. **Step 2 (The Mental Model / Two Rooms & TV Remote):** Pre-loaded and interactive.
3. **Step 3+ (Code Tracing / Deep Dive / Diagnostics):** When the learner or instructor clicks Step 3 or scrubs forward, the player dispatches a real-time API call:
   `POST /api/lesson/generate-step`
   Payload: `{ topic: "java-memory", stepNumber: 3, language: "en" }`
   The backend synthesizes or streams the rich JVMS memory state, code rows, and step explanations dynamically.

---

## 2. Pedagogical Standards: The 50-Year Veteran Teacher Mindset

### 2.1 The Golden Mental Model Law
Every complex computer science system MUST be introduced with an intuitive, tangible, everyday physical mental model before diving into low-level mechanics:
- **Memory Architecture = The Two Rooms:**
  - *The Quick Desk (Stack):* Fast, neat, organized. Ideal for temporary notes you need right now. Every time a method runs, it gets its own tidy work tray. When the method finishes—BAM! The tray is recycled in 0.001 milliseconds!
  - *The Big Warehouse (Heap):* Huge shared storage. Ideal for permanent objects. When you type `new`, an object is constructed and placed safely on a warehouse shelf. It stays alive as long as anyone holds a receipt (reference) for it.
- **Object References = The TV Remote Secret:**
  - A reference variable is **NOT** the object; it is simply a **TV Remote Control** holding a channel address (e.g. `0x4A2F`).
  - The object is the **65-inch Smart TV** mounted in the warehouse.
  - Executing `Dog d2 = dog;` does **NOT** buy a second TV! It manufactures a second identical remote control pointed at the *exact same* TV. Pressing buttons on either remote changes the shared TV screen (**Aliasing**).
  - Executing `d = new Dog("Max", 1);` points that local remote to a brand new TV; it does *not* affect the caller's remote.
- **Parameter Passing = Copying the Remote:**
  - Java is **strictly Pass-by-Value**. Passing an object reference copies the remote control address, never the TV itself!

### 2.2 Strict Ban on Alien Hardware Jargon & Negative Framing
Never intimidate students with robotic or alien phrases:
- ❌ *"Physical Silicon Reality // The 16GB Memory Bus"* -> ✅ *"Where Does Your Code Actually Live? // The Mystery of Computer Memory"*
- ❌ *"Exam Traps"* / *"Students Fail Here"* -> ✅ *"The 30-Second Mystery"* / *"The 4 Big Interview Questions"*
- ❌ *"The Disaster Recovery Lab"* -> ✅ *"When Things Go Wrong: 3 Common Crashes Explained Simply"*

---

## 3. UI/UX Standards: Clean Matte Studio Blackboard

### 3.1 Color Palette & Typography
- **Backgrounds:** Deep matte blackboard black (`#09090b`), dark graphite panels (`#121215`, `#18181b`), subtle zinc borders (`#27272a`).
- **Accents:** Sky blue (`#38bdf8`), soft lavender (`#818cf8`), fresh mint (`#34d399`), warm amber (`#fbbf24`), muted coral (`#f43f5e`).
- **Zero Hacker Clichés:** Strictly NO green terminal fonts, NO glowing neon text-shadows, NO CRT scanlines, and NO matrix rain canvases. Clean, modern, high-end developer masterclass aesthetic (Vercel/Linear style).

### 3.2 Live Kinetic Letter-by-Letter Streaming (Zero Dumping)
- The stage starts clean and empty.
- Text, questions, code step notes, and explanations appear **live letter-by-letter** with a blinking cursor `|` at natural reading cadence (~16–18ms per character).
- On fast scrubbing or seeking, running character timers cancel immediately and populate the full text instantly without lag.

### 3.3 Humane Lecture Pacing & Dual Mode
- **Pacing:** ~18 to 24 seconds per step with deliberate 0.90x speech rate.
- **Speech Synchronization:** Audio listens for speech `utter.onend` instead of an arbitrary early timeout.
- **5-Second Soak Pause:** After narration finishes speaking, the engine grants a 5-second comprehension pause before advancing, allowing students to inspect the diagram and absorb the concept.
- **Dual Mode:**
  - `Continuous Auto-Play`: Automatically advances through steps with 5-second absorption pauses.
  - `Step-by-Step Classroom Mode`: Automatically pauses after each step, displaying a clear prompt:
    `✨ Step Complete • Ready for Next? Press [→] or Space ▶`

---

## 4. Bilingual Engine: Simple English & Romanized Telugish

- **English:** Clear, concise, active voice with zero unnecessarily complex sentences.
- **Telugish:** Hyderabad B.Tech student vernacular written **exclusively in the English alphabet** (zero Telugu script characters `\u0C00-\u0C7F`), making it effortless for bilingual students to read and follow.
- **Instant Toggle:** The language button switches UI, subtitles, and narration instantly with zero page reload or timeline loss.

---

## 5. Development & Deployment Protocol

1. **Backend Server (`server/`):**
   - Implements native REST endpoints (`/api/lesson/manifest`, `/api/lesson/step/:id`, `/api/lesson/generate-step`).
   - Serves static assets from `client/`.
2. **Frontend Player (`client/`):**
   - Zero-scroll fixed layout (`player.css`).
   - Core player loop, timeline scrubber, and step management (`app.js`).
   - API client for on-demand step fetching and generation (`api.js`).
   - Letter-by-letter blackboard streaming engine (`typewriter.js`).
   - Natural speech synthesis and Web Audio synthesizer (`audio.js`).
3. **Verification:**
   - Server launches and responds with HTTP 200 on all endpoints.
   - Frontend loads in browser as a fixed-viewport player with zero scrollbars.
   - Step 1 and Step 2 render and play smoothly.
   - Clicking Step 3 triggers the API call and streams the dynamically generated JVMS memory execution trace.
