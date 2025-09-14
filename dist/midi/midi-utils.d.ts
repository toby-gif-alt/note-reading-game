/**
 * MIDI Utility Functions
 * Helper functions for MIDI note conversion and processing
 */
import { MidiNoteMapping } from './midi-types.js';
/**
 * Convert scientific notation (letter + octave) to MIDI note number
 * @param letter Note letter (A-G)
 * @param octave Octave number
 * @returns MIDI note number (0-127)
 */
export declare function scientificToMidi(letter: string, octave: number): number;
/**
 * Convert MIDI note number to scientific notation
 * @param midi MIDI note number (0-127)
 * @returns Object with letter, octave, and scientific notation
 */
export declare function midiToScientific(midi: number): {
    letter: string;
    octave: number;
    scientific: string;
};
/**
 * Convert MIDI note number to MidiNoteMapping
 * @param midiNote MIDI note number (0-127)
 * @returns Complete MIDI note mapping
 */
export declare function midiNoteToMapping(midiNote: number): MidiNoteMapping;
/**
 * Check if a MIDI note is a natural note (no sharp/flat)
 * @param midiNote MIDI note number
 * @returns True if natural note, false if sharp/flat
 */
export declare function isNaturalNote(midiNote: number): boolean;
/**
 * Get the closest natural note for a given MIDI note
 * Useful for mapping sharp/flat notes to natural notes for the game
 * @param midiNote MIDI note number
 * @returns MIDI note number of closest natural note
 */
export declare function getClosestNaturalNote(midiNote: number): number;
/**
 * Check if a MIDI note is in the playable range for the game
 * Based on typical piano range and note reading difficulty
 * @param midiNote MIDI note number
 * @returns True if note is in playable range
 */
export declare function isInPlayableRange(midiNote: number): boolean;
/**
 * Format MIDI note information for display
 * @param mapping MIDI note mapping
 * @returns Formatted string for display
 */
export declare function formatNoteForDisplay(mapping: MidiNoteMapping): string;
/**
 * Get the natural note name from a MIDI note for game input
 * Maps sharps/flats to closest natural
 * @param midiNote MIDI note number
 * @returns Natural note name for game input
 */
export declare function getNaturalNoteForGame(midiNote: number): string;
/**
 * Determine which clef a MIDI note belongs to for hard mode split input
 * @param midiNote MIDI note number
 * @returns 'bass' for notes ≤B3 (59), 'treble' for notes ≥C4 (60)
 */
export declare function getClefForMidiNote(midiNote: number): 'bass' | 'treble';
/**
 * Check if a MIDI note is within the valid range for a specific clef in hard mode
 * @param midiNote MIDI note number
 * @param targetClef The clef to check against
 * @returns True if the note belongs to the target clef in hard mode
 */
export declare function isNoteInClefRange(midiNote: number, targetClef: 'bass' | 'treble'): boolean;
