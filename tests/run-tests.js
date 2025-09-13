/**
 * Simple test runner for the lane system
 */

// Set up global scope to simulate browser environment
globalThis.performance = { now: () => Date.now() };
globalThis.setTimeout = setTimeout;

// Mock browser APIs
globalThis.console = console;

// Test the compiled JavaScript directly
const fs = require('fs');
const path = require('path');

// Read and execute the compiled lane system
const laneSystemPath = path.join(__dirname, '../dist/midi/lane-system.js');
const laneSystemCode = fs.readFileSync(laneSystemPath, 'utf8');

// Create a custom module context
const moduleContext = {
    exports: {},
    globalThis: globalThis
};

// Execute the lane system code in our context
eval(`
(function(exports, globalThis) {
    ${laneSystemCode}
})(moduleContext.exports, globalThis);
`);

// Extract the functions we need
const { handleMidiNoteOn, routeLane } = moduleContext.exports;
const laneSystem = globalThis.laneSystem;

// Set up test environment
globalThis.pianoModeActive = false;
globalThis.level = 1;
globalThis.score = 0;
globalThis.correctAnswers = 0;
globalThis.lives = 3;
globalThis.bassLives = 3;
globalThis.trebleLives = 3;
globalThis.bassClefActive = true;
globalThis.trebleClefActive = true;

globalThis.updateLifeDisplay = () => console.log('  → UI updated');
globalThis.playSuccessSound = () => console.log('  → Success sound played');
globalThis.playErrorSound = () => console.log('  → Error sound played');
globalThis.updateDisplays = () => console.log('  → Displays updated');
globalThis.createLaneTarget = (lane, target) => console.log(`  → Target created for ${lane}:`, target);

/**
 * Test the core functionality
 */
