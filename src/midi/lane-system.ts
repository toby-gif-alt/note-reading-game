/**
 * Lane-based Note Reading Game System
 * Implements the full specification from the problem statement
 */

// --------------------------- CONSTANTS ---------------------------
const BASS_MAX_MIDI = 59; // B3
const TREBLE_MIN_MIDI = 60; // C4
const CHORD_WINDOW_MS = 100; // milliseconds
const CHORD_SPAWN_MULTIPLIER = 1.25; // chords spawn 25% slower than normal at same level

// === Clef split & margins ===
const RIGHT_MARGIN_FRAC = 0.08; // 8% screen width from right edge

// === Mode flags (reuse your settings store if present) ===
(globalThis as any).settings = (globalThis as any).settings || {};
const settings = (globalThis as any).settings;
if (typeof settings.pianoMode === 'undefined') settings.pianoMode = false;
if (typeof settings.strictOctave === 'undefined') settings.strictOctave = false;
// Per-clef play mode: 'normal' | 'chord' | 'melody'
settings.playMode = settings.playMode || { bass: 'normal', treble: 'normal' };

// === Simple speed curve (px/s) ===
function speedForLevel(level: number): number {
  const base = 220; const inc = 15;
  const v = base + inc * Math.max(0, Number(level||0));
  return Math.min(520, Math.max(160, v));
}

// === Routing ===
function pianoOn(): boolean {
  return !!(typeof (globalThis as any).pianoModeActive !== 'undefined' ? (globalThis as any).pianoModeActive : settings.pianoMode);
}
function routeClef(midi: number): 'bass' | 'treble' {
  return midi <= BASS_MAX_MIDI ? 'bass' : 'treble';
}

// === Match function (strict octave toggle) ===
function matchesTarget(midi: number, targetMidi: number): boolean {
  if (settings.strictOctave) return midi === targetMidi;
  return (midi % 12) === (targetMidi % 12);
}

// === Piano Mode split (B3/C4) ===
function _routeClefByMidi(midi: number): 'bass' | 'treble' { 
  return midi <= BASS_MAX_MIDI ? 'bass' : 'treble'; 
}
function _isPianoOn(): boolean {
  // Prefer existing flag; fall back to settings if present
  return !!(typeof (globalThis as any).pianoModeActive !== 'undefined' ? (globalThis as any).pianoModeActive : ((globalThis as any).gameSettings && (globalThis as any).gameSettings.pianoMode));
}

// === Lane state (one-at-a-time queues) ===
const lanes = {
  bass:   { active: null as any, phraseIndex: 0, phraseSize: 0 },
  treble: { active: null as any, phraseIndex: 0, phraseSize: 0 },
  mono:   { active: null as any, phraseIndex: 0, phraseSize: 0 }, // used when piano is OFF
};

function laneForPlay(): ('bass' | 'treble' | 'mono')[] { return pianoOn() ? ['bass','treble'] : ['mono']; }

function clearLane(l: 'bass' | 'treble' | 'mono'): void { 
  lanes[l].active = null; 
  lanes[l].phraseIndex = 0; 
  lanes[l].phraseSize = 0; 
}

// --------------------------- TYPES ---------------------------
type LaneId = 'bass' | 'treble' | 'mono';
type Mode = 'melody' | 'chord';

type MelodyTarget = { kind: 'melody', midi: number, id: string };
type ChordTarget = { kind: 'chord', mids: number[], id: string };
type Target = MelodyTarget | ChordTarget;

type LaneState = {
  id: LaneId;
  mode: Mode; // 'melody' or 'chord'
  lives: number;
  enabled: boolean; // false when lives <= 0
  queue: Target[]; // left-most is active target
  held: Set<number>; // currently held MIDI notes routed to this lane
  movementSpeedPxPerSec: number; // constant per lane (no per-target variance)
  spawnNextAtMs: number; // absolute time to spawn next target
  spawnIntervalMs: (level: number) => number; // base cadence in ms
  spawnIntervalChordMs: (level: number) => number; // base cadence * 1.25
  range: { min: number; max: number }; // inclusive bounds for generators
  chordRuntime?: {
    activeId: string | null; // id of active chord (if any)
    windowStartMs: number | null; // when first correct tone was pressed
    collected: Set<number>; // chord tones collected (MIDI numbers)
  };
};

// --------------------------- GLOBAL STATE ---------------------------
const laneStates = new Map<LaneId, LaneState>();

