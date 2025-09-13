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
globalThis.settings = globalThis.settings || {};
const settings = globalThis.settings;
if (typeof settings.pianoMode === 'undefined')
    settings.pianoMode = false;
if (typeof settings.strictOctave === 'undefined')
    settings.strictOctave = false;
// Per-clef play mode: 'normal' | 'chord' | 'melody'
settings.playMode = settings.playMode || { bass: 'normal', treble: 'normal' };
// === Simple speed curve (px/s) ===
function speedForLevel(level) {
    const base = 220;
    const inc = 15;
    const v = base + inc * Math.max(0, Number(level || 0));
    return Math.min(520, Math.max(160, v));
}
// === Routing ===
function pianoOn() {
    return !!(typeof globalThis.pianoModeActive !== 'undefined' ? globalThis.pianoModeActive : settings.pianoMode);
}
function routeClef(midi) {
    return midi <= BASS_MAX_MIDI ? 'bass' : 'treble';
}
// === Match function (strict octave toggle) ===
function matchesTarget(midi, targetMidi) {
    if (settings.strictOctave)
        return midi === targetMidi;
    return (midi % 12) === (targetMidi % 12);
}
// === Piano Mode split (B3/C4) ===
function _routeClefByMidi(midi) {
    return midi <= BASS_MAX_MIDI ? 'bass' : 'treble';
}
function _isPianoOn() {
    // Prefer existing flag; fall back to settings if present
    return !!(typeof globalThis.pianoModeActive !== 'undefined' ? globalThis.pianoModeActive : (globalThis.gameSettings && globalThis.gameSettings.pianoMode));
}
// === Lane state (one-at-a-time queues) ===
const lanes = {
    bass: { active: null, phraseIndex: 0, phraseSize: 0 },
    treble: { active: null, phraseIndex: 0, phraseSize: 0 },
    mono: { active: null, phraseIndex: 0, phraseSize: 0 }, // used when piano is OFF
};
function laneForPlay() { return pianoOn() ? ['bass', 'treble'] : ['mono']; }
function clearLane(l) {
    lanes[l].active = null;
    lanes[l].phraseIndex = 0;
    lanes[l].phraseSize = 0;
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
// --------------------------- SPAWNING (single active target; auto after resolve) ---------------------------
function spawnX() {
    const w = (typeof globalThis.getCanvasWidth === 'function') ? globalThis.getCanvasWidth() : (globalThis.window?.innerWidth || 1024);
    return Math.round(w * (1 - RIGHT_MARGIN_FRAC)); // right edge with margin
}
// Build next target for a lane based on its playMode
function buildNextTarget(lane) {
    const mode = pianoOn() ? (globalThis.settings.playMode[lane] || 'normal') : 'normal';
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
function spawnNext(lane) {
    if (lanes[lane].active)
        return; // one at a time
    const t = buildNextTarget(lane);
    lanes[lane].active = t;
    if (t.kind === 'melodyPhrase') {
        lanes[lane].phraseIndex = 0;
        lanes[lane].phraseSize = t.mids.length;
    }
    const speed = speedForLevel(globalThis.gameLevel || globalThis.level || 1);
    // Map this to your real visual spawn call
    spawnVisualTarget(lane, t, { x: spawnX(), speedPxPerSec: speed });
}
// Call this when a target finishes (success/fail/miss). It auto-spawns the next one.
function resolveAndRespawn(lane, result) {
    // Remove visuals for the resolved target (map to your renderer)
    if (typeof globalThis.removeVisualTarget === 'function') {
        globalThis.removeVisualTarget(lane, lanes[lane].active);
    }
    lanes[lane].active = null;
    lanes[lane].phraseIndex = 0;
    lanes[lane].phraseSize = 0;
    // Immediately spawn the next
    spawnNext(lane);
}
function spawnVisualTarget(lane, target, options) {
    // Map to existing game's spawn system
    if (typeof globalThis.createLaneTarget === 'function') {
        globalThis.createLaneTarget(lane, target);
    }
    else if (typeof globalThis.spawnNoteForLane === 'function') {
        globalThis.spawnNoteForLane(lane, target, options);
    }
    else {
        // Fallback to creating a visual target in movingNotes array
        const movingNotes = globalThis.movingNotes;
        if (movingNotes && Array.isArray(movingNotes)) {
            if (target.kind === 'melody') {
                // Create a single note
                const note = globalThis.midiToNote ? globalThis.midiToNote(target.midi) : { note: 'C', octave: 4 };
                movingNotes.push({
                    clef: lane === 'mono' ? (globalThis.currentClef || 'treble') : lane,
                    note: note.note,
                    octave: note.octave,
                    midiNote: target.midi,
                    id: target.id,
                    x: options.x,
                    speed: options.speedPxPerSec / 60, // convert to px per frame assuming 60fps
                    kind: 'melody'
                });
            }
            else if (target.kind === 'chord') {
                // Create a chord target
                movingNotes.push({
                    clef: lane === 'mono' ? (globalThis.currentClef || 'treble') : lane,
                    kind: 'chord',
                    mids: target.mids,
                    id: target.id,
                    x: options.x,
                    speed: options.speedPxPerSec / 60,
                    isChord: true
                });
            }
            else if (target.kind === 'melodyPhrase') {
                // Create a phrase target (for now, show first note)
                const firstMidi = target.mids[0];
                const note = globalThis.midiToNote ? globalThis.midiToNote(firstMidi) : { note: 'C', octave: 4 };
                movingNotes.push({
                    clef: lane === 'mono' ? (globalThis.currentClef || 'treble') : lane,
                    note: note.note,
                    octave: note.octave,
                    midiNote: firstMidi,
                    id: target.id,
                    x: options.x,
                    speed: options.speedPxPerSec / 60,
                    kind: 'melodyPhrase',
                    mids: target.mids,
                    phraseIndex: 0
                });
            }
        }
    }
}
// --------------------------- GENERATORS (RANGE-SAFE & PHRASE-LIKE) ---------------------------
function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}
function laneRange(lane) {
    if (!pianoOn() || lane === 'mono')
        return { min: 36, max: 84 }; // keep your previous overall range
    return lane === 'bass' ? { min: 21, max: BASS_MAX_MIDI } : { min: TREBLE_MIN_MIDI, max: 96 };
}
function nextSingleNoteInRange(lane) {
    const r = laneRange(lane);
    const steps = [-2, -1, -1, 1, 1, 2, 2, 3, -3];
    const base = Math.round((r.min + r.max) / 2);
    const pick = base + steps[Math.floor(Math.random() * steps.length)];
    return clamp(pick, r.min, r.max);
}
function nextChordInRange(lane) {
    const r = laneRange(lane);
    // simple triad root selection inside range
    const root = clamp(r.min + Math.floor(Math.random() * (r.max - r.min - 7)), r.min, r.max - 7);
    const tones = [root, root + 4, root + 7].filter(n => n >= r.min && n <= r.max);
    return Array.from(new Set(tones));
}
function nextMelodyPhraseInRange(lane) {
    const r = laneRange(lane);
    const size = 3 + Math.floor(Math.random() * 3); // 3..5
    const arr = [];
    let cur = Math.round((r.min + r.max) / 2);
    for (let i = 0; i < size; i++) {
        const step = [-2, -1, 1, 2, 2, -2, 1, -1, 3, -3][Math.floor(Math.random() * 10)];
        cur = clamp(cur + step, r.min, r.max);
        arr.push(cur);
    }
    return arr;
}
// --------------------------- MIDI EVALUATION BRIDGE (ONE LANE AT A TIME) ---------------------------
function handleNoteOnOneAtATime(midi, velocity) {
    var _a, _b;
    const lanesToCheck = pianoOn() ? ['bass', 'treble'] : ['mono'];
    const targetLane = pianoOn() ? routeClef(midi) : 'mono';
    const L = targetLane;
    if (!lanes[L].active) { // lane empty → spawn first
        spawnNext(L);
    }
    const t = lanes[L].active;
    if (!t)
        return;
    // Melody (single)
    if (t.kind === 'melody') {
        if (matchesTarget(midi, t.midi)) {
            onSuccess && onSuccess(L, t); // map to your success FX/score
            resolveAndRespawn(L, 'success');
        }
        else {
            onFail && onFail(L, t, 'melody-wrong'); // FX
            decrementLivesForLane(L); // map to your lives system
            resolveAndRespawn(L, 'fail');
        }
        return;
    }
    // Chord (single chord target, one at a time)
    if (t.kind === 'chord') {
        // transient window start + collected stored on lanes object
        (_a = lanes[L]).__chordStart ?? (_a.__chordStart = null);
        (_b = lanes[L]).__chordHits ?? (_b.__chordHits = new Set());
        const tones = new Set(t.mids);
        if (!tones.has(midi)) {
            onFail && onFail(L, t, 'chord-stray');
            decrementLivesForLane(L);
            lanes[L].__chordHits.clear();
            lanes[L].__chordStart = null;
            resolveAndRespawn(L, 'fail');
            return;
        }
        if (lanes[L].__chordStart === null) {
            const started = performance.now();
            lanes[L].__chordStart = started;
            lanes[L].__chordHits.clear();
            setTimeout(() => {
                const still = lanes[L].active;
                if (!still || still.id !== t.id || still.kind !== 'chord')
                    return;
                if (lanes[L].__chordStart !== started)
                    return;
                if (lanes[L].__chordHits.size < tones.size) {
                    onFail && onFail(L, t, 'chord-timeout');
                    decrementLivesForLane(L);
                    lanes[L].__chordHits.clear();
                    lanes[L].__chordStart = null;
                    resolveAndRespawn(L, 'fail');
                }
            }, 100);
        }
        lanes[L].__chordHits.add(midi);
        if (lanes[L].__chordHits.size === tones.size) {
            onSuccess && onSuccess(L, t);
            lanes[L].__chordHits.clear();
            lanes[L].__chordStart = null;
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
        }
        else {
            onFail && onFail(L, t, 'phrase-wrong');
            decrementLivesForLane(L);
            resolveAndRespawn(L, 'fail');
        }
        return;
    }
}
// Success/fail/phrase point callback placeholders (map to your existing functions)
const onSuccess = globalThis.onSuccess || function (lane, target) {
    console.log('Success:', lane, target);
};
const onFail = globalThis.onFail || function (lane, target, reason) {
    console.log('Fail:', lane, target, reason);
};
const addPhrasePoint = globalThis.addPhrasePoint || function (lane) {
    console.log('Phrase point:', lane);
};
function decrementLivesForLane(lane) {
    if (!pianoOn()) {
        if (typeof globalThis.lives === 'number') {
            globalThis.lives = Math.max(0, globalThis.lives - 1);
            if (typeof globalThis.updateLives === 'function') {
                globalThis.updateLives(globalThis.lives);
            }
        }
        return;
    }
    if (lane === 'bass') {
        globalThis.bassLives = Math.max(0, (globalThis.bassLives || 0) - 1);
        if (typeof globalThis.updateLivesUI === 'function') {
            globalThis.updateLivesUI('bass', globalThis.bassLives);
        }
    }
    if (lane === 'treble') {
        globalThis.trebleLives = Math.max(0, (globalThis.trebleLives || 0) - 1);
        if (typeof globalThis.updateLivesUI === 'function') {
            globalThis.updateLivesUI('treble', globalThis.trebleLives);
        }
    }
    if ((globalThis.bassLives || 0) <= 0 && globalThis.disableBassLane)
        globalThis.disableBassLane();
    if ((globalThis.trebleLives || 0) <= 0 && globalThis.disableTrebleLane)
        globalThis.disableTrebleLane();
    if ((globalThis.bassLives || 0) <= 0 && (globalThis.trebleLives || 0) <= 0 && globalThis.stopGame)
        globalThis.stopGame('piano-both-dead');
}
// Expose the new one-at-a-time handler
globalThis.handleNoteOnOneAtATime = handleNoteOnOneAtATime;
// --------------------------- EXISTING GENERATORS (RANGE-SAFE) ---------------------------
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
// --------------------------- UI TOGGLES ---------------------------
// Wire to existing buttons if present; otherwise add keybinds
if (typeof document !== 'undefined') {
    // Strict toggle
    const btnStrict = document.querySelector('#btn-strict');
    if (btnStrict) {
        btnStrict.addEventListener('click', () => {
            globalThis.settings.strictOctave = !globalThis.settings.strictOctave;
            console.log('Strict octave:', globalThis.settings.strictOctave);
        });
    }
    // Piano toggle  
    const btnPiano = document.querySelector('#btn-piano');
    if (btnPiano) {
        btnPiano.addEventListener('click', () => {
            globalThis.settings.pianoMode = !globalThis.settings.pianoMode;
            globalThis.pianoModeActive = globalThis.settings.pianoMode;
            console.log('Piano mode:', globalThis.settings.pianoMode);
        });
    }
    // Optional keybinds (keep if you have no buttons)
    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 's') {
            globalThis.settings.strictOctave = !globalThis.settings.strictOctave;
            console.log('Strict octave:', globalThis.settings.strictOctave);
        }
        if (e.key.toLowerCase() === 'p') {
            globalThis.settings.pianoMode = !globalThis.settings.pianoMode;
            globalThis.pianoModeActive = globalThis.settings.pianoMode;
            console.log('Piano mode:', globalThis.settings.pianoMode);
        }
    });
}
//# sourceMappingURL=lane-system.js.map