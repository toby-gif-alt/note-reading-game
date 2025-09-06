/**
 * MIDI Integration for Menu Page
 * Handles MIDI device selection in the menu/options
 */
import { midiManager } from './midi-manager.js';
/**
 * Initialize MIDI integration for the menu page
 */
export function initializeMenuMidiIntegration() {
    console.log('Initializing MIDI integration for menu...');
    // Set up device connection monitoring
    midiManager.on('deviceConnected', (device) => {
        console.log(`MIDI device connected in menu: ${device.name}`);
        updateMenuMidiUI();
    });
    midiManager.on('deviceDisconnected', (device) => {
        console.log(`MIDI device disconnected in menu: ${device.name}`);
        updateMenuMidiUI();
    });
    midiManager.on('statusChanged', (status) => {
        updateMenuMidiUI();
    });
    // Set up device selector event listener
    const deviceSelector = document.getElementById('midiDeviceMenuSelector');
    if (deviceSelector) {
        deviceSelector.addEventListener('change', function () {
            if (this.value) {
                const success = midiManager.selectDevice(this.value);
                if (success) {
                    const device = midiManager.getSelectedDevice();
                    console.log(`Selected MIDI device: ${device?.name}`);
                }
                else {
                    console.error('Failed to connect to MIDI device');
                }
            }
        });
    }
    // Initialize UI after a delay to allow initial device scan
    setTimeout(updateMenuMidiUI, 1000);
}
/**
 * Update the MIDI UI elements in the menu
 */
function updateMenuMidiUI() {
    const status = midiManager.getStatus();
    const devices = midiManager.getConnectedDevices();
    // Update device selector
    const deviceSelector = document.getElementById('midiDeviceMenuSelector');
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
    const statusIndicator = document.getElementById('midiStatusMenu');
    if (statusIndicator) {
        if (!status.isSupported) {
            statusIndicator.textContent = 'MIDI not supported in this browser';
            statusIndicator.className = 'midi-status-menu error';
        }
        else if (devices.length === 0) {
            statusIndicator.textContent = 'No MIDI devices detected';
            statusIndicator.className = 'midi-status-menu warning';
        }
        else if (status.selectedDeviceId) {
            const selectedDevice = devices.find(d => d.id === status.selectedDeviceId);
            statusIndicator.textContent = `Connected: ${selectedDevice?.name}`;
            statusIndicator.className = 'midi-status-menu success';
        }
        else {
            statusIndicator.textContent = `${devices.length} MIDI device${devices.length !== 1 ? 's' : ''} available`;
            statusIndicator.className = 'midi-status-menu info';
        }
    }
}
/**
 * Get MIDI connection status for menu display
 */
export function getMenuMidiStatus() {
    return midiManager.getStatus();
}
/**
 * Save MIDI settings to localStorage for the game
 */
export function saveMidiSettings() {
    const status = midiManager.getStatus();
    const selectedDevice = midiManager.getSelectedDevice();
    const midiSettings = {
        enabled: !!status.selectedDeviceId,
        selectedDeviceId: status.selectedDeviceId || null,
        selectedDeviceName: selectedDevice?.name || null
    };
    localStorage.setItem('noteGameMidiSettings', JSON.stringify(midiSettings));
    console.log('MIDI settings saved:', midiSettings);
}
/**
 * Load MIDI settings from localStorage
 */
export function loadMidiSettings() {
    const saved = localStorage.getItem('noteGameMidiSettings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            console.log('Loaded MIDI settings:', settings);
            // If there was a previously selected device, try to select it again
            if (settings.selectedDeviceId) {
                setTimeout(() => {
                    const success = midiManager.selectDevice(settings.selectedDeviceId);
                    if (success) {
                        console.log(`Restored MIDI device: ${settings.selectedDeviceName}`);
                    }
                    else {
                        console.log(`Could not restore MIDI device: ${settings.selectedDeviceName} (device not available)`);
                    }
                    updateMenuMidiUI();
                }, 1500);
            }
        }
        catch (error) {
            console.error('Failed to load MIDI settings:', error);
        }
    }
}
// Auto-initialize when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeMenuMidiIntegration();
        loadMidiSettings();
    });
}
else {
    // If document is already loaded, initialize immediately
    initializeMenuMidiIntegration();
    loadMidiSettings();
}
// Expose functions globally for integration with menu.js
window.saveMidiSettings = saveMidiSettings;
window.loadMidiSettings = loadMidiSettings;
window.getMenuMidiStatus = getMenuMidiStatus;
//# sourceMappingURL=midi-menu-integration.js.map