// --------------------------- GAME-WIDE ACCESSORS ---------------------------
// These will be hooked up to the real game functions
function getGameMode(): { pianoModeActive: boolean, level: number } { 
  // Hook to existing global variables in script.js
  return { 
    pianoModeActive: (globalThis as any).pianoModeActive || false, 
    level: (globalThis as any).level || 1 
  }; 
}

function getLaneState(lane: LaneId): LaneState | undefined { 
  return laneStates.get(lane); 
}

function updateLaneState(lane: LaneId, patch: Partial<LaneState>): void { 
  const current = laneStates.get(lane);
  if (current) {
    Object.assign(current, patch);
  }
}

function decrementLives(lane: LaneId, amount = 1): void { 
  const ls = getLaneState(lane);
  if (!ls) return;
  
  ls.lives = Math.max(0, ls.lives - amount);
  if (ls.lives <= 0) {
    ls.enabled = false;
  }
  
  // Update the existing game UI based on lane
  if (lane === 'bass') {
    (globalThis as any).bassLives = ls.lives;
    (globalThis as any).bassClefActive = ls.enabled;
  } else if (lane === 'treble') {
    (globalThis as any).trebleLives = ls.lives;
    (globalThis as any).trebleClefActive = ls.enabled;
  } else { // mono
    (globalThis as any).lives = ls.lives;
  }
  
  // Update the UI display
  if (typeof (globalThis as any).updateLifeDisplay === 'function') {
    (globalThis as any).updateLifeDisplay();
  }
}

function _decLife(clef: LaneId): void {
  if (!_isPianoOn()) { 
    (globalThis as any).lives--; 
    if (typeof (globalThis as any).updateLifeDisplay === 'function') {
      (globalThis as any).updateLifeDisplay();
    }
    return; 
  }
  if (clef === 'bass')  { 
    (globalThis as any).bassLives  = Math.max(0, ((globalThis as any).bassLives  || 0) - 1); 
    if (typeof (globalThis as any).updateLifeDisplay === 'function') {
      (globalThis as any).updateLifeDisplay();
    }
  }
  if (clef === 'treble'){ 
    (globalThis as any).trebleLives = Math.max(0, ((globalThis as any).trebleLives || 0) - 1); 
    if (typeof (globalThis as any).updateLifeDisplay === 'function') {
      (globalThis as any).updateLifeDisplay();
    }
  }
}

function _laneEnabled(clef: LaneId): boolean {
  if (!_isPianoOn()) return ((globalThis as any).lives > 0);
  return clef === 'bass' ? (globalThis as any).bassLives > 0 : (globalThis as any).trebleLives > 0;
}

function _stopAtZeroGuards(clef: LaneId): void {
  if (_isPianoOn()) {
    if ((globalThis as any).bassLives <= 0) { 
      // Disable bass lane
      const bassLs = getLaneState('bass');
      if (bassLs) bassLs.enabled = false;
      if (typeof (globalThis as any).disableBassLane === 'function') {
        (globalThis as any).disableBassLane();
      }
    }
    if ((globalThis as any).trebleLives <= 0) { 
      // Disable treble lane  
      const trebleLs = getLaneState('treble');
      if (trebleLs) trebleLs.enabled = false;
      if (typeof (globalThis as any).disableTrebleLane === 'function') {
        (globalThis as any).disableTrebleLane();
      }
    }
    if ((globalThis as any).bassLives <= 0 && (globalThis as any).trebleLives <= 0) {
      if (typeof (globalThis as any).stopGame === 'function') {
        (globalThis as any).stopGame('piano-both-dead');
      }
    }
  }
}

function popSuccess(lane: LaneId, t: Target): void { 
  // Hook to existing success effects in the game
  if (typeof (globalThis as any).playSuccessSound === 'function') {
    (globalThis as any).playSuccessSound();
  }
  
  // Update score
  (globalThis as any).score = ((globalThis as any).score || 0) + 1;
  (globalThis as any).correctAnswers = ((globalThis as any).correctAnswers || 0) + 1;
  
  if (typeof (globalThis as any).updateDisplays === 'function') {
    (globalThis as any).updateDisplays();
  }
}

function popFail(lane: LaneId, t: Target): void { 
  // Hook to existing fail effects in the game
  if (typeof (globalThis as any).playErrorSound === 'function') {
    (globalThis as any).playErrorSound();
  }
}

function removeActiveTargetFromQueue(lane: LaneId): Target | undefined { 
  const ls = getLaneState(lane);
  if (!ls || ls.queue.length === 0) return undefined;
  return ls.queue.shift();
}

