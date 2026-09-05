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
import { midiNoteToMapping, isNaturalNote } from './midi-utils.js';
export class MidiManager {
    constructor() {
        this.midiAccess = null;
        this.connectedDevices = new Map();
        this.selectedDeviceId = null;
        this.inputCallbacks = [];
        this.eventListeners = new Map();
        this.initializeMidi();
    }
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
    setupDeviceMonitoring() {
        if (!this.midiAccess)
            return;
        this.midiAccess.onstatechange = (event) => {
            const port = event.port;
            if (port && port.type === 'input') {
                if (port.state === 'connected') this.addDeviceInternal(port);
                else if (port.state === 'disconnected') this.removeDevice(port.id);
            }
        };
    }
    scanForDevices() {
        if (!this.midiAccess)
            return;
        this.midiAccess.inputs.forEach((input) => {
            if (input.state === 'connected') this.addDeviceInternal(input);
        });
    }
    addDevice(input) {
        this.addDeviceInternal(input);
    }
    shouldFilterDevice(input) {
        const name = (input.name || '').toLowerCase();
        const manufacturer = (input.manufacturer || '').toLowerCase();
        const isAndroid = /android/i.test(navigator.userAgent);
        if (isAndroid) {
            const androidUnwantedPatterns = [
                'through port-0', 'midi through port-0', 'through port', 'midi through',
                'through', 'unknown', 'loopback', 'virtual', 'software', 'thru',
                'system', 'default', 'android', 'port', 'client', 'seq'
            ];
            for (const pattern of androidUnwantedPatterns) {
                if (name.includes(pattern) || manufacturer.includes(pattern)) {
                    console.log(`Filtering out Android phantom MIDI device: ${input.name} (${input.manufacturer})`);
                    return true;
                }
            }
            const hasRealManufacturer = manufacturer && manufacturer !== 'unknown' && manufacturer !== '' && manufacturer !== 'android' && manufacturer !== 'linux';
            const hasRealName = name && name !== 'unknown' && name !== '' && name !== 'midi' && name !== 'input' && name !== 'output';
            if (!hasRealManufacturer || !hasRealName) {
                console.log(`Filtering out Android phantom MIDI device (no real name/manufacturer): ${input.name} (${input.manufacturer})`);
                return true;
            }
        }
        else {
            const unwantedPatterns = [
                'through port-0', 'midi through port-0', 'through port', 'midi through',
                'through', 'unknown', 'loopback', 'virtual', 'software', 'thru'
            ];
            for (const pattern of unwantedPatterns) {
                if (name.includes(pattern) || manufacturer.includes(pattern)) {
                    let totalInputs = 0;
                    if (this.midiAccess) this.midiAccess.inputs.forEach(() => totalInputs++);
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
    addDeviceInternal(input) {
        if (this.shouldFilterDevice(input)) return;
        const device = {
            id: input.id,
            name: input.name || 'Unknown MIDI Device',
            manufacturer: input.manufacturer || 'Unknown',
            state: input.state,
            connection: input.connection
        };
        this.connectedDevices.set(device.id, device);
        if (!this.selectedDeviceId) this.selectBestAvailableDevice();
        this.emit('deviceConnected', device);
        this.emitStatusChange();
        console.log(`MIDI device connected: ${device.name}`);
    }
    selectBestAvailableDevice() {
        if (this.connectedDevices.size === 0) return;
        const deviceIds = Array.from(this.connectedDevices.keys());
        if (deviceIds.length === 1) {
            this.selectDevice(deviceIds[0]);
            return;
        }
        const preferredDevice = deviceIds.find(deviceId => {
            const device = this.connectedDevices.get(deviceId);
            if (!device) return false;
            const name = device.name.toLowerCase();
            return name.includes('keyboard') || name.includes('piano') || name.includes('casio') ||
                name.includes('yamaha') || name.includes('roland') || name.includes('korg') ||
                (!name.includes('through') && !name.includes('unknown'));
        });
        this.selectDevice(preferredDevice || deviceIds[0]);
    }
    removeDevice(deviceId) {
        const device = this.connectedDevices.get(deviceId);
        if (!device) return;
        this.connectedDevices.delete(deviceId);
        if (this.selectedDeviceId === deviceId) {
            this.selectedDeviceId = null;
            this.selectBestAvailableDevice();
        }
        this.emit('deviceDisconnected', device);
        this.emitStatusChange();
        console.log(`MIDI device disconnected: ${device.name}`);
    }
    selectDevice(deviceId) {
        if (!this.midiAccess || !this.connectedDevices.has(deviceId)) return false;
        if (this.selectedDeviceId) this.disconnectDevice(this.selectedDeviceId);
        let input;
        this.midiAccess.inputs.forEach((inp) => {
            if (inp.id === deviceId) input = inp;
        });
        if (!input) return false;
        try {
            input.onmidimessage = (event) => this.handleMidiMessage(event);
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
    disconnectDevice(deviceId) {
        if (!this.midiAccess) return;
        let input;
        this.midiAccess.inputs.forEach((inp) => {
            if (inp.id === deviceId) input = inp;
        });
        if (input) input.onmidimessage = null;
    }
    handleMidiMessage(event) {
        if (!event.data || event.data.length < 3) return;
        const [status, note, velocity] = Array.from(event.data);
        const channel = status & 0x0F;
        const messageType = status & 0xF0;
        if (messageType === 0x90 && velocity > 0) {
            // Stave Wars currently teaches natural notes only. A black piano key must
            // never be silently converted into a neighbouring white key, because that
            // would reward an incorrect pitch. Accidentals can be supported explicitly
            // later when they are displayed in the notation.
            if (!isNaturalNote(note)) return;
            const midiNote = { note, velocity, channel, timestamp: event.timeStamp };
            const mapping = this.midiNoteToMapping(note);
            this.emit('noteOn', midiNote, mapping);
            this.inputCallbacks.forEach(callback => callback(mapping));
        }
        else if ((messageType === 0x90 && velocity === 0) || messageType === 0x80) {
            if (!isNaturalNote(note)) return;
            const midiNote = { note, velocity: 0, channel, timestamp: event.timeStamp };
            const mapping = this.midiNoteToMapping(note);
            this.emit('noteOff', midiNote, mapping);
        }
    }
    midiNoteToMapping(midiNote) {
        return midiNoteToMapping(midiNote);
    }
    onNoteInput(callback) {
        this.inputCallbacks.push(callback);
    }
    removeNoteInputCallback(callback) {
        const index = this.inputCallbacks.indexOf(callback);
        if (index > -1) this.inputCallbacks.splice(index, 1);
    }
    clearNoteInputCallbacks() {
        this.inputCallbacks = [];
    }
    on(event, listener) {
        if (!this.eventListeners.has(event)) this.eventListeners.set(event, []);
        this.eventListeners.get(event).push(listener);
    }
    emit(event, ...args) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(listener => {
                try { listener(...args); }
                catch (error) { console.error(`Error in MIDI event listener for ${event}:`, error); }
            });
        }
    }
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
    getStatus() {
        return {
            isSupported: !!navigator.requestMIDIAccess,
            isEnabled: !!this.midiAccess,
            selectedDeviceId: this.selectedDeviceId || undefined,
            connectedDevices: Array.from(this.connectedDevices.values())
        };
    }
    getConnectedDevices() {
        return Array.from(this.connectedDevices.values());
    }
    getSelectedDevice() {
        if (!this.selectedDeviceId) return null;
        return this.connectedDevices.get(this.selectedDeviceId) || null;
    }
    setEnabled(enabled) {
        if (enabled && !this.midiAccess) this.initializeMidi();
        else if (!enabled && this.selectedDeviceId) {
            this.disconnectDevice(this.selectedDeviceId);
            this.selectedDeviceId = null;
        }
        this.emitStatusChange();
    }
    destroy() {
        if (this.selectedDeviceId) this.disconnectDevice(this.selectedDeviceId);
        this.connectedDevices.clear();
        this.inputCallbacks = [];
        this.eventListeners.clear();
        this.midiAccess = null;
        this.selectedDeviceId = null;
    }
}
export const midiManager = new MidiManager();
