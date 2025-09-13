/**
 * Lane-based Note Reading Game System
 * Implements the full specification from the problem statement
 */
// --------------------------- CONSTANTS ---------------------------
const BASS_MAX_MIDI = 59; // B3
const TREBLE_MIN_MIDI = 60; // C4
const CHORD_WINDOW_MS = 100; // milliseconds
const CHORD_SPAWN_MULTIPLIER = 1.25; // chords spawn 25% slower than normal at same level
// === Piano Mode split (B3/C4) ===
function _routeClefByMidi(midi) {
    return midi <= BASS_MAX_MIDI ? 'bass' : 'treble';
}
function _isPianoOn() {
    // Prefer existing flag; fall back to settings if present
    return !!(typeof globalThis.pianoModeActive !== 'undefined' ? globalThis.pianoModeActive : (globalThis.gameSettings && globalThis.gameSettings.pianoMode));
}
// --------------------------- GLOBAL STATE ---------------------------
const laneStates = new Map();
// --------------------------- GAME-WIDE ACCESSORS ---------------------------
// These will be hooked up to the real game functions
function getGameMode() {
    // Hook to existing global variables in script.js
    return {
        pianoModeActive: globalThis.pianoModeActive || false,
        level: globalThis.level || 1
    };
}
function getLaneState(lane) {
    return laneStates.get(lane);
}
function updateLaneState(lane, patch) {
    const current = laneStates.get(lane);
    if (current) {
        Object.assign(current, patch);
    }
}
function decrementLives(lane, amount = 1) {
    const ls = getLaneState(lane);
    if (!ls)
        return;
    ls.lives = Math.max(0, ls.lives - amount);
    if (ls.lives <= 0) {
        ls.enabled = false;
    }
    // Update the existing game UI based on lane
    if (lane === 'bass') {
        globalThis.bassLives = ls.lives;
        globalThis.bassClefActive = ls.enabled;
    }
    else if (lane === 'treble') {
        globalThis.trebleLives = ls.lives;
        globalThis.trebleClefActive = ls.enabled;
    }
    else { // mono
        globalThis.lives = ls.lives;
    }
    // Update the UI display
    if (typeof globalThis.updateLifeDisplay === 'function') {
        globalThis.updateLifeDisplay();
    }
}
function _decLife(clef) {
    if (!_isPianoOn()) {
        globalThis.lives--;
        if (typeof globalThis.updateLifeDisplay === 'function') {
            globalThis.updateLifeDisplay();
        }
        return;
    }
    if (clef === 'bass') {
        globalThis.bassLives = Math.max(0, (globalThis.bassLives || 0) - 1);
        if (typeof globalThis.updateLifeDisplay === 'function') {
            globalThis.updateLifeDisplay();
        }
    }
    if (clef === 'treble') {
        globalThis.trebleLives = Math.max(0, (globalThis.trebleLives || 0) - 1);
        if (typeof globalThis.updateLifeDisplay === 'function') {
            globalThis.updateLifeDisplay();
        }
    }
}
function _laneEnabled(clef) {
    if (!_isPianoOn())
        return (globalThis.lives > 0);
    return clef === 'bass' ? globalThis.bassLives > 0 : globalThis.trebleLives > 0;
}
function _stopAtZeroGuards(clef) {
    if (_isPianoOn()) {
        if (globalThis.bassLives <= 0) {
            // Disable bass lane
            const bassLs = getLaneState('bass');
            if (bassLs)
                bassLs.enabled = false;
            if (typeof globalThis.disableBassLane === 'function') {
                globalThis.disableBassLane();
            }
        }
        if (globalThis.trebleLives <= 0) {
            // Disable treble lane  
            const trebleLs = getLaneState('treble');
            if (trebleLs)
                trebleLs.enabled = false;
            if (typeof globalThis.disableTrebleLane === 'function') {
                globalThis.disableTrebleLane();
            }
        }
        if (globalThis.bassLives <= 0 && globalThis.trebleLives <= 0) {
            if (typeof globalThis.stopGame === 'function') {
                globalThis.stopGame('piano-both-dead');
            }
        }
    }
}
function popSuccess(lane, t) {
    // Hook to existing success effects in the game
    if (typeof globalThis.playSuccessSound === 'function') {
        globalThis.playSuccessSound();
    }
    // Update score
    globalThis.score = (globalThis.score || 0) + 1;
    globalThis.correctAnswers = (globalThis.correctAnswers || 0) + 1;
    if (typeof globalThis.updateDisplays === 'function') {
        globalThis.updateDisplays();
    }
}
function popFail(lane, t) {
    // Hook to existing fail effects in the game
    if (typeof globalThis.playErrorSound === 'function') {
        globalThis.playErrorSound();
    }
}
function removeActiveTargetFromQueue(lane) {
    const ls = getLaneState(lane);
    if (!ls || ls.queue.length === 0)
        return undefined;
    return ls.queue.shift();
}
function activeTarget(lane) {
    const ls = getLaneState(lane);
    if (!ls || ls.queue.length === 0)
        return undefined;
    return ls.queue[0];
}
function spawnTarget(lane, t) {
    const ls = getLaneState(lane);
    if (!ls)
        return;
    ls.queue.push(t);
    // Create visual representation in the existing game system
    // This will need to be integrated with the existing note spawning system
    if (typeof globalThis.createLaneTarget === 'function') {
        globalThis.createLaneTarget(lane, t);
    }
}
function nowMs() {
    return (typeof performance !== 'undefined' ? performance.now() : Date.now());
}
// --------------------------- ROUTING ---------------------------
function routeLane(midi, pianoModeActive) {
    if (!pianoModeActive)
        return 'mono';
    return (midi <= BASS_MAX_MIDI) ? 'bass' : 'treble';
}
// --------------------------- MIDI NOTE-ON ENTRY POINT ---------------------------
/**
 * Call this from your low-level MIDI NoteOn handler:
 * onMidiNoteOn(midi, velocity) { handleMidiNoteOn(midi, velocity); }
 */
