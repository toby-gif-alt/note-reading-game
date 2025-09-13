/**
 * Lane-based Note Reading Game System
 * Implements the full specification from the problem statement
 */
type LaneId = 'bass' | 'treble' | 'mono';
type Mode = 'melody' | 'chord';
type MelodyTarget = {
    kind: 'melody';
    midi: number;
    id: string;
};
type ChordTarget = {
    kind: 'chord';
    mids: number[];
    id: string;
};
type Target = MelodyTarget | ChordTarget;
type LaneState = {
    id: LaneId;
    mode: Mode;
    lives: number;
    enabled: boolean;
    queue: Target[];
    held: Set<number>;
    movementSpeedPxPerSec: number;
    spawnNextAtMs: number;
    spawnIntervalMs: (level: number) => number;
    spawnIntervalChordMs: (level: number) => number;
    range: {
        min: number;
        max: number;
    };
    chordRuntime?: {
        activeId: string | null;
        windowStartMs: number | null;
        collected: Set<number>;
    };
};
declare function getLaneState(lane: LaneId): LaneState | undefined;
declare function updateLaneState(lane: LaneId, patch: Partial<LaneState>): void;
declare function routeLane(midi: number, pianoModeActive: boolean): LaneId;
/**
 * Call this from your low-level MIDI NoteOn handler:
 * onMidiNoteOn(midi, velocity) { handleMidiNoteOn(midi, velocity); }
 */
export declare function handleMidiNoteOn(midi: number, velocity: number): void;
/**
 * Movement speed is constant per lane; do NOT vary per target.
 * Density/difficulty is controlled by spawn cadence.
 * In chord mode, the cadence is slower by CHORD_SPAWN_MULTIPLIER.
 */
export declare function gameTickLoop(currentMs: number): void;
/**
 * Initialize lane states based on game mode
 */
declare function initializeLanes(): void;
export { routeLane, initializeLanes, getLaneState, updateLaneState };
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
