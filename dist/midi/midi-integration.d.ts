/**
 * MIDI Integration for Note Reading Game
 * Connects the MIDI manager to the existing game input system
 */
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
import { MidiDevice, MidiConnectionStatus, PianoModeSettings } from './midi-types.js';
/**
 * Reinitialize MIDI connections after game restart
 * Call this function when the game restarts to ensure MIDI stays active
 */
export declare function reinitializeMidiAfterRestart(): void;
export declare function initializeMidiIntegration(): void;
/**
 * Handle device selection from UI
 */
export declare function handleDeviceSelection(deviceId: string): void;
/**
 * Get MIDI connection status for external use
 */
export declare function getMidiStatus(): MidiConnectionStatus;
/**
 * Get list of connected MIDI devices
 */
export declare function getConnectedDevices(): MidiDevice[];
/**
 * Enable/disable MIDI input
 */
export declare function setMidiEnabled(enabled: boolean): void;
/**
 * Clean up MIDI integration
 */
export declare function destroyMidiIntegration(): void;
/**
 * Get current Piano Mode settings
 */
export declare function getPianoModeSettings(): PianoModeSettings;
/**
 * Update Piano Mode settings
 */
export declare function updatePianoModeSettings(settings: Partial<PianoModeSettings>): void;