function activeTarget(lane: LaneId): Target | undefined { 
  const ls = getLaneState(lane);
  if (!ls || ls.queue.length === 0) return undefined;
  return ls.queue[0];
}

function spawnTarget(lane: LaneId, t: Target): void { 
  const ls = getLaneState(lane);
  if (!ls) return;
  
  ls.queue.push(t);
  
  // Create visual representation in the existing game system
  // This will need to be integrated with the existing note spawning system
  if (typeof (globalThis as any).createLaneTarget === 'function') {
    (globalThis as any).createLaneTarget(lane, t);
  }
}

function nowMs(): number { 
  return (typeof performance !== 'undefined' ? performance.now() : Date.now()); 
}

// --------------------------- ROUTING ---------------------------
function routeLane(midi: number, pianoModeActive: boolean): LaneId {
  if (!pianoModeActive) return 'mono';
  return (midi <= BASS_MAX_MIDI) ? 'bass' : 'treble';
}

// --------------------------- MIDI NOTE-ON ENTRY POINT ---------------------------
/**
 * Call this from your low-level MIDI NoteOn handler:
 * onMidiNoteOn(midi, velocity) { handleMidiNoteOn(midi, velocity); }
 */
export function handleMidiNoteOn(midi: number, velocity: number): void {
  // Determine routed clef in Piano Mode; otherwise keep Normal Mode
  let routedClef: LaneId | null = null;
  if (_isPianoOn()) {
    routedClef = _routeClefByMidi(midi); // 'bass' or 'treble'
  } else {
    routedClef = 'mono';
  }
  
  const ls = getLaneState(routedClef);
  if (!ls || !ls.enabled) return;

  ls.held.add(midi);

  const tgt = activeTarget(routedClef);
  if (!tgt) return;

  if (tgt.kind === 'melody') {
    handleMelody_Strict(ls, midi, tgt);
  } else {
    handleChord_Strict(ls, midi, tgt);
  }
}

// --------------------------- MELODY (STRICT) ---------------------------
/**
 * Strict melody rule (applies in Normal and Piano modes):
 * If pressed MIDI != target.midi => immediate blow-up of the melody target for that lane.
 * If pressed MIDI == target.midi => success.
 */
function handleMelody_Strict(ls: LaneState, midi: number, tgt: MelodyTarget): void {
  if (midi === tgt.midi) {
    removeActiveTargetFromQueue(ls.id);
    popSuccess(ls.id, tgt);
  } else {
    decrementLives(ls.id, 1);
    _stopAtZeroGuards(ls.id);
    removeActiveTargetFromQueue(ls.id);
    popFail(ls.id, tgt);
  }
}

// --------------------------- CHORD (STRICT + 100ms WINDOW) ---------------------------
/**
 * Chord rules:
 * The chord is "armed" whenever it is the active target.
 * Pressing ANY non-chord note in that lane while armed -> immediate blow-up.
 * The 100ms window starts at the first correct chord tone; all unique chord tones must be
 * pressed within that 100ms window for success.
 * If time runs out before collecting all tones -> blow-up.
 * Duplicate presses of already-collected tones are ignored.
 */
function handleChord_Strict(ls: LaneState, midi: number, tgt: ChordTarget): void {
  const tones = new Set<number>(tgt.mids);
  
  // Stray check first: any non-chord note blows up immediately while chord is active.
  if (!tones.has(midi)) {
    decrementLives(ls.id, 1);
    _stopAtZeroGuards(ls.id);
    removeActiveTargetFromQueue(ls.id);
    popFail(ls.id, tgt);
    ls.chordRuntime = undefined;
    return;
  }

  // Correct chord tone: init or update runtime
  if (!ls.chordRuntime || ls.chordRuntime.activeId !== tgt.id) {
    ls.chordRuntime = { activeId: tgt.id, windowStartMs: nowMs(), collected: new Set<number>() };
    
    // Schedule timeout
    const startedAt = ls.chordRuntime.windowStartMs!;
    setTimeout(() => chordTimeoutCheck(ls.id, tgt.id, startedAt), CHORD_WINDOW_MS + 5);
  }

  // Collect tone
  ls.chordRuntime.collected.add(midi);

  // Success if all tones collected
  if (ls.chordRuntime.collected.size === tones.size) {
    removeActiveTargetFromQueue(ls.id);
    popSuccess(ls.id, tgt);
    ls.chordRuntime = undefined;
  }
}

