/**
 * MIDI Integration for Note Reading Game
 * Connects the MIDI manager to the existing game input system
 */
import { midiManager } from './midi-manager.js';
import { getNaturalNoteForGame, getClefForMidiNote } from './midi-utils.js';
// Piano Mode state
let pianoModeSettings = {
    isActive: false,
    chordMode: false,
    forceGrandStaff: true,
    leftHand: 'none',
    rightHand: 'none',
    hardMode: false
};
/**
 * Reinitialize MIDI connections after game restart
 * Call this function when the game restarts to ensure MIDI stays active
 */
export function reinitializeMidiAfterRestart() {
    console.log('Reinitializing MIDI after game restart...');
    // Re-load Piano Mode settings in case they changed
    initializePianoModeUI();
    // Re-register the note input callback since the game might have reset handlers
    midiManager.clearNoteInputCallbacks();
    // Use the existing note processing function to avoid duplication
    registerMidiNoteHandler();
    // Update UI to reflect current status
    updateMidiUI();
    console.log('MIDI reinitialization complete');
}
/**
 * Register the MIDI note input handler with proper hard mode logic
 */
function registerMidiNoteHandler() {
    midiManager.onNoteInput((noteMapping) => {
        // Get the appropriate note for the game based on Piano Mode settings
        const noteForGame = getNaturalNoteForGame(noteMapping.midiNote);
        // In hard mode, determine which clef this MIDI note should affect
        let shouldProcessInput = true;
        let targetClef = null;
        if (pianoModeSettings.isActive && pianoModeSettings.hardMode) {
            targetClef = getClefForMidiNote(noteMapping.midiNote);
            // Only process input if the target clef is active
            const leftHandActive = pianoModeSettings.leftHand !== 'none';
            const rightHandActive = pianoModeSettings.rightHand !== 'none';
            shouldProcessInput = (targetClef === 'bass' && leftHandActive) ||
                (targetClef === 'treble' && rightHandActive);
            console.log(`Hard mode MIDI input: note=${noteForGame}, midi=${noteMapping.midiNote}, targetClef=${targetClef}, leftHand=${pianoModeSettings.leftHand}, rightHand=${pianoModeSettings.rightHand}, shouldProcess=${shouldProcessInput}`);
        }
        if (shouldProcessInput) {
            // Call the octave-aware game input handler for Piano Mode strict mode support
            if (typeof window.handleNoteInputWithOctave === 'function') {
                // Pass the target clef information for hard mode
                if (pianoModeSettings.hardMode && targetClef) {
                    window.handleNoteInputWithOctave(noteForGame, noteMapping.octave, targetClef);
                }
                else {
                    window.handleNoteInputWithOctave(noteForGame, noteMapping.octave);
                }
            }
            else if (typeof window.handleNoteInput === 'function') {
                // Fallback to regular handler if octave-aware version not available
                window.handleNoteInput(noteForGame);
            }
            // Visual feedback for MIDI input
            highlightMidiInput(noteForGame);
        }
        else {
            console.log(`MIDI input filtered out: note=${noteForGame}, midi=${noteMapping.midiNote}, hardMode=${pianoModeSettings.hardMode}`);
        }
    });
}
export function initializeMidiIntegration() {
    // Check if handleNoteInput function exists (from script.js)
    if (typeof window.handleNoteInput !== 'function') {
        console.warn('handleNoteInput function not found. MIDI integration may not work correctly.');
        return;
    }
    // Register MIDI input callback using the consolidated handler
    registerMidiNoteHandler();
    // Set up device connection monitoring
    midiManager.on('deviceConnected', (device) => {
        console.log(`MIDI device connected: ${device.name}`);
        // Activate Piano Mode when device is connected
        pianoModeSettings.isActive = true;
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
    // Piano Mode controls have been removed from the game - settings are now handled in main menu
    // This function is mainly for future UI updates if needed
    console.log('MIDI Piano Mode UI updated with settings:', pianoModeSettings);
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
    console.log('Updating MIDI Piano Mode settings:', settings);
    // Handle both MIDI settings format and menu settings format
    const updatedSettings = {};
    // Map menu format to MIDI format if needed
    if ('active' in settings) {
        updatedSettings.isActive = settings.active;
    }
    if ('isActive' in settings) {
        updatedSettings.isActive = settings.isActive;
    }
    if ('leftHand' in settings) {
        updatedSettings.leftHand = settings.leftHand;
    }
    if ('rightHand' in settings) {
        updatedSettings.rightHand = settings.rightHand;
    }
    if ('hardMode' in settings) {
        updatedSettings.hardMode = settings.hardMode;
    }
    if ('chordMode' in settings) {
        updatedSettings.chordMode = settings.chordMode;
    }
    if ('forceGrandStaff' in settings) {
        updatedSettings.forceGrandStaff = settings.forceGrandStaff;
    }
    pianoModeSettings = { ...pianoModeSettings, ...updatedSettings };
    updatePianoModeUI();
    // Save to localStorage (both formats for compatibility)
    localStorage.setItem('pianoModeSettings', JSON.stringify(pianoModeSettings));
    // Log the updated settings for debugging
    console.log('Updated MIDI Piano Mode settings:', pianoModeSettings);
}
/**
 * Initialize Piano Mode UI event listeners
 */
function initializePianoModeUI() {
    // Load saved Piano Mode settings from menu
    const saved = localStorage.getItem('noteGameSettings');
    if (saved) {
        try {
            const gameSettings = JSON.parse(saved);
            if (gameSettings.pianoMode) {
                // Map menu settings to MIDI integration settings
                const menuSettings = gameSettings.pianoMode;
                pianoModeSettings = {
                    isActive: menuSettings.active || false,
                    chordMode: false, // Keep existing default
                    forceGrandStaff: true, // Keep existing default
                    leftHand: menuSettings.leftHand || 'none',
                    rightHand: menuSettings.rightHand || 'none',
                    hardMode: menuSettings.hardMode || false
                };
                console.log('Loaded Piano Mode settings from menu:', pianoModeSettings);
            }
        }
        catch (e) {
            console.warn('Could not load Piano Mode settings from menu:', e);
        }
    }
    // Also try loading from the dedicated pianoModeSettings key for backwards compatibility
    const dedicatedSaved = localStorage.getItem('pianoModeSettings');
    if (dedicatedSaved) {
        try {
            const settings = JSON.parse(dedicatedSaved);
            pianoModeSettings = { ...pianoModeSettings, ...settings };
            console.log('Updated Piano Mode settings with dedicated storage:', pianoModeSettings);
        }
        catch (e) {
            console.warn('Could not load dedicated Piano Mode settings:', e);
        }
    }
    // Piano Mode controls have been removed from the game - settings are now handled in main menu
    // Just update the UI state without trying to attach event listeners
    updatePianoModeUI();
}
// Auto-initialize when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Load Piano Mode settings first
        initializePianoModeUI();
        // Then initialize MIDI integration
        initializeMidiIntegration();
    });
}
else {
    // If document is already loaded, initialize immediately
    // Load Piano Mode settings first
    initializePianoModeUI();
    // Then initialize MIDI integration
    initializeMidiIntegration();
}
// Expose functions globally for integration with existing game code
window.handleDeviceSelection = handleDeviceSelection;
window.isPianoModeActive = () => pianoModeSettings.isActive;
window.getPianoModeSettings = getPianoModeSettings;
window.getMenuMidiStatus = () => midiManager.getStatus();
window.reinitializeMidiAfterRestart = reinitializeMidiAfterRestart;
window.updateMidiPianoModeSettings = updatePianoModeSettings;
//# sourceMappingURL=midi-integration.js.map