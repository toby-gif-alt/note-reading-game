// Targeted correctness fixes for note generation.
//
// This file intentionally sits beside the existing monolithic game script so the
// learning-correctness fixes stay small and reviewable. It can be folded into
// script.js when that file is split into modules.

(() => {
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const STAFF_RANGE = {
    minIndex: -8, // fourth ledger line below the staff
    maxIndex: 16 // fourth ledger line above the staff
  };

  /**
   * Convert a staff-local diatonic index into a natural note definition.
   * Staff index 0 is E4 in treble clef and G2 in bass clef.
   */
  function createNoteDefinition(clef, staffLocalIndex) {
    const anchor = clef === 'treble'
      ? { letter: 'E', octave: 4 }
      : { letter: 'G', octave: 2 };

    const anchorDiatonicIndex = anchor.octave * 7 + LETTERS.indexOf(anchor.letter);
    const absoluteDiatonicIndex = anchorDiatonicIndex + staffLocalIndex;
    const octave = Math.floor(absoluteDiatonicIndex / 7);
    const letterIndex = ((absoluteDiatonicIndex % 7) + 7) % 7;
    const letter = LETTERS[letterIndex];

    return {
      note: letter,
      letter,
      octave,
      midi: scientificToMidi(letter, octave),
      scientific: `${letter}${octave}`,
      clef,
      staffLocalIndex,
      line: staffLocalIndex
    };
  }

  /**
   * Build the complete natural-note range needed by the menu's 0-4 ledger-line
   * difficulty settings. The original arrays stopped before the four-line range.
   */
  function buildFullClefRange(clef) {
    const notes = [];

    // Keep the same high-to-low ordering used by the original definitions.
    for (let index = STAFF_RANGE.maxIndex; index >= STAFF_RANGE.minIndex; index--) {
      notes.push(createNoteDefinition(clef, index));
    }

    return notes;
  }

  notePositions.treble = buildFullClefRange('treble');
  notePositions.bass = buildFullClefRange('bass');
  notePositions.grand = [
    ...notePositions.treble.map(note => ({ ...note, clef: 'treble' })),
    ...notePositions.bass.map(note => ({ ...note, clef: 'bass' }))
  ];
  notePositions.hardMode = [
    ...notePositions.treble.map(note => ({ ...note, clef: 'treble' })),
    ...notePositions.bass.map(note => ({ ...note, clef: 'bass' }))
  ];

  // staffLocalIndex advances by one for each line/space step, while one ledger
  // line is two diatonic steps beyond the staff edge. Preserve the UI setting
  // as a true ledger-line count everywhere else, and only translate it while
  // the existing note selector performs its range filtering.
  const originalPickRandomNote = pickRandomNote;
  pickRandomNote = function pickRandomNoteWithCorrectLedgerRange() {
    const configuredLedgerLines = maxLedgerLines;
    maxLedgerLines = configuredLedgerLines * 2;

    try {
      return originalPickRandomNote();
    } finally {
      maxLedgerLines = configuredLedgerLines;
    }
  };
})();
