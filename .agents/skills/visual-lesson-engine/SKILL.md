---
name: visual-lesson-engine
description: >-
  Universal Interactive Visual Lesson Player and Dynamic API Generation Engine designed for
  university lecture halls, smartboards, and self-paced mastery across ANY computer science or
  engineering topic. Features a client-server architecture with a fixed-viewport (non-scrollable)
  16:9 blackboard studio player, dynamic on-demand API step generation (backend), clean matte blackboard
  aesthetic, event-driven speech-visual lockstep, Dual-View (Metaphor vs Physical Reality), everywhere-hover
  HUD tooltips, interactive physical manipulatives, and dual-language support.
---

# Visual Lesson Engine: Universal Educational Platform & Authoring Standard

The **Visual Lesson Engine** is a **topic-agnostic, full-stack educational engine and pedagogical standard** designed to teach **any complex computer science, engineering, or software architecture concept**.

It embodies the synthesized mindset of a **50-Year Master Teacher & Chief Solution Architect**:
* The physical visual intuition of **3Blue1Brown** (spatial geometry, state transitions).
* The physical props and stagecraft of **David Malan / CS50** (everyday manipulatives: remotes, shelves, trays, envelopes).
* The fast, high-density, crystal-clear pacing of **Fireship** (zero fluff, immediate mental models).
* The cultural clarity and accessibility of **bilingual instruction** (Simple English + Romanized Telugish).

> **Important:** While our flagship reference implementation demonstrates *Java Memory Architecture (Stack vs. Heap)*, this engine is designed to author and deliver **ANY** technical curriculum: Concurrency & Deadlocks, SQL Indexing & B-Trees, Git Internal Object Graphs, Networking & TCP Handshakes, CPU Caching & Pipelining, Garbage Collection, Docker Containers, or OS Virtual Memory.

---

## 1. System Architecture: Topic-Agnostic Client + REST API Engine

```
+-----------------------------------------------------------------------------------------+
|                        UNIVERSAL VISUAL LESSON ENGINE TOPOLOGY                          |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|  [ CLIENT: Fixed Theater Video Player ] <---------- HTTP / JSON API ---------->         |
|   - Fixed Viewport (100vw x 100vh, ZERO page scrolling)                                 |
|   - 16:9 Studio Blackboard Theater Canvas                                               |
|   - Dual-View Mode: [💡 Metaphor View] <-> [⚡ Physical System Reality View]             |
|   - Real-Time Event-Driven Sync: onboundary events drive visual reveals in lockstep     |
|   - Standardized Everywhere-Hover HUD Tooltip System anchored to prominent (i) badges   |
|   - Live letter-by-letter kinetic typewriter streaming                                 |
|   - Interactive physical manipulatives tailored to the active topic                     |
|   - Draggable PIP subtitles & Natural Voice Speech Engine                               |
|   - 2-Tier Master Study Notes Drawer (60-Sec Revision Cheatsheet + Detailed Guide)      |
|                                                                                         |
|  [ BACKEND: Dynamic Lesson & Step API Server ]                                          |
|   - GET  /api/lesson/manifest?topic=<id>     -> Returns topic metadata, acts & duration |
|   - GET  /api/lesson/step/:id?topic=<id>     -> Returns static foundation steps         |
|   - POST /api/lesson/generate-step           -> Synthesizes dynamic deep dives on demand|
|                                                                                         |
+-----------------------------------------------------------------------------------------+
```

### 1.1 Non-Scrollable Fixed Theater Player Contract
Traditional scrollable web pages fail in lecture halls and smartboards because students lose context as content scrolls off-screen. The engine enforces a **strict video-player contract**:
* `html, body { width: 100vw; height: 100vh; overflow: hidden; margin: 0; }`
* The entire interactive experience lives inside a centered, responsive 16:9 studio blackboard canvas.
* **No page scrollbars.** All animations, state transitions, interactive levers, and code traces occur inside the fixed blackboard stage.
* All transport controls remain pinned in the bottom player console: scrubber bar, step track pills, play/pause, step forward/backward, speed controls, and mode toggles.

### 1.2 Dynamic Step-by-Step API Generation Lifecycle
To maximize cognitive retention and optimize server token consumption, lessons follow a **progressive on-demand lifecycle**:
1. **Act 1 (First Principles / Curiosity Hook):** Pre-loaded on player boot.
2. **Act 2 (The Core Mental Model & Interactive Manipulatives):** Pre-loaded and interactive.
3. **Act 3+ (Live System Trace / Deep Dive / Diagnostics):** When the learner reaches Act 3, the player dispatches:
   `POST /api/lesson/generate-step` with `{ topic: "<topic-id>", stepNumber: 3, language: "en" }`.
   The backend synthesizes the rich bytecode trace, memory frames, tree nodes, or packet hops on demand.

---

