/**
 * MIDI Integration for Note Reading Game
 * Connects the MIDI manager to the lane-based game system
 */
import { midiManager } from './midi-manager.js';
import { getNaturalNoteForGame } from './midi-utils.js';
import { initializeLanes } from './lane-system.js';
// Constants for MIDI routing as specified
const BASS_MAX_MIDI = 59; // B3
const TREBLE_MIN_MIDI = 60; // C4
function _isPianoOn() {
    return !!(typeof globalThis.pianoModeActive !== 'undefined' ? globalThis.pianoModeActive
        : (globalThis.gameSettings && globalThis.gameSettings.pianoMode));
}
function _routeClefByMidi(midi) {
    return (midi <= BASS_MAX_MIDI) ? 'bass' : 'treble';
}
// Per-clef transient chord state 
const __chordStart = { bass: null, treble: null };
const __chordHits = { bass: new Set(), treble: new Set() };
// Tiny helpers (reuse existing UI/life functions if present)
function _decLife(clef) {
    if (!_isPianoOn()) {
        if (typeof globalThis.lives === 'number') {
            globalThis.lives = Math.max(0, globalThis.lives - 1);
        }
        if (typeof globalThis.updateLifeDisplay === 'function') {
            globalThis.updateLifeDisplay();
        }
        return;
    }
    if (clef === 'bass') {
        globalThis.bassLives = Math.max(0, (globalThis.bassLives ?? 3) - 1);
        if (typeof globalThis.updateLifeDisplay === 'function') {
            globalThis.updateLifeDisplay();
        }
    }
    if (clef === 'treble') {
        globalThis.trebleLives = Math.max(0, (globalThis.trebleLives ?? 3) - 1);
        if (typeof globalThis.updateLifeDisplay === 'function') {
            globalThis.updateLifeDisplay();
        }
    }
}
function _laneAlive(clef) {
    if (!_isPianoOn())
        return (typeof globalThis.lives === 'number' ? globalThis.lives > 0 : true);
    return clef === 'bass' ? (globalThis.bassLives ?? 1) > 0 : (globalThis.trebleLives ?? 1) > 0;
}
function _afterLifeChangeStopIfNeeded() {
    if (!_isPianoOn())
        return; // Normal Mode unchanged
    if ((globalThis.bassLives ?? 1) <= 0 && typeof globalThis.disableBassLane === 'function') {
        globalThis.disableBassLane();
    }
    if ((globalThis.trebleLives ?? 1) <= 0 && typeof globalThis.disableTrebleLane === 'function') {
        globalThis.disableTrebleLane();
    }
    if ((globalThis.bassLives ?? 1) <= 0 && (globalThis.trebleLives ?? 1) <= 0 && typeof globalThis.stopGame === 'function') {
        globalThis.stopGame('piano-both-dead');
    }
}
// Bridge functions to connect to main game evaluation
function _activeMelodyTarget(clef) {
    // Map to the main game's movingNotes array - find first melody target for this clef
    const movingNotes = globalThis.movingNotes;
    if (!movingNotes || !Array.isArray(movingNotes))
        return null;
    for (const note of movingNotes) {
        if (note.clef === clef && (!note.kind || note.kind === 'melody')) {
            return { midi: note.midiNote, id: note.id || note.note + note.octave, kind: 'melody' };
        }
    }
    return null;
}
function _activeChordTarget(clef) {
    // Map to the main game's movingNotes array - find first chord target for this clef
    const movingNotes = globalThis.movingNotes;
    if (!movingNotes || !Array.isArray(movingNotes))
        return null;
    for (const note of movingNotes) {
        if (note.clef === clef && note.kind === 'chord' && Array.isArray(note.mids)) {
            return { mids: note.mids, id: note.id || 'chord-' + note.mids.join('-'), kind: 'chord' };
        }
    }
    return null;
}
function _success(clef, target) {
    // Remove target from movingNotes, play success FX, increment score
    const movingNotes = globalThis.movingNotes;
    if (movingNotes && Array.isArray(movingNotes)) {
        const index = movingNotes.findIndex((note) => (note.id && note.id === target.id) ||
            (note.midiNote === target.midi) ||
            (Array.isArray(note.mids) && Array.isArray(target.mids) &&
                note.mids.length === target.mids.length &&
                note.mids.every((mid) => target.mids.includes(mid))));
        if (index !== -1) {
            movingNotes.splice(index, 1);
        }
    }
    // Play success effects
    if (typeof globalThis.playCorrectSound === 'function') {
        globalThis.playCorrectSound();
    }
    // Update score
    globalThis.score = (globalThis.score || 0) + 1;
    globalThis.correctAnswers = (globalThis.correctAnswers || 0) + 1;
    // Update displays
    if (typeof globalThis.updateDisplays === 'function') {
        globalThis.updateDisplays();
    }
}
function _fail(clef, target, why) {
    // Remove target from movingNotes, play fail FX, decrement lives
    const movingNotes = globalThis.movingNotes;
    if (movingNotes && Array.isArray(movingNotes)) {
        const index = movingNotes.findIndex((note) => (note.id && note.id === target.id) ||
            (note.midiNote === target.midi) ||
            (Array.isArray(note.mids) && Array.isArray(target.mids) &&
                note.mids.length === target.mids.length &&
                note.mids.every((mid) => target.mids.includes(mid))));
        if (index !== -1) {
            movingNotes.splice(index, 1);
        }
    }
    _decLife(clef);
    _afterLifeChangeStopIfNeeded();
    // Play fail effects
    if (typeof globalThis.playExplosionSound === 'function') {
        globalThis.playExplosionSound();
    }
}
function _modeOf(clef) {
    // Read existing piano mode settings for this lane
    // Access global pianoModeSettings if available, otherwise check window properties
    const globalSettings = globalThis.pianoModeSettings || pianoModeSettings;
    if (clef === 'bass') {
        const leftHandMode = globalSettings?.leftHand || globalThis.leftHandMode;
        if (leftHandMode === 'chords')
            return 'chord';
    }
    if (clef === 'treble') {
        const rightHandMode = globalSettings?.rightHand || globalThis.rightHandMode;
        if (rightHandMode === 'chords')
            return 'chord';
    }
    return 'melody'; // Default to melody so we never no-op
}
// The main dispatcher as specified
function dispatchNoteOn(midi, velocity) {
    // If game is paused/not started, early-out only if that is TRUE
    if (!globalThis.gameRunning)
        return;
    // Call the new one-at-a-time MIDI evaluation bridge
    if (typeof globalThis.handleNoteOnOneAtATime === 'function') {
        globalThis.handleNoteOnOneAtATime(midi, velocity);
        return;
    }
    // Fallback to existing logic if the new handler isn't loaded yet
    if (!_isPianoOn())
        return; // Normal Mode already handled by existing code
    const clef = _routeClefByMidi(midi);
    if (!_laneAlive(clef))
        return;
    const mode = _modeOf(clef);
    if (mode === 'melody') {
        const t = _activeMelodyTarget(clef);
        if (!t)
            return; // nothing to evaluate
        if (midi === t.midi) {
            _success(clef, t);
        }
        else {
            _fail(clef, t, 'melody-wrong');
        }
        return;
    }
    // mode === 'chord'
    const chord = _activeChordTarget(clef);
    if (!chord)
        return;
    const tones = new Set(chord.mids);
    // STRAY in same clef -> immediate fail
    if (!tones.has(midi)) {
        _fail(clef, chord, 'chord-stray');
        __chordHits[clef].clear();
        __chordStart[clef] = null;
        return;
    }
    // First correct tone starts 100ms window
    if (__chordStart[clef] === null) {
        const started = performance.now();
        __chordStart[clef] = started;
        __chordHits[clef].clear();
        setTimeout(() => {
            // If still same chord active and not all tones collected -> timeout fail
            const still = _activeChordTarget(clef);
            if (!still || still.id !== chord.id)
                return;
            if (__chordStart[clef] !== started)
                return; // already resolved
            if (__chordHits[clef].size < new Set(still.mids).size) {
                _fail(clef, still, 'chord-timeout');
            }
            __chordHits[clef].clear();
            __chordStart[clef] = null;
        }, 100);
    }
    __chordHits[clef].add(midi);
    if (__chordHits[clef].size === new Set(chord.mids).size) {
        _success(clef, chord);
        __chordHits[clef].clear();
        __chordStart[clef] = null;
    }
}
// Test function for Piano Mode dispatcher (expose globally for testing)
function testMidiDispatch(midi, velocity = 64) {
    const beforeTargets = globalThis.movingNotes ? globalThis.movingNotes.length : 0;
    const beforeScore = globalThis.score || 0;
    const beforeBassLives = globalThis.bassLives || 0;
    const beforeTrebleLives = globalThis.trebleLives || 0;
    dispatchNoteOn(midi, velocity);
    const afterTargets = globalThis.movingNotes ? globalThis.movingNotes.length : 0;
    const afterScore = globalThis.score || 0;
    const afterBassLives = globalThis.bassLives || 0;
    const afterTrebleLives = globalThis.trebleLives || 0;
    const result = {
        midi,
        clef: _routeClefByMidi(midi),
        pianoMode: _isPianoOn(),
        beforeTargets,
        afterTargets,
        beforeScore,
        afterScore,
        beforeBassLives,
        afterBassLives,
        beforeTrebleLives,
        afterTrebleLives,
        targetsChanged: beforeTargets !== afterTargets,
        scoreChanged: beforeScore !== afterScore,
        livesChanged: beforeBassLives !== afterBassLives || beforeTrebleLives !== afterTrebleLives
    };
    return JSON.stringify(result, null, 2);
}
// Piano Mode state
let pianoModeSettings = {
    isActive: false,
    chordMode: false,
    forceGrandStaff: true,
    leftHand: 'none',
    rightHand: 'none'
};
/**
 * Reinitialize MIDI connections after game restart
 * Call this function when the game restarts to ensure MIDI stays active
 */
