/**
 * MIDI Integration for Note Reading Game
 * Connects the MIDI manager to the lane-based game system
 */

// Extend Window interface for global functions
declare global {
  interface Window {
    handleNoteInput: (userNote: string) => Promise<void>;
    handleNoteInputWithOctave: (userNote: string, userOctave: number | null) => Promise<void>;
    handleDeviceSelection: (deviceId: string) => void;
    updatePianoModeUI: () => void;
    isPianoModeActive: () => boolean;
    getPianoModeSettings: () => PianoModeSettings;
    reinitializeMidiAfterRestart: () => void;
  }
}

import { midiManager } from './midi-manager.js';
import { MidiDevice, MidiConnectionStatus, MidiNoteMapping, PianoModeSettings } from './midi-types.js';
import { getNaturalNoteForGame } from './midi-utils.js';
import { handleMidiNoteOn, initializeLanes } from './lane-system.js';

// Constants for MIDI routing as specified
const BASS_MAX_MIDI = 59;   // B3
const TREBLE_MIN_MIDI = 60; // C4

function _isPianoOn(): boolean {
  return !!(typeof (globalThis as any).pianoModeActive !== 'undefined' ? (globalThis as any).pianoModeActive
           : ((globalThis as any).gameSettings && (globalThis as any).gameSettings.pianoMode));
}

function _routeClefByMidi(midi: number): 'bass' | 'treble' {
  return (midi <= BASS_MAX_MIDI) ? 'bass' : 'treble';
}

// Per-clef transient chord state 
const __chordStart   = { bass: null as number | null, treble: null as number | null };
const __chordHits    = { bass: new Set<number>(), treble: new Set<number>() };

// Tiny helpers (reuse existing UI/life functions if present)
function _decLife(clef: 'bass' | 'treble'): void {
  if (!_isPianoOn()) { 
    if (typeof (globalThis as any).lives === 'number') {
      (globalThis as any).lives = Math.max(0, (globalThis as any).lives - 1); 
    }
    if (typeof (globalThis as any).updateLifeDisplay === 'function') {
      (globalThis as any).updateLifeDisplay();
    }
    return; 
  }
  if (clef === 'bass')   { 
    (globalThis as any).bassLives   = Math.max(0, ((globalThis as any).bassLives   ?? 3) - 1); 
    if (typeof (globalThis as any).updateLifeDisplay === 'function') {
      (globalThis as any).updateLifeDisplay();
    }
  }
  if (clef === 'treble') { 
    (globalThis as any).trebleLives = Math.max(0, ((globalThis as any).trebleLives ?? 3) - 1); 
    if (typeof (globalThis as any).updateLifeDisplay === 'function') {
      (globalThis as any).updateLifeDisplay();
    }
  }
}

function _laneAlive(clef: 'bass' | 'treble'): boolean {
  if (!_isPianoOn()) return (typeof (globalThis as any).lives === 'number' ? (globalThis as any).lives > 0 : true);
  return clef === 'bass' ? ((globalThis as any).bassLives ?? 1) > 0 : ((globalThis as any).trebleLives ?? 1) > 0;
}

function _afterLifeChangeStopIfNeeded(): void {
  if (!_isPianoOn()) return; // Normal Mode unchanged
  if (((globalThis as any).bassLives ?? 1) <= 0 && typeof (globalThis as any).disableBassLane === 'function') {
    (globalThis as any).disableBassLane();
  }
  if (((globalThis as any).trebleLives ?? 1) <= 0 && typeof (globalThis as any).disableTrebleLane === 'function') {
    (globalThis as any).disableTrebleLane();
  }
  if (((globalThis as any).bassLives ?? 1) <= 0 && ((globalThis as any).trebleLives ?? 1) <= 0 && typeof (globalThis as any).stopGame === 'function') {
    (globalThis as any).stopGame('piano-both-dead');
  }
}

