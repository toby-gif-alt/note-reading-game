;(function (root, factory) {
  if (typeof module === "object" && module.exports) { module.exports = factory(); }
  else if (typeof define === "function" && define.amd) { define([], factory); }
  else { root.pianoCore = factory(); }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ======== CONSTANTS (do not change) ========
  const BASS_MAX = 59;         // B3
  const TREBLE_MIN = 60;       // C4
  const CHORD_WINDOW_MS = 100; // chord completion window
  const CHORD_SPAWN_MULTIPLIER = 1.25; // spawn cadence slower for chords (movement speed stays constant)

  // ======== TYPES (JSDoc) ========
  /** @typedef {'bass'|'treble'|'mono'} Lane */
  /** @typedef {'melody'|'chord'} Mode */
  /** @typedef {{ kind:'melody', midi:number, id:string }} Melody */
  /** @typedef {{ kind:'chord', mids:number[], id:string }} Chord */
  /** @typedef {Melody|Chord} Target */

  // ======== STATE ========
  const state = {
    piano: false,
    lanes: /** @type {Record<Lane, {
      id:Lane, mode:Mode, lives:number, enabled:boolean,
      queue: Target[], chordRT: null | {activeId:string, started:number, collected:Set<number>},
      movementSpeedPxPerSec:number, // constant per lane (visuals use this; we do not change it here)
      spawnIntervalMs: (level:number)=>number,
      spawnIntervalChordMs: (level:number)=>number,
      range: {min:number, max:number}
    }>} */({
      bass:   { id:'bass',   mode:'melody', lives:3, enabled:true, queue:[], chordRT:null,
                movementSpeedPxPerSec:220, spawnIntervalMs:(lvl)=>800, spawnIntervalChordMs:(lvl)=>Math.round(800*CHORD_SPAWN_MULTIPLIER),
                range:{min:21,max:BASS_MAX} },
      treble: { id:'treble', mode:'melody', lives:3, enabled:true, queue:[], chordRT:null,
                movementSpeedPxPerSec:220, spawnIntervalMs:(lvl)=>800, spawnIntervalChordMs:(lvl)=>Math.round(800*CHORD_SPAWN_MULTIPLIER),
                range:{min:TREBLE_MIN,max:96} },
      mono:   { id:'mono',   mode:'melody', lives:3, enabled:true, queue:[], chordRT:null,
                movementSpeedPxPerSec:220, spawnIntervalMs:(lvl)=>800, spawnIntervalChordMs:(lvl)=>Math.round(800*CHORD_SPAWN_MULTIPLIER),
                range:{min:36,max:84} },
    }),
    level: 1,
    // callbacks (no-ops by default; wire from app)
    cb: {
      onSuccess: /** @param {Lane} lane @param {Target} t */ (lane,t)=>{},
      onFail:    /** @param {Lane} lane @param {Target} t @param {string} why */ (lane,t,why)=>{},
      onLives:   /** @param {Lane} lane @param {number} lives */ (lane,lives)=>{},
      onLaneDisabled: /** @param {Lane} lane */ (lane)=>{},
      onGameOver: /** @param {'piano-both-dead'|'mono-dead'} reason */ (reason)=>{}
    }
  };

  // ======== INIT / CONFIG ========
  /**
   * Initialize per round/level.
   * @param {{ pianoModeActive:boolean, level?:number,
   *   bassLives?:number, trebleLives?:number, monoLives?:number,
   *   modes?: Partial<Record<Lane, Mode>>,
   *   movementSpeedPxPerSec?:number,
   *   spawnIntervalMs?: (level:number)=>number
   * }} opts
   */
  function init(opts){
    state.piano = !!opts.pianoModeActive;
    if (typeof opts.level === 'number') state.level = opts.level;

    const baseSpeed = opts.movementSpeedPxPerSec ?? 220;
    const baseSpawn = opts.spawnIntervalMs ?? ((lvl)=>Math.max(300, 900 - (lvl*30)));

    /** @type {Lane[]} */ (['bass','treble','mono']).forEach((k)=>{
      const ls = state.lanes[k];
      ls.movementSpeedPxPerSec = baseSpeed;
      ls.spawnIntervalMs = baseSpawn;
      ls.spawnIntervalChordMs = (lvl)=>Math.round(baseSpawn(lvl)*CHORD_SPAWN_MULTIPLIER);
      ls.queue = [];
      ls.chordRT = null;
      if (k==='bass')   ls.lives = opts.bassLives  ?? ls.lives;
      if (k==='treble') ls.lives = opts.trebleLives?? ls.lives;
      if (k==='mono')   ls.lives = opts.monoLives  ?? ls.lives;
      ls.enabled = ls.lives > 0;
      if (opts.modes && opts.modes[k]) ls.mode = /** @type {Mode} */(opts.modes[k]);
    });
  }

  /** Optional: wire UI/FX callbacks */
  function configureCallbacks(cbs){
    state.cb = Object.assign({}, state.cb, cbs||{});
  }

  // ======== ROUTING ========
  /** @param {number} midi @returns {Lane} */
  function routeLane(midi){
    return state.piano ? (midi <= BASS_MAX ? 'bass' : 'treble') : 'mono';
  }

  // ======== TARGET MANIP ========
  /** @param {Lane} l @param {Target} t */
  function pushTarget(l, t){ state.lanes[l].queue.push(t); }
  /** @param {Lane} l @param {Mode} m */ function setLaneMode(l,m){ state.lanes[l].mode = m; }
  /** @param {Lane} l */ function lane(l){ return state.lanes[l]; }

  // ======== LIFE / RESOLUTION HELPERS ========
  function popSuccessLane(ls){
    const t = ls.queue.shift();
    ls.chordRT = null;
    state.cb.onSuccess(ls.id, /** @type {Target} */(t));
  }
  function popFailLane(ls, why){
    const t = ls.queue.shift();
    ls.chordRT = null;
    ls.lives -= 1;
    state.cb.onLives(ls.id, ls.lives);
    state.cb.onFail(ls.id, /** @type {Target} */(t), why);
    if (ls.lives <= 0) {
      ls.enabled = false;
      state.cb.onLaneDisabled(ls.id);
      if (state.piano) {
        if (!state.lanes.bass.enabled && !state.lanes.treble.enabled) {
          state.cb.onGameOver('piano-both-dead');
        }
      } else {
        state.cb.onGameOver('mono-dead');
      }
    }
  }

  // ======== EVALUATORS ========
  // Strict melody: any non-target note in that lane -> immediate fail.
  function evalMelody(ls, midi){
    const t = /** @type {Melody|undefined} */(ls.queue[0]);
    if (!t || t.kind !== 'melody') return;
    if (midi === t.midi) popSuccessLane(ls);
    else popFailLane(ls, 'melody-wrong-note');
  }

  // Chord: window starts at first correct tone; any stray (non-member) while active -> immediate fail.
  function evalChord(ls, midi){
    const t = /** @type {Chord|undefined} */(ls.queue[0]);
    if (!t || t.kind !== 'chord') return;
    const tones = new Set(t.mids);

    // immediate stray fail
    if (!tones.has(midi)) return popFailLane(ls, 'chord-stray');

    // member pressed
    if (!ls.chordRT || ls.chordRT.activeId !== t.id) {
      ls.chordRT = { activeId: t.id, started: performance.now(), collected: new Set() };
      setTimeout(() => {
        const head = ls.queue[0];
        if (!head || head.kind !== 'chord' || head.id !== t.id) return;
        if (!ls.chordRT || ls.chordRT.collected.size < tones.size) popFailLane(ls, 'chord-timeout');
      }, CHORD_WINDOW_MS + 10);
    }
    ls.chordRT.collected.add(midi);
    if (ls.chordRT.collected.size === tones.size) popSuccessLane(ls);
  }

  // ======== MIDI ENTRY ========
  /** Call this from your MIDI NoteOn handler */
  function onNoteOn(midi, velocity){
    const l = routeLane(midi);
    const ls = state.lanes[l];
    if (!ls.enabled) return;
    if (ls.mode === 'melody') evalMelody(ls, midi);
    else evalChord(ls, midi);
  }

  // ======== SMALL AUTOTEST to verify in DevTools ========
  function __devAutoTest(){
    // set up: piano on, treble melody E5, bass chord C2-E2-G2
    init({ pianoModeActive:true, bassLives:2, trebleLives:2, modes:{ bass:'chord', treble:'melody' } });
    pushTarget('treble', { kind:'melody', midi:76, id:'T1' }); // E5
    pushTarget('bass',   { kind:'chord',  mids:[36,40,43], id:'B1' }); // C2-E2-G2
    const log = [];
    configureCallbacks({
      onSuccess:(lane,t)=>log.push({event:'success', lane, t}),
      onFail:(lane,t,why)=>log.push({event:'fail', lane, why, t}),
      onLives:(lane,lives)=>log.push({event:'lives', lane, lives}),
      onLaneDisabled:(lane)=>log.push({event:'lane-disabled', lane}),
      onGameOver:(why)=>log.push({event:'game-over', why}),
    });
    // wrong treble -> fail
    onNoteOn(77, 100);
    // correct treble -> success
    pushTarget('treble', { kind:'melody', midi:76, id:'T2' });
    onNoteOn(76, 100);
    // chord success within 100ms
    onNoteOn(36,100); setTimeout(()=>onNoteOn(40,100), 30); setTimeout(()=>onNoteOn(43,100), 60);
    // new chord stray -> fail
    setTimeout(()=>{
      pushTarget('bass', { kind:'chord', mids:[36,40,43], id:'B2' });
      onNoteOn(41,100);
      // report
      console.table(log);
      return log;
    }, 150);
  }

  return {
    // constants for other modules if needed
    CLEF_SPLIT: { BASS_MAX, TREBLE_MIN, CHORD_WINDOW_MS, CHORD_SPAWN_MULTIPLIER },
    init, configureCallbacks, routeLane, pushTarget, setLaneMode, onNoteOn, lane, __devAutoTest
  };
});