export function reinitializeMidiAfterRestart() {
    console.log('Reinitializing MIDI after game restart...');
    // Re-initialize the lane system
    initializeLanes();
    // Re-register the note input callback since the game might have reset handlers
    midiManager.clearNoteInputCallbacks();
    midiManager.onNoteInput((noteMapping) => {
        // Visual feedback for MIDI input (FIRST)
        const noteForGame = getNaturalNoteForGame(noteMapping.midiNote);
        highlightMidiInput(noteForGame);
        // IMPORTANT: CALL THE DISPATCHER right after UI highlight
        dispatchNoteOn(noteMapping.midiNote, 64);
        // Legacy support: also call the existing game handlers for compatibility
        // Call the octave-aware game input handler for Piano Mode strict mode support
        if (typeof window.handleNoteInputWithOctave === 'function') {
            window.handleNoteInputWithOctave(noteForGame, noteMapping.octave);
        }
        else if (typeof window.handleNoteInput === 'function') {
            // Fallback to regular handler if octave-aware version not available
            window.handleNoteInput(noteForGame);
        }
    });
    // Update UI to reflect current status
    updateMidiUI();
    console.log('MIDI reinitialization complete');
}
export function initializeMidiIntegration() {
    // Check if handleNoteInput function exists (from script.js)
    if (typeof window.handleNoteInput !== 'function') {
        console.warn('handleNoteInput function not found. MIDI integration may not work correctly.');
        return;
    }
    // Initialize the lane system
    initializeLanes();
    // Register MIDI input callback to route to game input handler
    midiManager.onNoteInput((noteMapping) => {
        // Visual feedback for MIDI input (FIRST)
        const noteForGame = getNaturalNoteForGame(noteMapping.midiNote);
        highlightMidiInput(noteForGame);
        // IMPORTANT: CALL THE DISPATCHER right after UI highlight
        dispatchNoteOn(noteMapping.midiNote, 64);
        // Legacy support: only call legacy handlers in Normal Mode to avoid conflicts
        if (!pianoModeSettings.isActive) {
            // Call the octave-aware game input handler for Normal Mode
            if (typeof window.handleNoteInputWithOctave === 'function') {
                window.handleNoteInputWithOctave(noteForGame, noteMapping.octave);
            }
            else if (typeof window.handleNoteInput === 'function') {
                // Fallback to regular handler if octave-aware version not available
                window.handleNoteInput(noteForGame);
            }
        }
    });
    // Set up device connection monitoring
    midiManager.on('deviceConnected', (device) => {
        console.log(`MIDI device connected: ${device.name}`);
        // Activate Piano Mode when device is connected
        pianoModeSettings.isActive = true;
        globalThis.pianoModeActive = true;
        // Initialize per-clef lives when Piano Mode turns ON
        if (_isPianoOn()) {
            if (typeof globalThis.bassLives === 'undefined') {
                globalThis.bassLives = typeof globalThis.lives === 'number' ? globalThis.lives : 3;
            }
            if (typeof globalThis.trebleLives === 'undefined') {
                globalThis.trebleLives = typeof globalThis.lives === 'number' ? globalThis.lives : 3;
            }
        }
        updatePianoModeUI();
        updateMidiUI();
        showMidiNotification(`Piano Mode Activated: ${device.name}`, 'success');
    });
    midiManager.on('deviceDisconnected', (device) => {
        console.log(`MIDI device disconnected: ${device.name}`);
        // Check if any devices are still connected
        const status = midiManager.getStatus();
        if (status.connectedDevices.length === 0) {
            pianoModeSettings.isActive = false;
            updatePianoModeUI();
        }
        updateMidiUI();
        showMidiNotification(`Disconnected: ${device.name}`, 'warning');
    });
    midiManager.on('statusChanged', (status) => {
        updateMidiUI();
    });
    // Initialize UI
    setTimeout(updateMidiUI, 1000); // Allow time for initial device scan
    // Load saved MIDI settings
    setTimeout(loadSavedMidiSettings, 1500);
}
/**
 * Highlight the corresponding on-screen button when MIDI input is received
 */
