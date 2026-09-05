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
 * Preserve the exact MIDI pitch so accidentals can be validated correctly.
 * The game currently displays natural notes only, so black keys must not be
 * silently converted into neighbouring white-key answers.
 * @param midiNote MIDI note number
 * @returns The unchanged MIDI note number
 */
export function getClosestNaturalNote(midiNote) {
    return midiNote;
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
 * Get the note name from MIDI input for game validation.
 * Accidentals are deliberately preserved (for example C# stays C#), so the
 * natural-note game rejects them instead of treating them as C, D, F, G, or A.
 * @param midiNote MIDI note number
 * @returns Note name for game input
 */
export function getNaturalNoteForGame(midiNote) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteIndex = midiNote % 12;
    return noteNames[noteIndex];
}
/**
 * Determine which clef a MIDI note belongs to for hard mode split input
 * @param midiNote MIDI note number
 * @returns 'bass' for notes ≤B3 (59), 'treble' for notes ≥C4 (60)
 */
export function getClefForMidiNote(midiNote) {
    // B3 = MIDI note 59, C4 = MIDI note 60
    return midiNote <= 59 ? 'bass' : 'treble';
}
/**
 * Check if a MIDI note is within the valid range for a specific clef in hard mode
 * @param midiNote MIDI note number
 * @param targetClef The clef to check against
 * @returns True if the note belongs to the target clef in hard mode
 */
export function isNoteInClefRange(midiNote, targetClef) {
    const noteClef = getClefForMidiNote(midiNote);
    return noteClef === targetClef;
}
//# sourceMappingURL=midi-utils.js.map