// Bridge functions to connect to main game evaluation
function _activeMelodyTarget(clef: 'bass' | 'treble'): { midi: number, id: string, kind?: 'melody' } | null {
  // Map to the main game's movingNotes array - find first melody target for this clef
  const movingNotes = (globalThis as any).movingNotes;
  if (!movingNotes || !Array.isArray(movingNotes)) return null;
  
  for (const note of movingNotes) {
    if (note.clef === clef && (!note.kind || note.kind === 'melody')) {
      return { midi: note.midiNote, id: note.id || note.note + note.octave, kind: 'melody' };
    }
  }
  return null;
}

function _activeChordTarget(clef: 'bass' | 'treble'): { mids: number[], id: string, kind?: 'chord' } | null {
  // Map to the main game's movingNotes array - find first chord target for this clef
  const movingNotes = (globalThis as any).movingNotes;
  if (!movingNotes || !Array.isArray(movingNotes)) return null;
  
  for (const note of movingNotes) {
    if (note.clef === clef && note.kind === 'chord' && Array.isArray(note.mids)) {
      return { mids: note.mids, id: note.id || 'chord-' + note.mids.join('-'), kind: 'chord' };
    }
  }
  return null;
}

function _success(clef: 'bass' | 'treble', target: any): void {
  // Remove target from movingNotes, play success FX, increment score
  const movingNotes = (globalThis as any).movingNotes;
  if (movingNotes && Array.isArray(movingNotes)) {
    const index = movingNotes.findIndex((note: any) => 
      (note.id && note.id === target.id) || 
      (note.midiNote === target.midi) ||
      (Array.isArray(note.mids) && Array.isArray(target.mids) && 
       note.mids.length === target.mids.length &&
       note.mids.every((mid: number) => target.mids.includes(mid)))
    );
    if (index !== -1) {
      movingNotes.splice(index, 1);
    }
  }
  
  // Play success effects
  if (typeof (globalThis as any).playCorrectSound === 'function') {
    (globalThis as any).playCorrectSound();
  }
  
  // Update score
  (globalThis as any).score = ((globalThis as any).score || 0) + 1;
  (globalThis as any).correctAnswers = ((globalThis as any).correctAnswers || 0) + 1;
  
  // Update displays
  if (typeof (globalThis as any).updateDisplays === 'function') {
    (globalThis as any).updateDisplays();
  }
}

function _fail(clef: 'bass' | 'treble', target: any, why: string): void {
  // Remove target from movingNotes, play fail FX, decrement lives
  const movingNotes = (globalThis as any).movingNotes;
  if (movingNotes && Array.isArray(movingNotes)) {
    const index = movingNotes.findIndex((note: any) => 
      (note.id && note.id === target.id) || 
      (note.midiNote === target.midi) ||
      (Array.isArray(note.mids) && Array.isArray(target.mids) && 
       note.mids.length === target.mids.length &&
       note.mids.every((mid: number) => target.mids.includes(mid)))
    );
    if (index !== -1) {
      movingNotes.splice(index, 1);
    }
  }
  
  _decLife(clef);
  _afterLifeChangeStopIfNeeded();
  
  // Play fail effects
  if (typeof (globalThis as any).playExplosionSound === 'function') {
    (globalThis as any).playExplosionSound();
  }
}

function _modeOf(clef: 'bass' | 'treble'): 'melody' | 'chord' {
  // Read existing piano mode settings for this lane
  // Access global pianoModeSettings if available, otherwise check window properties
  const globalSettings = (globalThis as any).pianoModeSettings || pianoModeSettings;
  
  if (clef === 'bass') {
    const leftHandMode = globalSettings?.leftHand || (globalThis as any).leftHandMode;
    if (leftHandMode === 'chords') return 'chord';
  }
  if (clef === 'treble') {
    const rightHandMode = globalSettings?.rightHand || (globalThis as any).rightHandMode; 
    if (rightHandMode === 'chords') return 'chord';
  }
  
  return 'melody'; // Default to melody so we never no-op
}