function highlightMidiInput(note) {
    const button = document.querySelector(`.pitch-btn[data-note="${note}"]`);
    if (button) {
        button.classList.add('midi-highlight');
        setTimeout(() => {
            button.classList.remove('midi-highlight');
        }, 200);
    }
}
/**
 * Update the MIDI UI elements with current status
 */
function updateMidiUI() {
    const status = midiManager.getStatus();
    const devices = midiManager.getConnectedDevices();
    // Update device selector
    const deviceSelector = document.getElementById('midiDeviceSelector');
    if (deviceSelector) {
        // Clear existing options
        deviceSelector.innerHTML = '<option value="">Select MIDI Device</option>';
        // Add connected devices
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.id;
            option.textContent = `${device.name} (${device.manufacturer})`;
            option.selected = device.id === status.selectedDeviceId;
            deviceSelector.appendChild(option);
        });
        deviceSelector.disabled = devices.length === 0;
    }
    // Update status indicator
    const statusIndicator = document.getElementById('midiStatus');
    if (statusIndicator) {
        if (!status.isSupported) {
            statusIndicator.textContent = 'MIDI not supported';
            statusIndicator.className = 'midi-status error';
        }
        else if (devices.length === 0) {
            statusIndicator.textContent = 'No MIDI devices';
            statusIndicator.className = 'midi-status warning';
        }
        else if (status.selectedDeviceId) {
            const selectedDevice = devices.find(d => d.id === status.selectedDeviceId);
            statusIndicator.textContent = `Connected: ${selectedDevice?.name}`;
            statusIndicator.className = 'midi-status success';
        }
        else {
            statusIndicator.textContent = 'MIDI available';
            statusIndicator.className = 'midi-status info';
        }
    }
    // Update device count
    const deviceCount = document.getElementById('midiDeviceCount');
    if (deviceCount) {
        deviceCount.textContent = `${devices.length} device${devices.length !== 1 ? 's' : ''}`;
    }
}
/**
 * Show a temporary notification for MIDI events
 */
function showMidiNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('midiNotification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'midiNotification';
        notification.className = 'midi-notification';
        document.body.appendChild(notification);
    }
    // Update content and show
    notification.textContent = message;
    notification.className = `midi-notification ${type} show`;
    // Hide after delay
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}
/**
 * Handle device selection from UI
 */
export function handleDeviceSelection(deviceId) {
    if (deviceId) {
        const success = midiManager.selectDevice(deviceId);
        if (success) {
            const device = midiManager.getSelectedDevice();
            showMidiNotification(`Selected: ${device?.name}`, 'success');
        }
        else {
            showMidiNotification('Failed to connect to device', 'error');
        }
    }
}
/**
 * Get MIDI connection status for external use
 */
export function getMidiStatus() {
    return midiManager.getStatus();
}
/**
 * Get list of connected MIDI devices
 */
export function getConnectedDevices() {
    return midiManager.getConnectedDevices();
}
/**
 * Enable/disable MIDI input
 */
export function setMidiEnabled(enabled) {
    midiManager.setEnabled(enabled);
}
/**
 * Load saved MIDI settings from localStorage
 */
function loadSavedMidiSettings() {
    const saved = localStorage.getItem('noteGameMidiSettings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            console.log('Loading saved MIDI settings:', settings);
            // If there was a previously selected device, try to select it again
            if (settings.selectedDeviceId) {
                const success = midiManager.selectDevice(settings.selectedDeviceId);
                if (success) {
                    console.log(`Restored MIDI device: ${settings.selectedDeviceName}`);
                    showMidiNotification(`Restored: ${settings.selectedDeviceName}`, 'success');
                }
                else {
                    console.log(`Could not restore MIDI device: ${settings.selectedDeviceName} (device not available)`);
                    showMidiNotification(`Device not available: ${settings.selectedDeviceName}`, 'warning');
                }
                updateMidiUI();
            }
        }
        catch (error) {
            console.error('Failed to load MIDI settings:', error);
        }
    }
}
/**
 * Clean up MIDI integration
 */