## 2. The 5 Universal Pedagogical Laws

### Law 1: The Everyday Physical Metaphor Law
Never introduce low-level hardware or mathematical mechanics without first anchoring in an everyday physical object:
* **Memory Architecture:** The Personal Desk (Stack) vs. The Shared Warehouse (Heap).
* **Object References:** The TV Remote Control (variable) vs. The 65-inch Smart TV (object).
* **Concurrency & Locks:** Single Bathroom Key on a gas station wall (Mutex).
* **Database Indexing:** Library Card Catalog vs. Walking through every shelf (Full Table Scan).
* **Git Commit Graphs:** A Photo Album with labeled sticky notes (Branches/Pointers).
* **TCP Handshake:** A walkie-talkie protocol ("Do you copy?", "Copy that, can you hear me?", "Loud and clear!").

### Law 2: The Dual-View Mental Bridge (Metaphor <-> Physical Reality)
Metaphors alone can feel overly abstract or imprecise, while raw code alone can feel overwhelming. **Every lesson MUST support both views:**
1. **[💡 Everyday Metaphor View]:** Visualizes physical desks, TV remotes, keys, or warehouses.
2. **[⚡ Physical Reality View]:** Displays the exact computer architecture reality: real CPU registers (RSP), memory addresses (`0x4A2F`), 64-bit object headers, thread IDs, or network packets.
*Students and teachers can toggle between views instantly with one click, bridging intuition and hard engineering.*

### Law 3: Event-Driven Word & Screen Synchronization (Lockstep)
Screen animations must **NEVER** depend on fragile, static `setTimeout` timers. Different browser voices and speech rates drift:
* Narration text and on-screen cards must match sentence-for-sentence.
* Screen card reveals, focus spotlights (`.sync-focused`), text highlights (`.sync-text-highlight`), and sound effects are triggered directly by speech engine `onboundary` character index events (`event.charIndex`).
* **Pausing the player freezes the exact sentence on screen and in subtitles**, enabling teachers to pause at any second and lecture directly from the blackboard.

### Law 4: Standardized Everywhere-Hover HUD Tooltip System
* Never pop up tooltips on broad cards, whitespace, or hidden elements.
* Prominent, accessible `(i)` badges (`.info-bubble-btn`) are placed beside key concepts.
* Hovering or clicking an `(i)` badge anchors a floating HUD Card with:
  1. **Topic Badge & Standard** (e.g. `JVMS §2.6`, `RFC 793`).
  2. **Everyday Physical Analogy**.
  3. **Simple English Explanation** (1–2 sentences, jargon-free).
  4. **Interactive "Launch Explainer" Action** (runs live simulations or opens deep dive modals).

### Law 5: Two-Tier Sellable Study Notes
Every lesson includes a slide-out study drawer with two distinct modes:
1. **⚡ 60-Second Revision Cheatsheet:** Comparison tables, 3 golden laws, 1-line exam definitions.
2. **📖 Detailed Architecture Guide:** Deep specification dives, anatomical breakdowns of frames/objects, and classic technical interview trick questions with step-by-step solutions.

