/**
 * TypeScript type definitions for MIDI functionality
 * Provides type safety for Web MIDI API integration in the note reading game
 */
export interface MidiDevice {
    id: string;
    name: string;
    manufacturer: string;
    state: 'connected' | 'disconnected';
    connection: 'open' | 'closed' | 'pending';
}
export interface MidiNote {
    note: number;
    velocity: number;
    channel: number;
    timestamp: number;
}
export interface MidiNoteMapping {
    midiNote: number;
    noteName: string;
    octave: number;
    scientific: string;
}
export interface PianoModeSettings {
    isActive: boolean;
    chordMode: boolean;
    forceGrandStaff: boolean;
    leftHand?: 'none' | 'melody' | 'chords';
    rightHand?: 'none' | 'melody' | 'chords';
}
export interface MidiConnectionStatus {
    isSupported: boolean;
    isEnabled: boolean;
    selectedDeviceId?: string;
    connectedDevices: MidiDevice[];
    lastError?: string;
    pianoMode?: PianoModeSettings;
}
export type MidiInputCallback = (noteMapping: MidiNoteMapping) => void;
export interface MidiManagerEvents {
    'deviceConnected': (device: MidiDevice) => void;
    'deviceDisconnected': (device: MidiDevice) => void;
    'noteOn': (note: MidiNote, mapping: MidiNoteMapping) => void;
    'noteOff': (note: MidiNote, mapping: MidiNoteMapping) => void;
    'statusChanged': (status: MidiConnectionStatus) => void;
    'pianoModeChanged': (settings: PianoModeSettings) => void;
}
