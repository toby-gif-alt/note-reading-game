#!/usr/bin/env node
/**
 * Simple test runner that can handle the compiled lane system
 */

const fs = require('fs');
const path = require('path');

// Set up global environment
global.performance = { now: () => Date.now() };
global.setTimeout = setTimeout;

// Set up global state
global.pianoModeActive = false;
global.level = 1;
global.lives = 3;
global.bassLives = 3;
global.trebleLives = 3;
global.bassClefActive = true;
global.trebleClefActive = true;

global.updateLifeDisplay = () => console.log('  → UI updated');
global.playSuccessSound = () => console.log('  → Success sound');
global.playErrorSound = () => console.log('  → Error sound');
global.updateDisplays = () => console.log('  → Displays updated');
global.createLaneTarget = (lane, target) => console.log(`  → Target created for ${lane}:`, target);

// Read the compiled lane system
const laneSystemPath = path.join(__dirname, 'dist/midi/lane-system.js');
const laneSystemCode = fs.readFileSync(laneSystemPath, 'utf8');

// Create an isolated execution context
const vm = require('vm');
const context = vm.createContext({
  ...global,
  exports: {},
  globalThis: global
});

// Execute the compiled code in isolation
vm.runInContext(laneSystemCode, context);

// Extract the functions we need
const {
  handleMidiNoteOn,
  routeLane,
  initializeLanes,
  getLaneState,
  updateLaneState
} = global.laneSystem;

const laneSystem = global.laneSystem;

console.log('🧪 Piano Mode Lane System Tests\n');

// Test 1: MIDI routing
console.log('=== TEST 1: MIDI Routing ===');
console.log(`Normal Mode MIDI 60 -> ${routeLane(60, false)} (should be 'mono')`);
console.log(`Normal Mode MIDI 40 -> ${routeLane(40, false)} (should be 'mono')`);
console.log(`Piano Mode MIDI 59 (B3) -> ${routeLane(59, true)} (should be 'bass')`);
console.log(`Piano Mode MIDI 60 (C4) -> ${routeLane(60, true)} (should be 'treble')`);
console.log(`Piano Mode MIDI 40 (E2) -> ${routeLane(40, true)} (should be 'bass')`);
console.log(`Piano Mode MIDI 80 (G#5) -> ${routeLane(80, true)} (should be 'treble')`);

const routingPass = (
  routeLane(60, false) === 'mono' &&
  routeLane(40, false) === 'mono' &&
  routeLane(59, true) === 'bass' &&
  routeLane(60, true) === 'treble' &&
  routeLane(40, true) === 'bass' &&
  routeLane(80, true) === 'treble'
);
console.log(routingPass ? '✅ PASS\n' : '❌ FAIL\n');

// Test 2: Lane initialization
console.log('=== TEST 2: Lane Initialization ===');
global.pianoModeActive = true;
initializeLanes();
const bassLane = getLaneState('bass');
const trebleLane = getLaneState('treble');
console.log(`Bass lane: lives=${bassLane?.lives}, enabled=${bassLane?.enabled}`);
console.log(`Treble lane: lives=${trebleLane?.lives}, enabled=${trebleLane?.enabled}`);
const initPass = bassLane && trebleLane && bassLane.lives === 3 && trebleLane.lives === 3;
console.log(initPass ? '✅ PASS\n' : '❌ FAIL\n');

// Test 3: Chord stray detection
console.log('=== TEST 3: Piano Mode Chord Stray Detection ===');
global.pianoModeActive = true;
global.bassLives = 3;
global.trebleLives = 3;

// Reset and set up test
initializeLanes();
const bassTest = getLaneState('bass');
const trebleTest = getLaneState('treble');

// Add test targets
bassTest.queue = [{ kind: 'chord', mids: [36, 40, 43], id: 'chord1' }]; // C2, E2, G2
trebleTest.queue = [{ kind: 'melody', midi: 77, id: 'f5' }]; // F5

console.log(`Before: Bass lives=${global.bassLives}, Treble lives=${global.trebleLives}`);
console.log(`Bass chord: [${bassTest.queue[0]?.mids?.join(', ')}]`);
console.log(`Treble melody: ${trebleTest.queue[0]?.midi}`);

// Press stray note in bass (F2 = 41, not in chord [36,40,43])
handleMidiNoteOn(41, 64);

console.log(`After F2 press: Bass lives=${global.bassLives}, Treble lives=${global.trebleLives}`);
console.log(`Bass queue length: ${bassTest.queue.length}`);
console.log(`Treble queue length: ${trebleTest.queue.length}`);

const strayPass = (
  global.bassLives === 2 && // Bass lost a life
  global.trebleLives === 3 && // Treble unaffected
  bassTest.queue.length === 0 && // Bass chord removed
  trebleTest.queue.length === 1 // Treble melody still there
);
console.log(strayPass ? '✅ PASS\n' : '❌ FAIL\n');

// Test 4: Melody strict mode
console.log('=== TEST 4: Piano Mode Strict Melody ===');
global.pianoModeActive = true;
global.trebleLives = 3;

initializeLanes();
const trebleMelodyTest = getLaneState('treble');
trebleMelodyTest.queue = [{ kind: 'melody', midi: 79, id: 'g5' }]; // G5

console.log(`Before: Treble lives=${global.trebleLives}`);
console.log(`Target: G5 (${trebleMelodyTest.queue[0]?.midi})`);

// Press wrong note A5 (81) instead of G5 (79)
handleMidiNoteOn(81, 64);

console.log(`After A5 press: Treble lives=${global.trebleLives}`);
console.log(`Queue length: ${trebleMelodyTest.queue.length}`);

const melodyPass = (
  global.trebleLives === 2 && // Lost a life
  trebleMelodyTest.queue.length === 0 // Target removed
);
console.log(melodyPass ? '✅ PASS\n' : '❌ FAIL\n');

console.log('🏁 Test Summary:');
console.log(`Routing: ${routingPass ? '✅' : '❌'}`);
console.log(`Initialization: ${initPass ? '✅' : '❌'}`);
console.log(`Chord Stray: ${strayPass ? '✅' : '❌'}`);
console.log(`Melody Strict: ${melodyPass ? '✅' : '❌'}`);

const allPass = routingPass && initPass && strayPass && melodyPass;
console.log(`\nOverall: ${allPass ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAILED'}`);

process.exit(allPass ? 0 : 1);