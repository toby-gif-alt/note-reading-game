/**
 * Lane-based Note Reading Game System
 * Implements the full specification from the problem statement
 */

// --------------------------- CONSTANTS ---------------------------
const BASS_MAX_MIDI = 59; // B3
const TREBLE_MIN_MIDI = 60; // C4
const CHORD_WINDOW_MS = 100; // milliseconds
const CHORD_SPAWN_MULTIPLIER = 1.25; // chords spawn 25% slower than normal at same level

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
  const { pianoModeActive } = getGameMode();
  const lane = routeLane(midi, pianoModeActive);
  const ls = getLaneState(lane);
  if (!ls || !ls.enabled) return;

  ls.held.add(midi);

  const tgt = activeTarget(lane);
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
  const { pianoModeActive, level } = getGameMode();

  const lanes: LaneId[] = pianoModeActive ? ['bass', 'treble'] : ['mono'];
  for (const lane of lanes) {
    const ls = getLaneState(lane);
    if (!ls || !ls.enabled) continue;
    
    const due = currentMs >= ls.spawnNextAtMs;
    if (due) {
      const interval = (ls.mode === 'chord')
        ? ls.spawnIntervalChordMs(level)
        : ls.spawnIntervalMs(level);

      const next = (ls.mode === 'chord')
        ? nextChordTargetInRange(ls.range)
        : nextMelodyTargetInRange(ls.range);

      spawnTarget(lane, next);
      updateLaneState(lane, { spawnNextAtMs: currentMs + interval });
    }

    // TODO: move visuals by ls.movementSpeedPxPerSec * dt, handle miss-at-hitline exactly once:
    // If a target crosses the hit line without success, call:
    //   decrementLives(lane, 1); removeActiveTargetFromQueue(lane); popFail(lane, target);
  }

  // requestAnimationFrame/gameLoop re-schedule is handled elsewhere.
}

// --------------------------- GENERATORS (RANGE-SAFE) ---------------------------
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
  const { pianoModeActive, level } = getGameMode();
  
  // Clear existing lanes
  laneStates.clear();
  
  // Base spawn interval function - gets faster with level
  const baseSpawnInterval = (level: number) => {
    return Math.max(800, 2200 - (level - 1) * 200);
  };
  
  if (pianoModeActive) {
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
function clamp(x: number, lo: number, hi: number): number { 
  return Math.min(hi, Math.max(lo, x)); 
}

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