export function destroyMidiIntegration() {
    midiManager.destroy();
    // Clean up UI elements
    const notification = document.getElementById('midiNotification');
    if (notification) {
        notification.remove();
    }
    // Reset Piano Mode
    pianoModeSettings.isActive = false;
    updatePianoModeUI();
}
/**
 * Update Piano Mode UI elements
 */
function updatePianoModeUI() {
    const pianoControls = document.getElementById('pianoModeControls');
    if (pianoControls) {
        // Show piano mode controls when active
        pianoControls.style.display = pianoModeSettings.isActive ? 'block' : 'none';
    }
    // Update dropdowns and checkboxes to match current settings
    const leftHandSelect = document.getElementById('leftHandMode');
    const rightHandSelect = document.getElementById('rightHandMode');
    const grandStaffCheck = document.getElementById('pianoGrandStaffForce');
    if (leftHandSelect)
        leftHandSelect.value = pianoModeSettings.leftHand || 'none';
    if (rightHandSelect)
        rightHandSelect.value = pianoModeSettings.rightHand || 'none';
    if (grandStaffCheck)
        grandStaffCheck.checked = pianoModeSettings.forceGrandStaff;
    // Notify the game of Piano Mode changes (but don't cause circular calls)
    if (typeof window.onPianoModeChanged === 'function') {
        window.onPianoModeChanged(pianoModeSettings);
    }
}
/**
 * Get current Piano Mode settings
 */
export function getPianoModeSettings() {
    return { ...pianoModeSettings };
}
/**
 * Update Piano Mode settings
 */
export function updatePianoModeSettings(settings) {
    pianoModeSettings = { ...pianoModeSettings, ...settings };
    updatePianoModeUI();
    // Save to localStorage
    localStorage.setItem('pianoModeSettings', JSON.stringify(pianoModeSettings));
    // Also update global reference
    globalThis.pianoModeSettings = pianoModeSettings;
}
// Export test function for debugging
export function testMidiDispatcherExternal(midi, velocity = 64) {
    return testMidiDispatch(midi, velocity);
}
/**
 * Initialize Piano Mode UI event listeners
 */
