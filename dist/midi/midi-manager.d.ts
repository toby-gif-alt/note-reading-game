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
import { MidiDevice, MidiConnectionStatus, MidiInputCallback, MidiManagerEvents } from './midi-types.js';
export declare class MidiManager {
    private midiAccess;
    private connectedDevices;
    private selectedDeviceId;
    private inputCallbacks;
    private eventListeners;
    constructor();
    /**
     * Initialize Web MIDI API and set up device monitoring
     */
    private initializeMidi;
    /**
     * Set up monitoring for device connection/disconnection events
     */
    private setupDeviceMonitoring;
    /**
     * Scan for currently connected MIDI input devices
     */
    private scanForDevices;
    /**
     * Add a newly connected MIDI device (public for testing)
     */
    addDevice(input: MIDIInput): void;
    /**
     * Check if a MIDI device should be filtered out (phantom/unwanted devices)
     */
    private shouldFilterDevice;
    /**
     * Add a newly connected MIDI device (internal implementation)
     */
    private addDeviceInternal;
    /**
     * Select the best available MIDI device (prioritize non-filtered devices)
     */
    private selectBestAvailableDevice;
    /**
     * Remove a disconnected MIDI device
     */
    private removeDevice;
    /**
     * Select a MIDI device for input
     */
    selectDevice(deviceId: string): boolean;
    /**
     * Disconnect from a MIDI device
     */
    private disconnectDevice;
    /**
     * Handle incoming MIDI messages
     */
    private handleMidiMessage;
    /**
     * Convert MIDI note number to musical note mapping
     * Uses utility function for consistent conversion
     */
    private midiNoteToMapping;
    /**
     * Register a callback for MIDI note input
     */
    onNoteInput(callback: MidiInputCallback): void;
    /**
     * Remove a note input callback
     */
    removeNoteInputCallback(callback: MidiInputCallback): void;
    /**
     * Clear all note input callbacks
     */
    clearNoteInputCallbacks(): void;
    /**
     * Register an event listener
     */
    on<T extends keyof MidiManagerEvents>(event: T, listener: MidiManagerEvents[T]): void;
    /**
     * Emit an event to all registered listeners
     */
    private emit;
    /**
     * Emit status change event
     */
    private emitStatusChange;
    /**
     * Get current connection status
     */
    getStatus(): MidiConnectionStatus;
    /**
     * Get list of connected devices
     */
    getConnectedDevices(): MidiDevice[];
    /**
     * Get currently selected device
     */
    getSelectedDevice(): MidiDevice | null;
    /**
     * Enable/disable MIDI input
     */
    setEnabled(enabled: boolean): void;
    /**
     * Clean up MIDI connections and resources
     */
    destroy(): void;
}
export declare const midiManager: MidiManager;