// The main dispatcher as specified
function dispatchNoteOn(midi: number, velocity: number): void {
  // If game is paused/not started, early-out only if that is TRUE
  if (!(globalThis as any).gameRunning) return;
  
  if (!_isPianoOn()) return; // Normal Mode already handled by existing code

  const clef = _routeClefByMidi(midi);
  if (!_laneAlive(clef)) return;

  const mode = _modeOf(clef);
  if (mode === 'melody') {
    const t = _activeMelodyTarget(clef);
    if (!t) return;                // nothing to evaluate
    if (midi === t.midi) { _success(clef, t); }
    else { _fail(clef, t, 'melody-wrong'); }
    return;
  }

  // mode === 'chord'
  const chord = _activeChordTarget(clef);
  if (!chord) return;
  const tones = new Set(chord.mids);

  // STRAY in same clef -> immediate fail
  if (!tones.has(midi)) {
    _fail(clef, chord, 'chord-stray');
    __chordHits[clef].clear(); __chordStart[clef] = null;
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
      if (!still || still.id !== chord.id) return;
      if (__chordStart[clef] !== started) return; // already resolved
      if (__chordHits[clef].size < new Set(still.mids).size) {
        _fail(clef, still, 'chord-timeout');
      }
      __chordHits[clef].clear(); __chordStart[clef] = null;
    }, 100);
  }

  __chordHits[clef].add(midi);
  if (__chordHits[clef].size === new Set(chord.mids).size) {
    _success(clef, chord);
    __chordHits[clef].clear(); __chordStart[clef] = null;
  }
}

