/**
 * MIDI Utility Functions
 * Helper functions for MIDI note conversion and processing
 */
/**
 * Convert scientific notation (letter + octave) to MIDI note number
 * @param letter Note letter (A-G)
 * @param octave Octave number
 * @returns MIDI note number (0-127)
 */
export function scientificToMidi(letter, octave) {
    const noteValues = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
    const noteValue = noteValues[letter.toUpperCase()];
    if (noteValue === undefined) {
        throw new Error(`Invalid note letter: ${letter}`);
    }
    return (octave + 1) * 12 + noteValue;
}
/**
 * Convert MIDI note number to scientific notation
 * @param midi MIDI note number (0-127)
 * @returns Object with letter, octave, and scientific notation
 */
export function midiToScientific(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    const noteName = noteNames[noteIndex];
    return {
        letter: noteName.charAt(0), // Return just the natural note letter
        octave: octave,
        scientific: noteName + octave
    };
}
/**
 * Convert MIDI note number to MidiNoteMapping
 * @param midiNote MIDI note number (0-127)
 * @returns Complete MIDI note mapping
 */
export function midiNoteToMapping(midiNote) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const noteIndex = midiNote % 12;
    const fullNoteName = noteNames[noteIndex];
    const naturalNote = fullNoteName.charAt(0);
    const mapping = {
        midiNote: midiNote,
        noteName: naturalNote,
        octave: octave,
        scientific: fullNoteName + octave
    };
    return mapping;
}
/**
 * Check if a MIDI note is a natural note (no sharp/flat)
 * @param midiNote MIDI note number
 * @returns True if natural note, false if sharp/flat
 */
export function isNaturalNote(midiNote) {
    const noteInOctave = midiNote % 12;
    // Natural notes: C=0, D=2, E=4, F=5, G=7, A=9, B=11
    return [0, 2, 4, 5, 7, 9, 11].includes(noteInOctave);
}
/**
 * Get the closest natural note for a given MIDI note
 * Useful for mapping sharp/flat notes to natural notes for the game
 * @param midiNote MIDI note number
 * @returns MIDI note number of closest natural note
 */
export function getClosestNaturalNote(midiNote) {
    if (isNaturalNote(midiNote)) {
        return midiNote;
    }
    const noteInOctave = midiNote % 12;
    const octave = Math.floor(midiNote / 12);
    // Map sharp/flat notes to their natural equivalents
    let naturalNoteInOctave;
    switch (noteInOctave) {
        case 1: // C#/Db -> C
            naturalNoteInOctave = 0;
            break;
        case 3: // D#/Eb -> D
            naturalNoteInOctave = 2;
            break;
        case 6: // F#/Gb -> F
            naturalNoteInOctave = 5;
            break;
        case 8: // G#/Ab -> G
            naturalNoteInOctave = 7;
            break;
        case 10: // A#/Bb -> A
            naturalNoteInOctave = 9;
            break;
        default:
            naturalNoteInOctave = noteInOctave;
    }
    return octave * 12 + naturalNoteInOctave;
}
/**
 * Check if a MIDI note is in the playable range for the game
 * Based on typical piano range and note reading difficulty
 * @param midiNote MIDI note number
 * @returns True if note is in playable range
 */
export function isInPlayableRange(midiNote) {
    // Typical range for note reading: C3 (48) to C6 (84)
    return midiNote >= 48 && midiNote <= 84;
}
/**
 * Format MIDI note information for display
 * @param mapping MIDI note mapping
 * @returns Formatted string for display
 */
export function formatNoteForDisplay(mapping) {
    return `${mapping.noteName}${mapping.octave} (MIDI ${mapping.midiNote})`;
}
/**
 * Get the natural note name from a MIDI note for game input
 * Maps sharps/flats to closest natural
 * @param midiNote MIDI note number
 * @returns Natural note name for game input
 */
export function getNaturalNoteForGame(midiNote) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteIndex = midiNote % 12;
    const fullNoteName = noteNames[noteIndex];
    if (fullNoteName.includes('#')) {
        // Map sharp notes to the closest natural note
        const closestNatural = getClosestNaturalNote(midiNote);
        return noteNames[closestNatural % 12].charAt(0);
    }
    return fullNoteName.charAt(0); // Return natural note letter
}
//# sourceMappingURL=midi-utils.js.map