function chordTimeoutCheck(lane: LaneId, targetId: string, startedAt: number): void {
  const ls = getLaneState(lane);
  if (!ls || !ls.enabled) return;

  const tgt = activeTarget(lane);
  // Only act if the same chord is still active and window hasn't succeeded
  if (!tgt || tgt.kind !== 'chord' || tgt.id !== targetId) return;

  // If 100ms elapsed and not all tones collected -> fail
  const rt = ls.chordRuntime;
  if (!rt || rt.activeId !== targetId) return;
  if ((nowMs() - startedAt) >= CHORD_WINDOW_MS) {
    decrementLives(lane, 1);
    _stopAtZeroGuards(lane);
    removeActiveTargetFromQueue(lane);
    popFail(lane, tgt);
    ls.chordRuntime = undefined;
  }
}

// --------------------------- SPAWNERS & MOVEMENT ---------------------------
/**
 * Movement speed is constant per lane; do NOT vary per target.
 * Density/difficulty is controlled by spawn cadence.
 * In chord mode, the cadence is slower by CHORD_SPAWN_MULTIPLIER.
 */
export function gameTickLoop(currentMs: number): void {
  // Use the new one-at-a-time spawning system instead of the old multi-spawn system
  const activeLanes = laneForPlay();
  
  for (const lane of activeLanes) {
    // Check if this lane has no active target and spawn one
    if (!lanes[lane].active) {
      spawnNext(lane);
    }
  }
  
  // The rest of the game loop (visual updates, collision detection) 
  // is handled by the main game loop in script.js
}

// --------------------------- SPAWNING (single active target; auto after resolve) ---------------------------

function spawnX(): number {
  const w = (typeof (globalThis as any).getCanvasWidth === 'function') ? (globalThis as any).getCanvasWidth() : ((globalThis as any).window?.innerWidth || 1024);
  return Math.round(w * (1 - RIGHT_MARGIN_FRAC)); // right edge with margin
}

// Build next target for a lane based on its playMode
function buildNextTarget(lane: 'bass' | 'treble' | 'mono'): any {
  const mode = pianoOn() ? ((globalThis as any).settings.playMode[lane] || 'normal') : 'normal';
  if (mode === 'chord') {
    const chord = nextChordInRange(lane);
    return { kind: 'chord', mids: chord, id: 'C_' + lane + '_' + Date.now() };
  }
  if (mode === 'melody') {
    const phrase = nextMelodyPhraseInRange(lane); // array of 3-5 midis
    return { kind: 'melodyPhrase', mids: phrase, id: 'MP_' + lane + '_' + Date.now() };
  }
  // normal
  const midi = nextSingleNoteInRange(lane);
  return { kind: 'melody', midi, id: 'M_' + lane + '_' + Date.now() };
}

function spawnNext(lane: 'bass' | 'treble' | 'mono'): void {
  if (lanes[lane].active) return; // one at a time
  const t = buildNextTarget(lane);
  lanes[lane].active = t;
  if (t.kind === 'melodyPhrase') {
    lanes[lane].phraseIndex = 0;
    lanes[lane].phraseSize = t.mids.length;
  }
  const speed = speedForLevel((globalThis as any).gameLevel || (globalThis as any).level || 1);
  // Map this to your real visual spawn call
  spawnVisualTarget(lane, t, { x: spawnX(), speedPxPerSec: speed });
}

// Call this when a target finishes (success/fail/miss). It auto-spawns the next one.
function resolveAndRespawn(lane: 'bass' | 'treble' | 'mono', result: string): void {
  // Remove visuals for the resolved target (map to your renderer)
  if (typeof (globalThis as any).removeVisualTarget === 'function') {
    (globalThis as any).removeVisualTarget(lane, lanes[lane].active);
  }
  lanes[lane].active = null;
  lanes[lane].phraseIndex = 0; 
  lanes[lane].phraseSize = 0;
  // Immediately spawn the next
  spawnNext(lane);
}