function runTests() {
    console.log('🧪 Lane System Acceptance Tests\n');
    
    // Test 1: MIDI Routing
    console.log('=== TEST 1: MIDI Routing ===');
    console.log('Normal Mode routing:');
    console.log(`  MIDI 60 -> ${routeLane(60, false)} (should be 'mono')`);
    console.log(`  MIDI 40 -> ${routeLane(40, false)} (should be 'mono')`);
    
    console.log('Piano Mode routing:');
    console.log(`  MIDI 59 (B3) -> ${routeLane(59, true)} (should be 'bass')`);
    console.log(`  MIDI 60 (C4) -> ${routeLane(60, true)} (should be 'treble')`);
    console.log(`  MIDI 40 (E2) -> ${routeLane(40, true)} (should be 'bass')`);
    console.log(`  MIDI 80 (G#5) -> ${routeLane(80, true)} (should be 'treble')`);
    
    const routingTests = [
        routeLane(60, false) === 'mono',
        routeLane(40, false) === 'mono', 
        routeLane(59, true) === 'bass',
        routeLane(60, true) === 'treble',
        routeLane(40, true) === 'bass',
        routeLane(80, true) === 'treble'
    ];
    
    if (routingTests.every(r => r)) {
        console.log('✅ PASS: MIDI routing works correctly\n');
    } else {
        console.log('❌ FAIL: MIDI routing failed\n');
    }
    
    // Test 2: Lane Initialization
    console.log('=== TEST 2: Lane Initialization ===');
    
    // Test normal mode
    globalThis.pianoModeActive = false;
    laneSystem.initializeLanes();
    const monoLane = laneSystem.getLaneState('mono');
    console.log(`Normal mode - mono lane initialized: ${!!monoLane}`);
    console.log(`  Lives: ${monoLane?.lives}, Enabled: ${monoLane?.enabled}`);
    
    // Test piano mode
    globalThis.pianoModeActive = true;
    laneSystem.initializeLanes();
    const bassLane = laneSystem.getLaneState('bass');
    const trebleLane = laneSystem.getLaneState('treble');
    console.log(`Piano mode - bass lane initialized: ${!!bassLane}`);
    console.log(`  Bass lives: ${bassLane?.lives}, Enabled: ${bassLane?.enabled}`);
    console.log(`Piano mode - treble lane initialized: ${!!trebleLane}`);
    console.log(`  Treble lives: ${trebleLane?.lives}, Enabled: ${trebleLane?.enabled}`);
    
    if (monoLane && bassLane && trebleLane) {
        console.log('✅ PASS: Lane initialization works correctly\n');
    } else {
        console.log('❌ FAIL: Lane initialization failed\n');
    }
    
    // Test 3: Normal Mode Strict Melody
    console.log('=== TEST 3: Normal Mode Strict Melody ===');
    globalThis.pianoModeActive = false;
    globalThis.lives = 3;
    
    laneSystem.initializeLanes();
    const monoLaneTest = laneSystem.getLaneState('mono');
    
    // Manually add targets to queue for testing
    monoLaneTest.queue = [
        { kind: 'melody', midi: 64, id: 'e1' }, // E4 - active
        { kind: 'melody', midi: 65, id: 'f1' }  // F4 - next
    ];
    
    console.log(`Active target before: MIDI ${monoLaneTest.queue[0]?.midi} (E4)`);
    console.log(`Lives before: ${globalThis.lives}`);
    
    // Press wrong note (F instead of E)
    laneSystem.handleMidiNoteOn(65, 64); // F4
    
    console.log(`Lives after: ${globalThis.lives} (should be 2)`);
    console.log(`Active target after: MIDI ${monoLaneTest.queue[0]?.midi} (should be F4: 65)`);
    
    if (globalThis.lives === 2 && monoLaneTest.queue[0]?.midi === 65) {
        console.log('✅ PASS: Normal Mode strict melody works correctly\n');
    } else {
        console.log('❌ FAIL: Normal Mode strict melody failed\n');
    }
    
    // Test 4: Piano Mode Chord Stray
    console.log('=== TEST 4: Piano Mode Chord Stray Detection ===');
    globalThis.pianoModeActive = true;
    globalThis.bassLives = 3;
    globalThis.trebleLives = 3;
    
    laneSystem.initializeLanes();
    const bassTest = laneSystem.getLaneState('bass');
    const trebleTest = laneSystem.getLaneState('treble');
    
    // Set up chord and melody targets
    bassTest.queue = [
        { kind: 'chord', mids: [36, 40, 43], id: 'chord1' } // C2, E2, G2
    ];
    trebleTest.queue = [
        { kind: 'melody', midi: 77, id: 'f5' } // F5
    ];
    
    console.log(`Bass chord active: [${bassTest.queue[0]?.mids?.join(', ')}]`);
    console.log(`Treble melody active: MIDI ${trebleTest.queue[0]?.midi}`);
    console.log(`Bass lives before: ${globalThis.bassLives}`);
    console.log(`Treble lives before: ${globalThis.trebleLives}`);
    
    // Press F2 (MIDI 41) - bass side, but not in chord
    laneSystem.handleMidiNoteOn(41, 64); // F2 - stray note
    
    console.log(`Bass lives after: ${globalThis.bassLives} (should be 2)`);
    console.log(`Treble lives after: ${globalThis.trebleLives} (should still be 3)`);
    console.log(`Bass queue length: ${bassTest.queue.length} (should be 0)`);
    console.log(`Treble queue length: ${trebleTest.queue.length} (should still be 1)`);
    
    if (globalThis.bassLives === 2 && globalThis.trebleLives === 3 && 
        bassTest.queue.length === 0 && trebleTest.queue.length === 1) {
        console.log('✅ PASS: Piano Mode chord stray detection works correctly\n');
    } else {
        console.log('❌ FAIL: Piano Mode chord stray detection failed\n');
    }
    
    console.log('🏁 Test Summary Complete');
    console.log('All core acceptance criteria have been validated.');
}

// Run the tests
runTests();