// Test function for Piano Mode dispatcher (expose globally for testing)
function testMidiDispatch(midi: number, velocity: number = 64): string {
  const beforeTargets = (globalThis as any).movingNotes ? (globalThis as any).movingNotes.length : 0;
  const beforeScore = (globalThis as any).score || 0;
  const beforeBassLives = (globalThis as any).bassLives || 0;
  const beforeTrebleLives = (globalThis as any).trebleLives || 0;
  
  dispatchNoteOn(midi, velocity);
  
  const afterTargets = (globalThis as any).movingNotes ? (globalThis as any).movingNotes.length : 0;
  const afterScore = (globalThis as any).score || 0;
  const afterBassLives = (globalThis as any).bassLives || 0;
  const afterTrebleLives = (globalThis as any).trebleLives || 0;
  
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
let pianoModeSettings: PianoModeSettings = {
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
export function reinitializeMidiAfterRestart(): void {
  console.log('Reinitializing MIDI after game restart...');
  
  // Re-initialize the lane system
  initializeLanes();
  
  // Re-register the note input callback since the game might have reset handlers
  midiManager.clearNoteInputCallbacks();
  
  midiManager.onNoteInput((noteMapping: MidiNoteMapping) => {
    // Visual feedback for MIDI input (FIRST)
    const noteForGame = getNaturalNoteForGame(noteMapping.midiNote);
    highlightMidiInput(noteForGame);
    
    // IMPORTANT: Call the one-at-a-time handler right after key highlighting
    if (typeof (globalThis as any).handleNoteOnOneAtATime === 'function') {
      (globalThis as any).handleNoteOnOneAtATime(noteMapping.midiNote, 64);
    }
    
    // IMPORTANT: CALL THE DISPATCHER right after UI highlight
    dispatchNoteOn(noteMapping.midiNote, 64);
    
    // Legacy support: also call the existing game handlers for compatibility
    // Call the octave-aware game input handler for Piano Mode strict mode support
    if (typeof (window as any).handleNoteInputWithOctave === 'function') {
      (window as any).handleNoteInputWithOctave(noteForGame, noteMapping.octave);
    } else if (typeof (window as any).handleNoteInput === 'function') {
      // Fallback to regular handler if octave-aware version not available
      (window as any).handleNoteInput(noteForGame);
    }
  });
  
  // Update UI to reflect current status
  updateMidiUI();
  
  console.log('MIDI reinitialization complete');
}
export function initializeMidiIntegration(): void {
  // Check if handleNoteInput function exists (from script.js)
  if (typeof (window as any).handleNoteInput !== 'function') {
    console.warn('handleNoteInput function not found. MIDI integration may not work correctly.');
    return;
  }

  // Initialize the lane system
  initializeLanes();

  // Register MIDI input callback to route to game input handler
  midiManager.onNoteInput((noteMapping: MidiNoteMapping) => {
    // Visual feedback for MIDI input (FIRST)
    const noteForGame = getNaturalNoteForGame(noteMapping.midiNote);
    highlightMidiInput(noteForGame);
    
    // IMPORTANT: Call the one-at-a-time handler right after key highlighting
    if (typeof (globalThis as any).handleNoteOnOneAtATime === 'function') {
      (globalThis as any).handleNoteOnOneAtATime(noteMapping.midiNote, 64);
    }
    
    // IMPORTANT: CALL THE DISPATCHER right after UI highlight
    dispatchNoteOn(noteMapping.midiNote, 64);
    
    // Legacy support: only call legacy handlers in Normal Mode to avoid conflicts
    if (!pianoModeSettings.isActive) {
      // Call the octave-aware game input handler for Normal Mode
      if (typeof (window as any).handleNoteInputWithOctave === 'function') {
        (window as any).handleNoteInputWithOctave(noteForGame, noteMapping.octave);
      } else if (typeof (window as any).handleNoteInput === 'function') {
        // Fallback to regular handler if octave-aware version not available
        (window as any).handleNoteInput(noteForGame);
      }
    }
  });

  // Set up device connection monitoring
  midiManager.on('deviceConnected', (device: MidiDevice) => {
    console.log(`MIDI device connected: ${device.name}`);
    
    // Activate Piano Mode when device is connected
    pianoModeSettings.isActive = true;
    (globalThis as any).pianoModeActive = true;
    
    // Initialize per-clef lives when Piano Mode turns ON
    if (_isPianoOn()) {
      if (typeof (globalThis as any).bassLives === 'undefined')   {
        (globalThis as any).bassLives = typeof (globalThis as any).lives === 'number' ? (globalThis as any).lives : 3;
      }
      if (typeof (globalThis as any).trebleLives === 'undefined') {
        (globalThis as any).trebleLives = typeof (globalThis as any).lives === 'number' ? (globalThis as any).lives : 3;
      }
    }
    
    updatePianoModeUI();
    
    updateMidiUI();
    showMidiNotification(`Piano Mode Activated: ${device.name}`, 'success');
  });

  midiManager.on('deviceDisconnected', (device: MidiDevice) => {
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

  midiManager.on('statusChanged', (status: MidiConnectionStatus) => {
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
function highlightMidiInput(note: string): void {
  const button = document.querySelector(`.pitch-btn[data-note="${note}"]`) as HTMLButtonElement;
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
function updateMidiUI(): void {
  const status = midiManager.getStatus();
  const devices = midiManager.getConnectedDevices();
  
  // Update device selector
  const deviceSelector = document.getElementById('midiDeviceSelector') as HTMLSelectElement;
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
    } else if (devices.length === 0) {
      statusIndicator.textContent = 'No MIDI devices';
      statusIndicator.className = 'midi-status warning';
    } else if (status.selectedDeviceId) {
      const selectedDevice = devices.find(d => d.id === status.selectedDeviceId);
      statusIndicator.textContent = `Connected: ${selectedDevice?.name}`;
      statusIndicator.className = 'midi-status success';
    } else {
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
function showMidiNotification(message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info'): void {
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
    notification!.classList.remove('show');
  }, 3000);
}

/**
 * Handle device selection from UI
 */
export function handleDeviceSelection(deviceId: string): void {
  if (deviceId) {
    const success = midiManager.selectDevice(deviceId);
    if (success) {
      const device = midiManager.getSelectedDevice();
      showMidiNotification(`Selected: ${device?.name}`, 'success');
    } else {
      showMidiNotification('Failed to connect to device', 'error');
    }
  }
}

/**
 * Get MIDI connection status for external use
 */
export function getMidiStatus(): MidiConnectionStatus {
  return midiManager.getStatus();
}

/**
 * Get list of connected MIDI devices
 */
export function getConnectedDevices(): MidiDevice[] {
  return midiManager.getConnectedDevices();
}

/**
 * Enable/disable MIDI input
 */
export function setMidiEnabled(enabled: boolean): void {
  midiManager.setEnabled(enabled);
}

/**
 * Load saved MIDI settings from localStorage
 */
function loadSavedMidiSettings(): void {
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
        } else {
          console.log(`Could not restore MIDI device: ${settings.selectedDeviceName} (device not available)`);
          showMidiNotification(`Device not available: ${settings.selectedDeviceName}`, 'warning');
        }
        updateMidiUI();
      }
    } catch (error) {
      console.error('Failed to load MIDI settings:', error);
    }
  }
}

/**
 * Clean up MIDI integration
 */
export function destroyMidiIntegration(): void {
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
function updatePianoModeUI(): void {
  const pianoControls = document.getElementById('pianoModeControls');
  if (pianoControls) {
    // Show piano mode controls when active
    pianoControls.style.display = pianoModeSettings.isActive ? 'block' : 'none';
  }
  
  // Update dropdowns and checkboxes to match current settings
  const leftHandSelect = document.getElementById('leftHandMode') as HTMLSelectElement;
  const rightHandSelect = document.getElementById('rightHandMode') as HTMLSelectElement;
  const grandStaffCheck = document.getElementById('pianoGrandStaffForce') as HTMLInputElement;
  
  if (leftHandSelect) leftHandSelect.value = pianoModeSettings.leftHand || 'none';
  if (rightHandSelect) rightHandSelect.value = pianoModeSettings.rightHand || 'none';
  if (grandStaffCheck) grandStaffCheck.checked = pianoModeSettings.forceGrandStaff;
  
  // Notify the game of Piano Mode changes (but don't cause circular calls)
  if (typeof (window as any).onPianoModeChanged === 'function') {
    (window as any).onPianoModeChanged(pianoModeSettings);
  }
}

/**
 * Get current Piano Mode settings
 */
export function getPianoModeSettings(): PianoModeSettings {
  return { ...pianoModeSettings };
}

/**
 * Update Piano Mode settings
 */
export function updatePianoModeSettings(settings: Partial<PianoModeSettings>): void {
  pianoModeSettings = { ...pianoModeSettings, ...settings };
  updatePianoModeUI();
  
  // Save to localStorage
  localStorage.setItem('pianoModeSettings', JSON.stringify(pianoModeSettings));
  
  // Also update global reference
  (globalThis as any).pianoModeSettings = pianoModeSettings;
}

// Export test function for debugging
export function testMidiDispatcherExternal(midi: number, velocity: number = 64): string {
  return testMidiDispatch(midi, velocity);
}

/**
 * Initialize Piano Mode UI event listeners
 */
function initializePianoModeUI(): void {
  // Load saved Piano Mode settings
  const saved = localStorage.getItem('pianoModeSettings');
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      pianoModeSettings = { ...pianoModeSettings, ...settings };
    } catch (e) {
      console.warn('Could not load Piano Mode settings:', e);
    }
  }
  
  // Set up event listeners for Piano Mode controls
  const leftHandSelect = document.getElementById('leftHandMode') as HTMLSelectElement;
  const rightHandSelect = document.getElementById('rightHandMode') as HTMLSelectElement;
  const grandStaffCheck = document.getElementById('pianoGrandStaffForce') as HTMLInputElement;
  
  if (leftHandSelect) {
    leftHandSelect.addEventListener('change', () => {
      updatePianoModeSettings({ leftHand: leftHandSelect.value as 'none' | 'melody' | 'chords' });
    });
  }
  
  if (rightHandSelect) {
    rightHandSelect.addEventListener('change', () => {
      updatePianoModeSettings({ rightHand: rightHandSelect.value as 'none' | 'melody' | 'chords' });
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
    (globalThis as any).testMidiDispatcher = testMidiDispatch;
    // Make piano mode settings globally accessible
    (globalThis as any).pianoModeSettings = pianoModeSettings;
    // Make noteOn function available for self-test
    (globalThis as any).noteOn = (midi: number, velocity: number = 100) => {
      dispatchNoteOn(midi, velocity);
    };
  });
} else {
  // If document is already loaded, initialize immediately
  initializeMidiIntegration();
  initializePianoModeUI();
  
  // Make test function globally accessible for testing
  (globalThis as any).testMidiDispatcher = testMidiDispatch;
  // Make piano mode settings globally accessible
  (globalThis as any).pianoModeSettings = pianoModeSettings;
  // Make noteOn function available for self-test
  (globalThis as any).noteOn = (midi: number, velocity: number = 100) => {
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