function initializePianoModeUI() {
    // Load saved Piano Mode settings
    const saved = localStorage.getItem('pianoModeSettings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            pianoModeSettings = { ...pianoModeSettings, ...settings };
        }
        catch (e) {
            console.warn('Could not load Piano Mode settings:', e);
        }
    }
    // Set up event listeners for Piano Mode controls
    const leftHandSelect = document.getElementById('leftHandMode');
    const rightHandSelect = document.getElementById('rightHandMode');
    const grandStaffCheck = document.getElementById('pianoGrandStaffForce');
    if (leftHandSelect) {
        leftHandSelect.addEventListener('change', () => {
            updatePianoModeSettings({ leftHand: leftHandSelect.value });
        });
    }
    if (rightHandSelect) {
        rightHandSelect.addEventListener('change', () => {
            updatePianoModeSettings({ rightHand: rightHandSelect.value });
        });
    }
    if (grandStaffCheck) {
        grandStaffCheck.addEventListener('change', () => {
            updatePianoModeSettings({ forceGrandStaff: grandStaffCheck.checked });
        });
    }
}
// Auto-initialize when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeMidiIntegration();
        initializePianoModeUI();
        // Make test function globally accessible for testing
        globalThis.testMidiDispatcher = testMidiDispatch;
        // Make piano mode settings globally accessible
        globalThis.pianoModeSettings = pianoModeSettings;
        // Make noteOn function available for self-test
        globalThis.noteOn = (midi, velocity = 100) => {
            dispatchNoteOn(midi, velocity);
        };
    });
}
else {
    // If document is already loaded, initialize immediately
    initializeMidiIntegration();
    initializePianoModeUI();
    // Make test function globally accessible for testing
    globalThis.testMidiDispatcher = testMidiDispatch;
    // Make piano mode settings globally accessible
    globalThis.pianoModeSettings = pianoModeSettings;
    // Make noteOn function available for self-test
    globalThis.noteOn = (midi, velocity = 100) => {
        dispatchNoteOn(midi, velocity);
    };
}
// QUICK SELF-TEST (paste in DevTools Console after rebuild)
// Copy this to DevTools console to test:
/*
// Treble melody strictness test
window.pianoModeActive = true;
window.bassLives = 2; window.trebleLives = 2;
window.gameRunning = true;
if (!window.movingNotes) window.movingNotes = [];
window.movingNotes.length = 0;

// Add test targets
window.movingNotes.push({
  clef: 'treble', note: 'E', octave: 5, midiNote: 76, id: 'test-e5', x: 100, kind: 'melody'
});
window.movingNotes.push({
  clef: 'bass', kind: 'chord', mids: [36, 40, 43], id: 'test-c2-chord', x: 100
});

// Test cases:
console.log('=== MIDI Piano Mode Self-Test ===');
console.log('1. Wrong treble first');
noteOn(77, 100);   // F5 -> treble fail expected
console.log('Bass lives:', window.bassLives, 'Treble lives:', window.trebleLives);

// Re-add treble target for next test
window.movingNotes.unshift({
  clef: 'treble', note: 'E', octave: 5, midiNote: 76, id: 'test-e5-2', x: 100, kind: 'melody'
});

console.log('2. Correct treble');
noteOn(76, 100);   // E5 -> treble success
console.log('Score:', window.score, 'Bass lives:', window.bassLives, 'Treble lives:', window.trebleLives);

console.log('3. Bass chord success within 100ms');
// Set bass to chord mode for this test
window.pianoModeSettings.leftHand = 'chords';
noteOn(36,100); setTimeout(()=>noteOn(40,100),30); setTimeout(()=>noteOn(43,100),60);

console.log('4. New bass chord stray -> immediate fail');
window.movingNotes.push({
  clef: 'bass', kind: 'chord', mids: [36, 40, 43], id: 'test-c2-chord-2', x: 100
});
noteOn(41,100);    // F2 -> bass fail expected
console.log('Final - Bass lives:', window.bassLives, 'Treble lives:', window.trebleLives);
*/
// Expose functions globally for integration with existing game code
window.handleDeviceSelection = handleDeviceSelection;
window.isPianoModeActive = () => pianoModeSettings.isActive;
window.getPianoModeSettings = getPianoModeSettings;
window.getMenuMidiStatus = () => midiManager.getStatus();
window.reinitializeMidiAfterRestart = reinitializeMidiAfterRestart;
//# sourceMappingURL=midi-integration.js.map