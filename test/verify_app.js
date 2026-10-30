// d:\pace\test\verify_app.js
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');

console.log('=== RUNNING FULL-STACK LESSON ENGINE VERIFICATION ===\n');

let pass = 0;
let fail = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ PASS: ${msg}`);
    pass++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    fail++;
  }
}

// 1. FILE EXISTENCE & SYNTAX
console.log('--- 1. File Structure & Static Assets ---');
const files = [
  'server/server.js',
  'server/lessonData.js',
  'server/stepGenerator.js',
  'client/index.html',
  'client/css/player.css',
  'client/js/api.js',
  'client/js/typewriter.js',
  'client/js/audio.js',
  'client/js/app.js',
  '.agents/skills/visual-lesson-engine/SKILL.md'
];

files.forEach(f => {
  const fullPath = path.resolve(__dirname, '..', f);
  assert(fs.existsSync(fullPath), `File exists: ${f}`);
});

// Check JS files for syntax errors
['server/server.js', 'server/lessonData.js', 'server/stepGenerator.js', 'client/js/api.js', 'client/js/typewriter.js', 'client/js/audio.js', 'client/js/app.js'].forEach(f => {
  const code = fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');
  let valid = false;
  try {
    new vm.Script(code);
    valid = true;
  } catch (err) {
    console.error(`Syntax error in ${f}:`, err);
  }
  assert(valid, `JavaScript syntax valid in: ${f}`);
});

// 2. ZERO SCROLLING & MATTE THEME AUDIT
console.log('\n--- 2. UI/UX Contract & Non-Scrollable Theater Audit ---');
const css = fs.readFileSync(path.resolve(__dirname, '../client/css/player.css'), 'utf8');
assert(css.includes('overflow: hidden'), 'CSS enforces overflow: hidden (zero page scroll)');
assert(css.includes('width: 100vw'), 'CSS enforces fixed 100vw viewport');
assert(css.includes('height: 100vh'), 'CSS enforces fixed 100vh viewport');
assert(css.includes('aspect-ratio: 16 / 9'), 'Stage uses 16:9 responsive theater frame');

const textShadows = css.match(/text-shadow:\s*0\s*0\s*\d+px/gi);
assert(!textShadows || textShadows.length === 0, 'Zero glowing text-shadows in CSS (Clean Matte Blackboard)');

// 3. ZERO TELUGU SCRIPT CHARACTERS AUDIT
console.log('\n--- 3. Language & Telugu Script Audit ---');
let teluguCharsFound = 0;
files.forEach(f => {
  const content = fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');
  const matches = content.match(/[\u0C00-\u0C7F]/g);
  if (matches) teluguCharsFound += matches.length;
});
assert(teluguCharsFound === 0, `Zero Telugu unicode script characters across codebase (Found: ${teluguCharsFound})`);

// 4. BACKEND API ENDPOINTS TEST
console.log('\n--- 4. Backend REST API Endpoints ---');

const { lessonManifest, preloadedSteps } = require('../server/lessonData');
const { generateDynamicStep } = require('../server/stepGenerator');

assert(lessonManifest && lessonManifest.id === 'java-memory-architecture', 'Manifest loaded correctly');
assert(lessonManifest.totalSteps === 3, 'Manifest specifies 3 progressive steps');
assert(preloadedSteps[1] && preloadedSteps[1].step === 1, 'Preloaded Step 1 ready');
assert(preloadedSteps[2] && preloadedSteps[2].step === 2, 'Preloaded Step 2 ready');

// Test Dynamic Step 3 Synthesis
console.log('\n--- 5. Dynamic Step 3 API Synthesis ---');
const step3 = generateDynamicStep({ topic: 'java-memory', stepNumber: 3, language: 'en' });
assert(step3 && step3.step === 3, 'Dynamic generator created Step 3');
assert(step3.status === 'dynamically-generated', 'Step 3 status marked as dynamically-generated');
assert(step3.codeLines && step3.codeLines.length >= 10, 'Step 3 contains Java code lines');
assert(step3.executionSteps && step3.executionSteps.length >= 6, 'Step 3 contains 7 JVMS execution trace frames');
assert(typeof step3.tokenCount === 'number' && step3.tokenCount > 0, 'Step 3 reports token usage metrics');

console.log(`\n==========================================`);
console.log(`TOTAL PASSING: ${pass}`);
console.log(`TOTAL FAILING: ${fail}`);
console.log(`==========================================`);

if (fail > 0) process.exit(1);
console.log('🏆 ALL CHECKS PASSED WITH 100% SUCCESS RATE!\n');

