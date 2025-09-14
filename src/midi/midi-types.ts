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
  note: number;        // MIDI note number (0-127)
  velocity: number;    // Note velocity (0-127) 
  channel: number;     // MIDI channel (0-15)
  timestamp: number;   // High-resolution timestamp
}

export interface MidiNoteMapping {
  midiNote: number;
  noteName: string;    // A, B, C, D, E, F, G
  octave: number;      // Octave number
  scientific: string;  // Scientific notation (e.g., "C4")
}

export interface PianoModeSettings {
  isActive: boolean;
  chordMode: boolean;      // Allow multiple simultaneous notes
  forceGrandStaff: boolean;    // Always show grand staff when active
  leftHand?: 'none' | 'melody' | 'chords';   // Left hand mode (bass clef)
  rightHand?: 'none' | 'melody' | 'chords';  // Right hand mode (treble clef)
  hardMode?: boolean;      // Enable MIDI input splitting (bass ≤B3, treble ≥C4)
}

export interface MidiConnectionStatus {
  isSupported: boolean;
  isEnabled: boolean;
  selectedDeviceId?: string;
  connectedDevices: MidiDevice[];
  lastError?: string;
  pianoMode?: PianoModeSettings; // Piano mode settings
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