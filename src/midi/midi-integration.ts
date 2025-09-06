/**
 * MIDI Integration for Note Reading Game
 * Connects the MIDI manager to the existing game input system
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
  
  // Re-register the note input callback since the game might have reset handlers
  midiManager.clearNoteInputCallbacks();
  
  midiManager.onNoteInput((noteMapping: MidiNoteMapping) => {
    // Get the appropriate note for the game based on Piano Mode settings
    const noteForGame = getNaturalNoteForGame(noteMapping.midiNote);
    
    // Call the octave-aware game input handler for Piano Mode strict mode support
    if (typeof (window as any).handleNoteInputWithOctave === 'function') {
      (window as any).handleNoteInputWithOctave(noteForGame, noteMapping.octave);
    } else if (typeof (window as any).handleNoteInput === 'function') {
      // Fallback to regular handler if octave-aware version not available
      (window as any).handleNoteInput(noteForGame);
    }
    
    // Visual feedback for MIDI input
    highlightMidiInput(noteForGame);
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

  // Register MIDI input callback to route to game input handler
  midiManager.onNoteInput((noteMapping: MidiNoteMapping) => {
    // Get the appropriate note for the game based on Piano Mode settings
    const noteForGame = getNaturalNoteForGame(noteMapping.midiNote);
    
    // Call the octave-aware game input handler for Piano Mode strict mode support
    if (typeof (window as any).handleNoteInputWithOctave === 'function') {
      (window as any).handleNoteInputWithOctave(noteForGame, noteMapping.octave);
    } else if (typeof (window as any).handleNoteInput === 'function') {
      // Fallback to regular handler if octave-aware version not available
      (window as any).handleNoteInput(noteForGame);
    }
    
    // Visual feedback for MIDI input
    highlightMidiInput(noteForGame);
  });

  // Set up device connection monitoring
  midiManager.on('deviceConnected', (device: MidiDevice) => {
    console.log(`MIDI device connected: ${device.name}`);
    
    // Activate Piano Mode when device is connected
    pianoModeSettings.isActive = true;
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
  });
} else {
  // If document is already loaded, initialize immediately
  initializeMidiIntegration();
  initializePianoModeUI();
}

// Expose functions globally for integration with existing game code
window.handleDeviceSelection = handleDeviceSelection;
window.isPianoModeActive = () => pianoModeSettings.isActive;
window.getPianoModeSettings = getPianoModeSettings;
window.getMenuMidiStatus = () => midiManager.getStatus();
window.reinitializeMidiAfterRestart = reinitializeMidiAfterRestart;