export function handleMidiNoteOn(midi, velocity) {
    // Determine routed clef in Piano Mode; otherwise keep Normal Mode
    let routedClef = null;
    if (_isPianoOn()) {
        routedClef = _routeClefByMidi(midi); // 'bass' or 'treble'
    }
    else {
        routedClef = 'mono';
    }
    const ls = getLaneState(routedClef);
    if (!ls || !ls.enabled)
        return;
    ls.held.add(midi);
    const tgt = activeTarget(routedClef);
    if (!tgt)
        return;
    if (tgt.kind === 'melody') {
        handleMelody_Strict(ls, midi, tgt);
    }
    else {
        handleChord_Strict(ls, midi, tgt);
    }
}
// --------------------------- MELODY (STRICT) ---------------------------
/**
 * Strict melody rule (applies in Normal and Piano modes):
 * If pressed MIDI != target.midi => immediate blow-up of the melody target for that lane.
 * If pressed MIDI == target.midi => success.
 */
function handleMelody_Strict(ls, midi, tgt) {
    if (midi === tgt.midi) {
        removeActiveTargetFromQueue(ls.id);
        popSuccess(ls.id, tgt);
    }
    else {
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
function handleChord_Strict(ls, midi, tgt) {
    const tones = new Set(tgt.mids);
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
        ls.chordRuntime = { activeId: tgt.id, windowStartMs: nowMs(), collected: new Set() };
        // Schedule timeout
        const startedAt = ls.chordRuntime.windowStartMs;
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
function chordTimeoutCheck(lane, targetId, startedAt) {
    const ls = getLaneState(lane);
    if (!ls || !ls.enabled)
        return;
    const tgt = activeTarget(lane);
    // Only act if the same chord is still active and window hasn't succeeded
    if (!tgt || tgt.kind !== 'chord' || tgt.id !== targetId)
        return;
    // If 100ms elapsed and not all tones collected -> fail
    const rt = ls.chordRuntime;
    if (!rt || rt.activeId !== targetId)
        return;
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
export function gameTickLoop(currentMs) {
    const { level } = getGameMode();
    const lanes = _isPianoOn() ? ['bass', 'treble'] : ['mono'];
    for (const lane of lanes) {
        const ls = getLaneState(lane);
        if (!ls || !ls.enabled)
            continue;
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
function nextMelodyTargetInRange(range) {
    const prevMidi = getLastMelodyMidiFromAnySource(range); // TODO: track last melody midi per lane
    const base = (typeof prevMidi === 'number') ? prevMidi : seedInRange(range.min, range.max);
    const stepChoices = [-2, -2, -1, -1, 1, 1, 2, 2, 3, -3]; // bias small steps
    const step = stepChoices[Math.floor(Math.random() * stepChoices.length)];
    const midi = clamp(base + step, range.min, range.max);
    return { kind: 'melody', midi, id: makeId() };
}
/**
 * Chord generator: triads in range; fit tones into lane range (drop/add octaves).
 * De-duplicate mids; ensure all tones are within [min, max].
 */
function nextChordTargetInRange(range) {
    const root = pickChordRootInRange(range.min, range.max);
    const quality = pick(['maj', 'min']);
    const tones = buildTriad(root, quality);
    const fitted = fitChordToRange(tones, range.min, range.max);
    const mids = Array.from(new Set(fitted));
    return { kind: 'chord', mids, id: makeId() };
}
// --------------------------- INITIALIZATION ---------------------------
/**
 * Initialize lane states based on game mode
 */
function initializeLanes() {
    const { level } = getGameMode();
    // Clear existing lanes
    laneStates.clear();
    // At level/start when Piano Mode turns ON, ensure per-clef counters exist
    if (_isPianoOn()) {
        if (typeof globalThis.bassLives === 'undefined')
            globalThis.bassLives = typeof globalThis.lives === 'number' ? globalThis.lives : 3;
        if (typeof globalThis.trebleLives === 'undefined')
            globalThis.trebleLives = typeof globalThis.lives === 'number' ? globalThis.lives : 3;
    }
    // Base spawn interval function - gets faster with level
    const baseSpawnInterval = (level) => {
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
            held: new Set(),
            movementSpeedPxPerSec: 100,
            spawnNextAtMs: nowMs() + 2000, // 2 second delay to start
            spawnIntervalMs: baseSpawnInterval,
            spawnIntervalChordMs: (level) => baseSpawnInterval(level) * CHORD_SPAWN_MULTIPLIER,
            range: { min: 21, max: BASS_MAX_MIDI }, // A0 to B3
            chordRuntime: undefined
        });
        laneStates.set('treble', {
            id: 'treble',
            mode: 'melody', // Start with melody mode
            lives: 3,
            enabled: true,
            queue: [],
            held: new Set(),
            movementSpeedPxPerSec: 100,
            spawnNextAtMs: nowMs() + 2000, // 2 second delay to start
            spawnIntervalMs: baseSpawnInterval,
            spawnIntervalChordMs: (level) => baseSpawnInterval(level) * CHORD_SPAWN_MULTIPLIER,
            range: { min: TREBLE_MIN_MIDI, max: 108 }, // C4 to C8
            chordRuntime: undefined
        });
    }
    else {
        // Normal Mode: single mono lane
        laneStates.set('mono', {
            id: 'mono',
            mode: 'melody', // Start with melody mode
            lives: 3,
            enabled: true,
            queue: [],
            held: new Set(),
            movementSpeedPxPerSec: 100,
            spawnNextAtMs: nowMs() + 2000, // 2 second delay to start
            spawnIntervalMs: baseSpawnInterval,
            spawnIntervalChordMs: (level) => baseSpawnInterval(level) * CHORD_SPAWN_MULTIPLIER,
            range: { min: 21, max: 108 }, // Full piano range A0 to C8
            chordRuntime: undefined
        });
    }
}
// --------------------------- UTILS (IMPLEMENT OR REPLACE) ---------------------------
function clamp(x, lo, hi) {
    return Math.min(hi, Math.max(lo, x));
}
function seedInRange(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function makeId() {
    return Math.random().toString(36).slice(2);
}
// TODO: implement these generators
function getLastMelodyMidiFromAnySource(range) {
    // For now, return undefined to force random seeding
    return undefined;
}
function pickChordRootInRange(min, max) {
    return seedInRange(min, Math.min(max, min + 12)); // Keep chord root within an octave of min
}
function buildTriad(root, quality) {
    const intervals = quality === 'maj' ? [0, 4, 7] : [0, 3, 7]; // Major: root, M3, P5; Minor: root, m3, P5
    return intervals.map(interval => root + interval);
}
function fitChordToRange(tones, min, max) {
    return tones.map(tone => {
        // Transpose to fit in range by octaves
        while (tone < min)
            tone += 12;
        while (tone > max)
            tone -= 12;
        return tone;
    }).filter(tone => tone >= min && tone <= max);
}
// Export the key functions for integration - remove duplicates
export { routeLane, initializeLanes, getLaneState, updateLaneState };
// Expose lane system functions globally
globalThis.laneSystem = {
    gameTickLoop,
    initializeLanes,
    handleMidiNoteOn,
    routeLane,
    getLaneState,
    updateLaneState
};
//# sourceMappingURL=lane-system.js.map