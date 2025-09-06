/**
 * MIDI Integration for Menu Page
 * Handles MIDI device selection in the menu/options
 */
declare global {
    interface Window {
        saveMidiSettings: () => void;
        loadMidiSettings: () => void;
        getMenuMidiStatus: () => MidiConnectionStatus;
    }
}
import { MidiConnectionStatus } from './midi-types.js';
/**
 * Initialize MIDI integration for the menu page
 */
export declare function initializeMenuMidiIntegration(): void;
/**
 * Get MIDI connection status for menu display
 */
export declare function getMenuMidiStatus(): MidiConnectionStatus;
/**
 * Save MIDI settings to localStorage for the game
 */
export declare function saveMidiSettings(): void;
/**
 * Load MIDI settings from localStorage
 */
export declare function loadMidiSettings(): void;
