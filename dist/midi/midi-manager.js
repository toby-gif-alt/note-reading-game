/**
 * MIDI Manager for Note Reading Game
 * Handles Web MIDI API integration, device management, and note input processing
 *
 * Features:
 * - Automatic MIDI device detection and connection
 * - MIDI note to musical note conversion
 * - Event-based architecture for easy integration
 * - Error handling and fallback support
 */
import { midiNoteToMapping, getClosestNaturalNote } from './midi-utils.js';
export class MidiManager {
    constructor() {
        this.midiAccess = null;
        this.connectedDevices = new Map();
        this.selectedDeviceId = null;
        this.inputCallbacks = [];
        this.eventListeners = new Map();
        this.initializeMidi();
    }
    /**
     * Initialize Web MIDI API and set up device monitoring
     */
    async initializeMidi() {
        try {
            if (!navigator.requestMIDIAccess) {
                console.warn('Web MIDI API not supported in this browser');
                return;
            }
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            this.setupDeviceMonitoring();
            this.scanForDevices();
            console.log('MIDI system initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize MIDI:', error);
            this.emitStatusChange({ lastError: `MIDI initialization failed: ${error.message}` });
        }
    }
    /**
     * Set up monitoring for device connection/disconnection events
     */
    setupDeviceMonitoring() {
        if (!this.midiAccess)
            return;
        this.midiAccess.onstatechange = (event) => {
            const port = event.port;
            if (port && port.type === 'input') {
                if (port.state === 'connected') {
                    this.addDeviceInternal(port);
                }
                else if (port.state === 'disconnected') {
                    this.removeDevice(port.id);
                }
            }
        };
    }
    /**
     * Scan for currently connected MIDI input devices
     */
    scanForDevices() {
        if (!this.midiAccess)
            return;
        this.midiAccess.inputs.forEach((input) => {
            if (input.state === 'connected') {
                this.addDeviceInternal(input);
            }
        });
    }
    /**
     * Add a newly connected MIDI device (public for testing)
     */
    addDevice(input) {
        this.addDeviceInternal(input);
    }
    /**
     * Check if a MIDI device should be filtered out (phantom/unwanted devices)
     */
    shouldFilterDevice(input) {
        const name = (input.name || '').toLowerCase();
        const manufacturer = (input.manufacturer || '').toLowerCase();
        // Enhanced Android device detection - filter out common Android phantom devices
        const isAndroid = /android/i.test(navigator.userAgent);
        if (isAndroid) {
            // On Android, be very aggressive about filtering phantom devices
            // Only allow devices that clearly have manufacturer info and meaningful names
            // First check for common phantom device patterns
            const androidUnwantedPatterns = [
                'through port-0',
                'midi through port-0',
                'through port',
                'midi through',
                'through',
                'unknown',
                'loopback',
                'virtual',
                'software',
                'thru',
                'system',
                'default',
                'android', // Generic Android MIDI devices
                'port', // Generic port names
                'client', // ALSA client names
                'seq' // ALSA sequencer
            ];
            // Check if device name or manufacturer contains unwanted patterns
            for (const pattern of androidUnwantedPatterns) {
                if (name.includes(pattern) || manufacturer.includes(pattern)) {
                    console.log(`Filtering out Android phantom MIDI device: ${input.name} (${input.manufacturer})`);
                    return true;
                }
            }
            // On Android, be very strict - require both meaningful name AND manufacturer  
            // Unless it's a clearly branded device
            const hasRealManufacturer = manufacturer &&
                manufacturer !== 'unknown' &&
                manufacturer !== '' &&
                manufacturer !== 'android' &&
                manufacturer !== 'linux';
            const hasRealName = name &&
                name !== 'unknown' &&
                name !== '' &&
                name !== 'midi' &&
                name !== 'input' &&
                name !== 'output';
            // If it doesn't have both a real manufacturer and real name, it's likely phantom
            if (!hasRealManufacturer || !hasRealName) {
                console.log(`Filtering out Android phantom MIDI device (no real name/manufacturer): ${input.name} (${input.manufacturer})`);
                return true;
            }
        }
        else {
            // Filter out common phantom/unwanted MIDI devices for other platforms
            // Enhanced filtering to specifically exclude "MIDI Through port-0" (Chromebook bug)
            const unwantedPatterns = [
                'through port-0', // Specific Chromebook MIDI through port
                'midi through port-0', // Alternative naming  
                'through port',
                'midi through',
                'through',
                'unknown',
                'loopback',
                'virtual',
                'software',
                'thru'
            ];
            // Check if device name or manufacturer contains unwanted patterns
            for (const pattern of unwantedPatterns) {
                if (name.includes(pattern) || manufacturer.includes(pattern)) {
                    // Additional check: if it's the only available device, allow it
                    // Count total MIDI inputs
                    let totalInputs = 0;
                    if (this.midiAccess) {
                        this.midiAccess.inputs.forEach(() => totalInputs++);
                    }
                    if (totalInputs <= 1) {
                        console.log(`Allowing filtered device '${input.name}' as it's the only available device`);
                        return false;
                    }
                    console.log(`Filtering out unwanted MIDI device: ${input.name} (${input.manufacturer})`);
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * Add a newly connected MIDI device (internal implementation)
     */
    addDeviceInternal(input) {
        // Filter out unwanted devices
        if (this.shouldFilterDevice(input)) {
            return;
        }
        const device = {
            id: input.id,
            name: input.name || 'Unknown MIDI Device',
            manufacturer: input.manufacturer || 'Unknown',
            state: input.state,
            connection: input.connection
        };
        this.connectedDevices.set(device.id, device);
        // Auto-select first device if none selected, but prefer non-filtered devices
        if (!this.selectedDeviceId) {
            this.selectBestAvailableDevice();
        }
        this.emit('deviceConnected', device);
        this.emitStatusChange();
        console.log(`MIDI device connected: ${device.name}`);
    }
    /**
     * Select the best available MIDI device (prioritize non-filtered devices)
     */
    selectBestAvailableDevice() {
        if (this.connectedDevices.size === 0)
            return;
        // Get all device IDs
        const deviceIds = Array.from(this.connectedDevices.keys());
        // If only one device, select it
        if (deviceIds.length === 1) {
            this.selectDevice(deviceIds[0]);
            return;
        }
        // If multiple devices, prefer the first one that looks like a real keyboard
        const preferredDevice = deviceIds.find(deviceId => {
            const device = this.connectedDevices.get(deviceId);
            if (!device)
                return false;
            const name = device.name.toLowerCase();
            // Look for common keyboard/piano keywords
            return name.includes('keyboard') ||
                name.includes('piano') ||
                name.includes('casio') ||
                name.includes('yamaha') ||
                name.includes('roland') ||
                name.includes('korg') ||
                (!name.includes('through') && !name.includes('unknown'));
        });
        // Select preferred device or fall back to first device
        this.selectDevice(preferredDevice || deviceIds[0]);
    }
    /**
     * Remove a disconnected MIDI device
     */
    removeDevice(deviceId) {
        const device = this.connectedDevices.get(deviceId);
        if (!device)
            return;
        this.connectedDevices.delete(deviceId);
        // If selected device was removed, try to select another one
        if (this.selectedDeviceId === deviceId) {
            this.selectedDeviceId = null;
            // Auto-select next best device if available
            this.selectBestAvailableDevice();
        }
        this.emit('deviceDisconnected', device);
        this.emitStatusChange();
        console.log(`MIDI device disconnected: ${device.name}`);
    }
    /**
     * Select a MIDI device for input
     */
    selectDevice(deviceId) {
        if (!this.midiAccess || !this.connectedDevices.has(deviceId)) {
            return false;
        }
        // Disconnect previous device
        if (this.selectedDeviceId) {
            this.disconnectDevice(this.selectedDeviceId);
        }
        let input;
        this.midiAccess.inputs.forEach((inp) => {
            if (inp.id === deviceId) {
                input = inp;
            }
        });
        if (!input)
            return false;
        try {
            input.onmidimessage = (event) => {
                this.handleMidiMessage(event);
            };
            this.selectedDeviceId = deviceId;
            this.emitStatusChange();
            console.log(`Selected MIDI device: ${this.connectedDevices.get(deviceId)?.name}`);
            return true;
        }
        catch (error) {
            console.error('Failed to connect to MIDI device:', error);
            return false;
        }
    }
    /**
     * Disconnect from a MIDI device
     */
    disconnectDevice(deviceId) {
        if (!this.midiAccess)
            return;
        let input;
        this.midiAccess.inputs.forEach((inp) => {
            if (inp.id === deviceId) {
                input = inp;
            }
        });
        if (input) {
            input.onmidimessage = null;
        }
    }
    /**
     * Handle incoming MIDI messages
     */
    handleMidiMessage(event) {
        if (!event.data || event.data.length < 3)
            return;
        const [status, note, velocity] = Array.from(event.data);
        const channel = status & 0x0F;
        const messageType = status & 0xF0;
        // Only handle note-on messages with velocity > 0
        if (messageType === 0x90 && velocity > 0) {
            const midiNote = {
                note,
                velocity,
                channel,
                timestamp: event.timeStamp
            };
            const mapping = this.midiNoteToMapping(note);
            // Emit events
            this.emit('noteOn', midiNote, mapping);
            // Call registered callbacks
            this.inputCallbacks.forEach(callback => callback(mapping));
        }
        // Handle note-off messages (note-on with velocity 0 or explicit note-off)
        else if ((messageType === 0x90 && velocity === 0) || messageType === 0x80) {
            const midiNote = {
                note,
                velocity: 0,
                channel,
                timestamp: event.timeStamp
            };
            const mapping = this.midiNoteToMapping(note);
            this.emit('noteOff', midiNote, mapping);
        }
    }
    /**
     * Convert MIDI note number to musical note mapping
     * Uses utility function for consistent conversion
     */
    midiNoteToMapping(midiNote) {
        // Get closest natural note for the game (no sharps/flats)
        const naturalMidiNote = getClosestNaturalNote(midiNote);
        return midiNoteToMapping(naturalMidiNote);
    }
    /**
     * Register a callback for MIDI note input
     */
    onNoteInput(callback) {
        this.inputCallbacks.push(callback);
    }
    /**
     * Remove a note input callback
     */
    removeNoteInputCallback(callback) {
        const index = this.inputCallbacks.indexOf(callback);
        if (index > -1) {
            this.inputCallbacks.splice(index, 1);
        }
    }
    /**
     * Clear all note input callbacks
     */
    clearNoteInputCallbacks() {
        this.inputCallbacks = [];
    }
    /**
     * Register an event listener
     */
    on(event, listener) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(listener);
    }
    /**
     * Emit an event to all registered listeners
     */
    emit(event, ...args) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(...args);
                }
                catch (error) {
                    console.error(`Error in MIDI event listener for ${event}:`, error);
                }
            });
        }
    }
    /**
     * Emit status change event
     */
    emitStatusChange(additionalProps = {}) {
        const status = {
            isSupported: !!navigator.requestMIDIAccess,
            isEnabled: !!this.midiAccess,
            selectedDeviceId: this.selectedDeviceId || undefined,
            connectedDevices: Array.from(this.connectedDevices.values()),
            ...additionalProps
        };
        this.emit('statusChanged', status);
    }
    /**
     * Get current connection status
     */
    getStatus() {
        return {
            isSupported: !!navigator.requestMIDIAccess,
            isEnabled: !!this.midiAccess,
            selectedDeviceId: this.selectedDeviceId || undefined,
            connectedDevices: Array.from(this.connectedDevices.values())
        };
    }
    /**
     * Get list of connected devices
     */
    getConnectedDevices() {
        return Array.from(this.connectedDevices.values());
    }
    /**
     * Get currently selected device
     */
    getSelectedDevice() {
        if (!this.selectedDeviceId)
            return null;
        return this.connectedDevices.get(this.selectedDeviceId) || null;
    }
    /**
     * Enable/disable MIDI input
     */
    setEnabled(enabled) {
        if (enabled && !this.midiAccess) {
            this.initializeMidi();
        }
        else if (!enabled && this.selectedDeviceId) {
            this.disconnectDevice(this.selectedDeviceId);
            this.selectedDeviceId = null;
        }
        this.emitStatusChange();
    }
    /**
     * Clean up MIDI connections and resources
     */
    destroy() {
        if (this.selectedDeviceId) {
            this.disconnectDevice(this.selectedDeviceId);
        }
        this.connectedDevices.clear();
        this.inputCallbacks = [];
        this.eventListeners.clear();
        this.midiAccess = null;
        this.selectedDeviceId = null;
    }
}
// Export singleton instance for easy use across the application
export const midiManager = new MidiManager();
//# sourceMappingURL=midi-manager.js.map