### Law 6: The Law of Dynamic Pedagogical Trajectory (Zero Fixed Step / Act Limits)
The Visual Lesson Engine must **NEVER hardcode or constrain lessons to a rigid number of steps or acts** (such as "always 3 steps" or "always 4 acts"). The pedagogical trajectory and step count ($N \ge 1$) must be **decided dynamically** based on cognitive load, concept complexity, and curriculum depth:
1. **Cognitive Load & Subject Granularity:**
   - **Micro-Concepts ($N = 2$ Steps):** Focused intuitive model + interactive verification (e.g., Big-O Asymptotics, IPv4 Subnetting, Two's Complement).
   - **Standard Architectural Concepts ($N = 3–4$ Steps):** Everyday Hook &rarr; Interactive Manipulative &rarr; Dynamic Execution Trace &rarr; Crash Diagnostics (e.g., Java Memory Architecture, SQL B-Tree Indexing, Git Internal DAGs).
   - **Complex Distributed Systems & Protocols ($N = 5–7+$ Steps):** Multi-phase transitions requiring progressive state evolution (e.g., Raft Consensus: Hook &rarr; Leader Heartbeat &rarr; Log Replication &rarr; Split-Brain Election &rarr; Quorum Recovery &rarr; Uncommitted Rollbacks).
2. **Dynamic Client Navigation Contract:**
   - The player transport console must never rely on hardcoded HTML buttons. It dynamically generates timeline step pills, fraction milestones, scrubber percentages, timecodes (`01:00 / 0N:00`), and keyboard listeners (`1` to `N`) directly from `manifest.totalSteps` and `manifest.stepsSummary`.
3. **On-Demand REST API Synthesis:**
   - While foundation acts pre-load on player boot, deep-dive steps are synthesized on demand via `POST /api/lesson/generate-step` with `{ topic, stepNumber, language }`, enabling infinite curricular scale without monolithic asset bundles.

### Law 7: The Law of Interactive Underscored Terms & 4-Tab Pathway Explorers
Never present static text without interactive discovery hooks. All core pedagogical keywords (variables, reference handles, allocation keywords, memory regions) must feature **subtle, accessible dashed underlines** (`.concept-term`):
* Clicking any underlined word instantly opens the **4-Tab Concept Knowledge Pathway Modal**:
  1. **💡 Everyday Analogy:** Real-world physical intuition without jargon.
  2. **🏛️ Official Spec (JLS / JVMS / RFC):** Formal standard references, bytecode opcodes, and hardware execution models.
  3. **🚀 Interactive Mini-Lab:** Live runnable widget or simulation test for instant validation.
  4. **🗺️ Interview & Learning Path:** Common interview traps, architectural mitigations, and next curriculum milestones.

### Law 8: Dual Synchronous Word Illumination (Screen & Subtitles)
Speech synchronization must illuminate the stage chalkboard, not just the floating subtitle box:
* On-screen descriptive text and code snippets are tokenized into `.screen-word` elements.
* Live speech `onboundary` events trigger simultaneous kinetic highlighting across both the subtitle box (`.caption-word.word-active`) and the active chalkboard card (`.screen-word.word-active`).
* The learner's visual focus is naturally guided directly onto the on-screen diagrams and code representations.

---

## 3. Reference Case Studies Across Computer Science

The engine easily adapts to any technical subject. Below are reference mappings:

| Topic | Act 1: The Intuitive Hook | Act 2: Interactive Manipulative | Act 3: Live System Trace (API) | Act 4: Common Crashes |
| :--- | :--- | :--- | :--- | :--- |
| **Java Memory Architecture** *(Flagship)* | Where does code live? The Desk & Warehouse. | Dual TV Remotes pointing at Smart TV (Aliasing). | 7-stage JVMS Call Stack & Heap execution trace. | `StackOverflowError` vs `OutOfMemoryError`. |
| **Concurrency & Deadlocks** | The Dining Philosophers at dinner table. | Interactive resource locker with 2 threads & 2 keys. | Thread state timeline: RUNNABLE &rarr; BLOCKED &rarr; DEADLOCK. | Race conditions, Thread Starvation. |
| **Database B-Tree Indexing** | Searching a phonebook vs reading every page. | Interactive B-Tree node split & balance slider. | Page fetch I/O counter: O(log N) vs O(N). | Index fragmentation, unindexed WHERE clauses. |
| **Git Internal Object Graphs** | Snapshots in a photo album with sticky notes. | Branch pointer mover (`main`, `feature`, `HEAD`). | Commit tree DAG: Blobs, Trees, Commit hashes. | Detached HEAD, merge conflicts. |
| **TCP 3-Way Handshake** | Walkie-talkie radio confirmation. | SYN / SYN-ACK / ACK signal packet sender. | Wireshark packet sequence with sequence numbers. | SYN flood attack, connection timeouts. |

---

## 4. UI/UX Style Specification: Clean Matte Blackboard

* **Palette:** Deep matte blackboard black (`#09090b`), dark graphite panels (`#141418`, `#18181b`), subtle zinc borders (`#27272a`).
* **Accents:** Electric sky blue (`#38bdf8`), mint emerald (`#34d399`), warm amber (`#fbbf24`), lavender indigo (`#818cf8`), muted rose (`#f43f5e`).
* **Zero Hacker Clichés:** Strictly NO green terminal fonts, matrix rain, glowing neon text-shadows, or retro scanlines. Clean, modern Linear/Vercel design aesthetic.
* **Humane Voice & Silence on Pause:**
  * Uses prioritized high-quality natural voices (`Microsoft Natural`, `Google Neural`).
  * **Strict absolute silence when paused** (`silenceAll()` zeroes Web Audio gain and disconnects all oscillators). Background music is strictly OFF by default.

---

## 5. Implementation Verification Protocol

Whenever building or testing any topic on the Visual Lesson Engine:
1. Run `node test/verify_app.js` to ensure zero syntax errors, fixed 100vw x 100vh viewport contract, and zero Telugu script characters across files.
2. Verify that `GET /api/lesson/manifest`, `GET /api/lesson/step/:id`, and `POST /api/lesson/generate-step` respond with HTTP 200.
3. Test event-driven speech synchronization: confirm that screen cards and subtitles trigger simultaneously on word boundaries.
4. Verify that hover HUD tooltips trigger ONLY on explicit `(i)` badges, never on empty whitespace.
5. Verify that the Dual-View toggle (`[💡 Metaphor View]` vs `[⚡ Physical RAM View]`) switches content cleanly.
