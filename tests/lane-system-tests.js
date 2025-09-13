/**
 * Test script to validate the lane-based note reading game acceptance criteria
 */

// Import the lane system for testing
import { handleMidiNoteOn, initializeLanes, getLaneState } from '../src/midi/lane-system.js';

// Mock global functions for testing
global.pianoModeActive = false;
global.level = 1;
global.score = 0;
global.correctAnswers = 0;
global.lives = 3;
global.bassLives = 3;
global.trebleLives = 3;
global.bassClefActive = true;
global.trebleClefActive = true;

global.updateLifeDisplay = () => console.log('UI updated');
global.playSuccessSound = () => console.log('Success sound played');
global.playErrorSound = () => console.log('Error sound played');
global.updateDisplays = () => console.log('Displays updated');
global.createLaneTarget = (lane, target) => console.log(`Target created for ${lane}:`, target);

/**
 * Test Case 1: Normal Mode, melody queue E–F–G in the single 'mono' lane:
 * Player presses F first -> E blows up immediately (one life lost), F becomes active.
 */
function testNormalModeStrictMelody() {
    console.log('\n=== TEST 1: Normal Mode Strict Melody ===');
    
    // Set up normal mode (not piano mode)
    global.pianoModeActive = false;
    global.lives = 3;
    
    // Initialize lanes
    initializeLanes();
    
    const monoLane = getLaneState('mono');
    console.log('Mono lane initialized:', !!monoLane);
    
    // Create test targets: E (MIDI 64) -> F (MIDI 65) -> G (MIDI 67)
    monoLane.queue = [
        { kind: 'melody', midi: 64, id: 'e1' }, // E4
        { kind: 'melody', midi: 65, id: 'f1' }, // F4  
        { kind: 'melody', midi: 67, id: 'g1' }  // G4
    ];
    
    console.log('Queue setup - Active target should be E (MIDI 64)');
    console.log('Active target:', monoLane.queue[0]);
    console.log('Lives before:', global.lives);
    
    // Player presses F first (MIDI 65) - should blow up E immediately
    handleMidiNoteOn(65, 64); // F4
    
    console.log('Lives after pressing F (wrong note):', global.lives);
    console.log('Queue after blow-up:', monoLane.queue.map(t => `${t.kind}:${t.midi}`));
    console.log('New active target should be F (MIDI 65):', monoLane.queue[0]);
    
    // Verify: Lives decreased, E removed, F is now active
    if (global.lives === 2 && monoLane.queue[0]?.midi === 65) {
        console.log('✅ PASS: Normal Mode strict melody works correctly');
    } else {
        console.log('❌ FAIL: Normal Mode strict melody failed');
    }
}

/**
 * Test Case 2: Piano Mode ON, bass chord C2–E2–G2 active; treble melody F5 active:
 * Player presses F2 (bass side, not in chord) -> bass chord blows up immediately.
 * Treble melody unaffected.
 */
function testPianoModeChordStray() {
    console.log('\n=== TEST 2: Piano Mode Chord Stray Detection ===');
    
    // Set up piano mode
    global.pianoModeActive = true;
    global.bassLives = 3;
    global.trebleLives = 3;
    
    // Initialize lanes
    initializeLanes();
    
    const bassLane = getLaneState('bass');
    const trebleLane = getLaneState('treble');
    
    // Set up bass chord C2-E2-G2 (MIDI 36, 40, 43) and treble melody F5 (MIDI 77)
    bassLane.queue = [
        { kind: 'chord', mids: [36, 40, 43], id: 'chord1' } // C2, E2, G2
    ];
    trebleLane.queue = [
        { kind: 'melody', midi: 77, id: 'f5' } // F5
    ];
    
    console.log('Bass chord active:', bassLane.queue[0]);
    console.log('Treble melody active:', trebleLane.queue[0]);
    console.log('Bass lives before:', global.bassLives);
    console.log('Treble lives before:', global.trebleLives);
    
    // Player presses F2 (MIDI 41) - bass side, not in chord
    handleMidiNoteOn(41, 64); // F2 - should blow up bass chord
    
    console.log('Bass lives after F2 (stray note):', global.bassLives);
    console.log('Treble lives (should be unchanged):', global.trebleLives);
    console.log('Bass queue after blow-up:', bassLane.queue.length);
    console.log('Treble queue (should be unchanged):', trebleLane.queue.length);
    
    // Verify: Bass lives decreased, bass chord removed, treble unaffected
    if (global.bassLives === 2 && global.trebleLives === 3 && bassLane.queue.length === 0 && trebleLane.queue.length === 1) {
        console.log('✅ PASS: Piano Mode chord stray detection works correctly');
    } else {
        console.log('❌ FAIL: Piano Mode chord stray detection failed');
    }
}