function spawnVisualTarget(lane: 'bass' | 'treble' | 'mono', target: any, options: any): void {
  // Map to existing game's spawn system
  if (typeof (globalThis as any).createLaneTarget === 'function') {
    (globalThis as any).createLaneTarget(lane, target);
  } else if (typeof (globalThis as any).spawnNoteForLane === 'function') {
    (globalThis as any).spawnNoteForLane(lane, target, options);
  } else {
    // Fallback to creating a visual target in movingNotes array
    const movingNotes = (globalThis as any).movingNotes;
    if (movingNotes && Array.isArray(movingNotes)) {
      if (target.kind === 'melody') {
        // Create a single note using the new helper
        const noteData = midiToGameNote(target.midi, lane);
        const movingNote = {
          x: options.x,
          speed: options.speedPxPerSec / 60, // convert to px per frame assuming 60fps
          id: target.id,
          kind: 'melody',
          ...noteData
        };
        movingNotes.push(movingNote);
      } else if (target.kind === 'chord') {
        // Create a chord target
        const baseNote = midiToGameNote(target.mids[0], lane);
        movingNotes.push({
          clef: lane === 'mono' ? ((globalThis as any).currentClef || 'treble') : lane,
          kind: 'chord',
          mids: target.mids,
          id: target.id,
          x: options.x,
          speed: options.speedPxPerSec / 60,
          isChord: true,
          ...baseNote
        });
      } else if (target.kind === 'melodyPhrase') {
        // Create a phrase target (for now, show first note)
        const firstMidi = target.mids[0];
        const noteData = midiToGameNote(firstMidi, lane);
        const movingNote = {
          x: options.x,
          speed: options.speedPxPerSec / 60,
          id: target.id,
          kind: 'melodyPhrase',
          mids: target.mids,
          phraseIndex: 0,
          ...noteData
        };
        movingNotes.push(movingNote);
      }
    }
  }
}

// --------------------------- GENERATORS (RANGE-SAFE & PHRASE-LIKE) ---------------------------

function clamp(n: number, lo: number, hi: number): number { 
  return Math.max(lo, Math.min(hi, n)); 
}

function laneRange(lane: 'bass' | 'treble' | 'mono'): { min: number; max: number } {
  if (!pianoOn() || lane === 'mono') return { min: 36, max: 84 }; // keep your previous overall range
  return lane === 'bass' ? { min: 21, max: BASS_MAX_MIDI } : { min: TREBLE_MIN_MIDI, max: 96 };
}

function nextSingleNoteInRange(lane: 'bass' | 'treble' | 'mono'): number {
  const r = laneRange(lane);
  const steps = [-2,-1,-1,1,1,2,2,3,-3];
  const base = Math.round((r.min + r.max)/2);
  const pick = base + steps[Math.floor(Math.random()*steps.length)];
  return clamp(pick, r.min, r.max);
}

function nextChordInRange(lane: 'bass' | 'treble' | 'mono'): number[] {
  const r = laneRange(lane);
  // simple triad root selection inside range
  const root = clamp(r.min + Math.floor(Math.random() * (r.max - r.min - 7)), r.min, r.max-7);
  const tones = [root, root+4, root+7].filter(n => n>=r.min && n<=r.max);
  return Array.from(new Set(tones));
}

function nextMelodyPhraseInRange(lane: 'bass' | 'treble' | 'mono'): number[] {
  const r = laneRange(lane);
  const size = 3 + Math.floor(Math.random()*3); // 3..5
  const arr: number[] = [];
  let cur = Math.round((r.min + r.max)/2);
  for (let i=0; i<size; i++){
    const step = [-2,-1,1,2,2,-2,1,-1,3,-3][Math.floor(Math.random()*10)];
    cur = clamp(cur + step, r.min, r.max);
    arr.push(cur);
  }
  return arr;
}