/**
 * Test Case 3: Piano Mode ON, treble melody stream: 
 * pressing any note != target blows up the treble melody target.
 */
function testPianoModeTrebleStrictMelody() {
    console.log('\n=== TEST 3: Piano Mode Treble Strict Melody ===');
    
    // Set up piano mode
    global.pianoModeActive = true;
    global.trebleLives = 3;
    
    // Initialize lanes
    initializeLanes();
    
    const trebleLane = getLaneState('treble');
    
    // Set up treble melody G5 (MIDI 79)
    trebleLane.queue = [
        { kind: 'melody', midi: 79, id: 'g5' } // G5
    ];
    
    console.log('Treble melody active (G5):', trebleLane.queue[0]);
    console.log('Treble lives before:', global.trebleLives);
    
    // Player presses A5 (MIDI 81) - treble side, but wrong note
    handleMidiNoteOn(81, 64); // A5 - should blow up G5
    
    console.log('Treble lives after A5 (wrong note):', global.trebleLives);
    console.log('Treble queue after blow-up:', trebleLane.queue.length);
    
    // Verify: Treble lives decreased, melody removed
    if (global.trebleLives === 2 && trebleLane.queue.length === 0) {
        console.log('✅ PASS: Piano Mode treble strict melody works correctly');
    } else {
        console.log('❌ FAIL: Piano Mode treble strict melody failed');
    }
}

/**
 * Test Case 4: MIDI routing verification
 */
function testMidiRouting() {
    console.log('\n=== TEST 4: MIDI Routing ===');
    
    // Import routing function
    const { routeLane } = require('../dist/midi/lane-system.js');
    
    console.log('Testing Normal Mode routing:');
    console.log('MIDI 60 -> lane:', routeLane(60, false)); // Should be 'mono'
    console.log('MIDI 40 -> lane:', routeLane(40, false)); // Should be 'mono'
    
    console.log('Testing Piano Mode routing:');
    console.log('MIDI 59 (B3) -> lane:', routeLane(59, true)); // Should be 'bass'
    console.log('MIDI 60 (C4) -> lane:', routeLane(60, true)); // Should be 'treble'
    console.log('MIDI 40 (E2) -> lane:', routeLane(40, true)); // Should be 'bass'
    console.log('MIDI 80 (G#5) -> lane:', routeLane(80, true)); // Should be 'treble'
    
    // Verify correct routing
    const results = [
        routeLane(60, false) === 'mono',
        routeLane(40, false) === 'mono',
        routeLane(59, true) === 'bass',
        routeLane(60, true) === 'treble',
        routeLane(40, true) === 'bass',
        routeLane(80, true) === 'treble'
    ];
    
    if (results.every(r => r)) {
        console.log('✅ PASS: MIDI routing works correctly');
    } else {
        console.log('❌ FAIL: MIDI routing failed');
    }
}

// Run all tests
function runAllTests() {
    console.log('Running Lane System Acceptance Tests...\n');
    
    try {
        testNormalModeStrictMelody();
        testPianoModeChordStray();
        testPianoModeTrebleStrictMelody();
        testMidiRouting();
        
        console.log('\n=== TEST SUMMARY ===');
        console.log('All core acceptance criteria tests completed.');
        console.log('Check individual test results above for PASS/FAIL status.');
    } catch (error) {
        console.error('Test execution error:', error);
    }
}

// Export for use
export { runAllTests };