// Helper function to convert MIDI to game note format
function midiToGameNote(midi: number, lane: 'bass' | 'treble' | 'mono'): any {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  const noteName = noteNames[noteIndex];
  
  // For now, map sharps to natural notes to match game's note system
  const naturalNote = noteName.replace('#', '');
  const letter = naturalNote;
  
  // Calculate staff position (this is approximate - game has more complex logic)
  const clef = lane === 'mono' ? ((globalThis as any).currentClef || 'treble') : lane;
  let staffLocalIndex = 0;
  
  // Simple mapping for demonstration - in a full implementation, this would need
  // to match the game's complex staff positioning logic
  const baseNotes: { [key: string]: number } = { 'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6 };
  if (baseNotes[letter] !== undefined) {
    staffLocalIndex = baseNotes[letter] + (octave - 4) * 7;
  }
  
  return {
    note: naturalNote,
    letter: letter,
    octave: octave,
    midi: midi,
    scientific: naturalNote + octave,
    clef: clef,
    staffLocalIndex: staffLocalIndex,
    line: staffLocalIndex // Legacy compatibility
  };
}

// --------------------------- MIDI EVALUATION BRIDGE (ONE LANE AT A TIME) ---------------------------

function handleNoteOnOneAtATime(midi: number, velocity: number): void {
  const lanesToCheck = pianoOn() ? ['bass','treble'] : ['mono'];
  const targetLane = pianoOn() ? routeClef(midi) : 'mono';
  const L = targetLane as 'bass' | 'treble' | 'mono';

  if (!lanes[L].active) { // lane empty → spawn first
    spawnNext(L);
  }

  const t = lanes[L].active;
  if (!t) return;

  // Melody (single)
  if (t.kind === 'melody') {
    if (matchesTarget(midi, t.midi)) {
      onSuccess && onSuccess(L, t); // map to your success FX/score
      resolveAndRespawn(L, 'success');
    } else {
      onFail && onFail(L, t, 'melody-wrong'); // FX
      decrementLivesForLane(L);               // map to your lives system
      resolveAndRespawn(L, 'fail');
    }
    return;
  }

  // Chord (single chord target, one at a time)
  if (t.kind === 'chord') {
    // transient window start + collected stored on lanes object
    (lanes[L] as any).__chordStart ??= null;
    (lanes[L] as any).__chordHits ??= new Set();

    const tones = new Set(t.mids);
    if (!tones.has(midi)) {
      onFail && onFail(L, t, 'chord-stray');
      decrementLivesForLane(L);
      (lanes[L] as any).__chordHits.clear(); 
      (lanes[L] as any).__chordStart = null;
      resolveAndRespawn(L, 'fail');
      return;
    }

    if ((lanes[L] as any).__chordStart === null) {
      const started = performance.now();
      (lanes[L] as any).__chordStart = started;
      (lanes[L] as any).__chordHits.clear();
      setTimeout(() => {
        const still = lanes[L].active;
        if (!still || still.id !== t.id || still.kind!=='chord') return;
        if ((lanes[L] as any).__chordStart !== started) return;
        if ((lanes[L] as any).__chordHits.size < tones.size) {
          onFail && onFail(L, t, 'chord-timeout');
          decrementLivesForLane(L);
          (lanes[L] as any).__chordHits.clear(); 
          (lanes[L] as any).__chordStart = null;
          resolveAndRespawn(L, 'fail');
        }
      }, 100);
    }
    (lanes[L] as any).__chordHits.add(midi);
    if ((lanes[L] as any).__chordHits.size === tones.size) {
      onSuccess && onSuccess(L, t);
      (lanes[L] as any).__chordHits.clear(); 
      (lanes[L] as any).__chordStart = null;
      resolveAndRespawn(L, 'success');
    }
    return;
  }

  // Melody phrase (3–5 in order, one at a time)
  if (t.kind === 'melodyPhrase') {
    const idx = lanes[L].phraseIndex;
    const need = t.mids[idx];
    if (matchesTarget(midi, need)) {
      lanes[L].phraseIndex++;
      // update subtarget UI here if you have it
      if (lanes[L].phraseIndex >= lanes[L].phraseSize) {
        // phrase complete → award 1 point toward 10
        addPhrasePoint && addPhrasePoint(L); // map to your scoring (10 needed)
        onSuccess && onSuccess(L, t);
        resolveAndRespawn(L, 'success');
      }
    } else {
      onFail && onFail(L, t, 'phrase-wrong');
      decrementLivesForLane(L);
      resolveAndRespawn(L, 'fail');
    }
    return;
  }
}

// Success/fail/phrase point callback placeholders (map to your existing functions)
const onSuccess = (globalThis as any).onSuccess || function(lane: string, target: any) {
  console.log('Success:', lane, target);
};
const onFail = (globalThis as any).onFail || function(lane: string, target: any, reason: string) {
  console.log('Fail:', lane, target, reason);
};
const addPhrasePoint = (globalThis as any).addPhrasePoint || function(lane: string) {
  console.log('Phrase point:', lane);
};

function decrementLivesForLane(lane: 'bass' | 'treble' | 'mono'): void {
  if (!pianoOn()) { 
    if (typeof (globalThis as any).lives==='number') { 
      (globalThis as any).lives=Math.max(0,(globalThis as any).lives-1); 
      if (typeof (globalThis as any).updateLives === 'function') {
        (globalThis as any).updateLives((globalThis as any).lives);
      }
    } 
    return; 
  }
  if (lane === 'bass')  { 
    (globalThis as any).bassLives  = Math.max(0, ((globalThis as any).bassLives  || 0) - 1); 
    if (typeof (globalThis as any).updateLivesUI === 'function') {
      (globalThis as any).updateLivesUI('bass', (globalThis as any).bassLives);
    }
  }
  if (lane === 'treble'){ 
    (globalThis as any).trebleLives = Math.max(0, ((globalThis as any).trebleLives || 0) - 1); 
    if (typeof (globalThis as any).updateLivesUI === 'function') {
      (globalThis as any).updateLivesUI('treble', (globalThis as any).trebleLives);
    }
  }
  if (((globalThis as any).bassLives||0) <= 0 && (globalThis as any).disableBassLane) (globalThis as any).disableBassLane();
  if (((globalThis as any).trebleLives||0) <= 0 && (globalThis as any).disableTrebleLane) (globalThis as any).disableTrebleLane();
  if (((globalThis as any).bassLives||0) <= 0 && ((globalThis as any).trebleLives||0) <= 0 && (globalThis as any).stopGame) (globalThis as any).stopGame('piano-both-dead');
}

// Expose the new one-at-a-time handler
(globalThis as any).handleNoteOnOneAtATime = handleNoteOnOneAtATime;
(globalThis as any).lanes = lanes;
(globalThis as any).pianoOn = pianoOn;
(globalThis as any).routeClef = routeClef;
(globalThis as any).spawnNext = spawnNext;

// --------------------------- EXISTING GENERATORS (RANGE-SAFE) ---------------------------
/**
 * Melody generator: phrase-like (stepwise bias), small leaps, clamped to lane range.
 * Use previous melody note as seed when available; otherwise seed anywhere in range.
 */
function nextMelodyTargetInRange(range: { min: number; max: number }): MelodyTarget {
  const prevMidi = getLastMelodyMidiFromAnySource(range); // TODO: track last melody midi per lane
  const base = (typeof prevMidi === 'number') ? prevMidi : seedInRange(range.min, range.max);
  const stepChoices = [-2,-2,-1,-1,1,1,2,2,3,-3]; // bias small steps
  const step = stepChoices[Math.floor(Math.random() * stepChoices.length)];
  const midi = clamp(base + step, range.min, range.max);
  return { kind: 'melody', midi, id: makeId() };
}

/**
 * Chord generator: triads in range; fit tones into lane range (drop/add octaves).
 * De-duplicate mids; ensure all tones are within [min, max].
 */
function nextChordTargetInRange(range: { min: number; max: number }): ChordTarget {
  const root = pickChordRootInRange(range.min, range.max);
  const quality = pick(['maj','min'] as const);
  const tones = buildTriad(root, quality);
  const fitted = fitChordToRange(tones, range.min, range.max);
  const mids = Array.from(new Set<number>(fitted));
  return { kind: 'chord', mids, id: makeId() };
}

// --------------------------- INITIALIZATION ---------------------------
/**
 * Initialize lane states based on game mode
 */
function initializeLanes(): void {
  const { level } = getGameMode();
  
  // Clear existing lanes
  laneStates.clear();
  
  // At level/start when Piano Mode turns ON, ensure per-clef counters exist
  if (_isPianoOn()) {
    if (typeof (globalThis as any).bassLives === 'undefined')  
      (globalThis as any).bassLives  = typeof (globalThis as any).lives === 'number' ? (globalThis as any).lives : 3;
    if (typeof (globalThis as any).trebleLives === 'undefined') 
      (globalThis as any).trebleLives = typeof (globalThis as any).lives === 'number' ? (globalThis as any).lives : 3;
  }
  
  // Base spawn interval function - gets faster with level
  const baseSpawnInterval = (level: number) => {
    return Math.max(800, 2200 - (level - 1) * 200);
  };
  
  if (_isPianoOn()) {
    // Piano Mode: create bass and treble lanes
    laneStates.set('bass', {
      id: 'bass',
      mode: 'melody', // Start with melody mode
      lives: 3,
      enabled: true,
      queue: [],
      held: new Set<number>(),
      movementSpeedPxPerSec: 100,
      spawnNextAtMs: nowMs() + 2000, // 2 second delay to start
      spawnIntervalMs: baseSpawnInterval,
      spawnIntervalChordMs: (level: number) => baseSpawnInterval(level) * CHORD_SPAWN_MULTIPLIER,
      range: { min: 21, max: BASS_MAX_MIDI }, // A0 to B3
      chordRuntime: undefined
    });
    
    laneStates.set('treble', {
      id: 'treble',
      mode: 'melody', // Start with melody mode
      lives: 3,
      enabled: true,
      queue: [],
      held: new Set<number>(),
      movementSpeedPxPerSec: 100,
      spawnNextAtMs: nowMs() + 2000, // 2 second delay to start
      spawnIntervalMs: baseSpawnInterval,
      spawnIntervalChordMs: (level: number) => baseSpawnInterval(level) * CHORD_SPAWN_MULTIPLIER,
      range: { min: TREBLE_MIN_MIDI, max: 108 }, // C4 to C8
      chordRuntime: undefined
    });
  } else {
    // Normal Mode: single mono lane
    laneStates.set('mono', {
      id: 'mono',
      mode: 'melody', // Start with melody mode
      lives: 3,
      enabled: true,
      queue: [],
      held: new Set<number>(),
      movementSpeedPxPerSec: 100,
      spawnNextAtMs: nowMs() + 2000, // 2 second delay to start
      spawnIntervalMs: baseSpawnInterval,
      spawnIntervalChordMs: (level: number) => baseSpawnInterval(level) * CHORD_SPAWN_MULTIPLIER,
      range: { min: 21, max: 108 }, // Full piano range A0 to C8
      chordRuntime: undefined
    });
  }
}

// --------------------------- UTILS (IMPLEMENT OR REPLACE) ---------------------------

function seedInRange(min: number, max: number): number { 
  return min + Math.floor(Math.random() * (max - min + 1)); 
}

function pick<T>(arr: T[]): T { 
  return arr[Math.floor(Math.random() * arr.length)]; 
}

function makeId(): string { 
  return Math.random().toString(36).slice(2); 
}

// TODO: implement these generators
function getLastMelodyMidiFromAnySource(range: { min: number; max: number }): number | undefined {
  // For now, return undefined to force random seeding
  return undefined;
}

function pickChordRootInRange(min: number, max: number): number {
  return seedInRange(min, Math.min(max, min + 12)); // Keep chord root within an octave of min
}

function buildTriad(root: number, quality: 'maj' | 'min'): number[] {
  const intervals = quality === 'maj' ? [0, 4, 7] : [0, 3, 7]; // Major: root, M3, P5; Minor: root, m3, P5
  return intervals.map(interval => root + interval);
}

function fitChordToRange(tones: number[], min: number, max: number): number[] {
  return tones.map(tone => {
    // Transpose to fit in range by octaves
    while (tone < min) tone += 12;
    while (tone > max) tone -= 12;
    return tone;
  }).filter(tone => tone >= min && tone <= max);
}

// Export the key functions for integration - remove duplicates
export { routeLane, initializeLanes, getLaneState, updateLaneState };

// Make functions available globally for script.js integration
declare global {
  interface Window {
    laneSystem: {
      gameTickLoop: typeof gameTickLoop;
      initializeLanes: typeof initializeLanes;
      handleMidiNoteOn: typeof handleMidiNoteOn;
      routeLane: typeof routeLane;
      getLaneState: typeof getLaneState;
      updateLaneState: typeof updateLaneState;
    };
  }
}

// Expose lane system functions globally
(globalThis as any).laneSystem = {
  gameTickLoop,
  initializeLanes,
  handleMidiNoteOn,
  routeLane,
  getLaneState,
  updateLaneState
};

// --------------------------- UI TOGGLES ---------------------------

// Wire to existing buttons if present; otherwise add keybinds
if (typeof document !== 'undefined') {
  // Strict toggle
  const btnStrict = document.querySelector('#btn-strict') as HTMLElement;
  if (btnStrict) {
    btnStrict.addEventListener('click', ()=>{ 
      (globalThis as any).settings.strictOctave = !(globalThis as any).settings.strictOctave;
      console.log('Strict octave:', (globalThis as any).settings.strictOctave);
    });
  }
  
  // Piano toggle  
  const btnPiano = document.querySelector('#btn-piano') as HTMLElement;
  if (btnPiano) {
    btnPiano.addEventListener('click', ()=>{ 
      (globalThis as any).settings.pianoMode = !(globalThis as any).settings.pianoMode; 
      (globalThis as any).pianoModeActive = (globalThis as any).settings.pianoMode;
      console.log('Piano mode:', (globalThis as any).settings.pianoMode);
    });
  }

  // Optional keybinds (keep if you have no buttons)
  window.addEventListener('keydown', (e)=>{
    if (e.key.toLowerCase()==='s') { 
      (globalThis as any).settings.strictOctave = !(globalThis as any).settings.strictOctave; 
      console.log('Strict octave:', (globalThis as any).settings.strictOctave); 
    }
    if (e.key.toLowerCase()==='p') { 
      (globalThis as any).settings.pianoMode = !(globalThis as any).settings.pianoMode; 
      (globalThis as any).pianoModeActive = (globalThis as any).settings.pianoMode; 
      console.log('Piano mode:', (globalThis as any).settings.pianoMode); 
    }
  });
}