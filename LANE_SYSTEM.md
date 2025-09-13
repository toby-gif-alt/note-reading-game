# Lane-Based Note Reading Game System

This document describes the implementation of the lane-based note reading game system as specified in the comprehensive problem statement.

## Overview

The lane-based system transforms the note reading game into a precisely controlled, multi-lane experience with strict melody mode and advanced chord recognition. It supports both Normal Mode (single lane) and Piano Mode (dual lanes with MIDI routing).

## System Architecture

### Core Components

1. **Lane State Management** (`src/midi/lane-system.ts`)
   - Individual lane states with queues, lives, and timing
   - Target management with melody and chord types
   - Spawn cadence control with movement speed separation

2. **MIDI Integration** (`src/midi/midi-integration.ts`)
   - Routes MIDI input to appropriate lanes
   - Integrates with existing Piano Mode infrastructure
   - Maintains backward compatibility with legacy input system

3. **Game Loop Integration** (`script.js`)
   - Integrated lane tick system into main game loop
   - Lane initialization on game start and restart
   - Compatible with existing UI and life management

## Key Features

### Lane System

- **Normal Mode**: Single `mono` lane handles all input
- **Piano Mode**: Dual lanes with MIDI routing:
  - `bass` lane: MIDI ≤ 59 (B3 and below)
  - `treble` lane: MIDI ≥ 60 (C4 and above)

### Strict Melody Mode

- **Immediate Blow-up**: Wrong note presses instantly fail the active target
- **Cross-Lane Independence**: Each lane evaluates independently
- **Life Management**: Separate lives per lane in Piano Mode

### Chord Mode

- **100ms Collection Window**: All chord tones must be pressed within 100ms
- **Stray Note Detection**: Any non-chord note causes immediate failure
- **Timeout Handling**: Incomplete chords after 100ms result in failure
- **Duplicate Tolerance**: Already-collected tones are ignored

### Spawn System

- **Constant Movement Speed**: Per-lane consistent note movement
- **Cadence Control**: Difficulty managed through spawn timing
- **Chord Multiplier**: 1.25x slower spawn rate for chord mode
- **Range-Safe Generation**: Notes generated within lane MIDI ranges

## Implementation Constants

```typescript
const BASS_MAX_MIDI = 59;        // B3
const TREBLE_MIN_MIDI = 60;      // C4  
const CHORD_WINDOW_MS = 100;     // milliseconds
const CHORD_SPAWN_MULTIPLIER = 1.25; // 25% slower spawn rate
```

## Acceptance Criteria Compliance

All specified acceptance criteria have been implemented and verified:

✅ **Normal Mode Strict Melody**: E-F-G queue, pressing F first blows up E immediately  
✅ **Piano Mode Chord Stray**: Bass chord with treble melody, stray bass note fails bass only  
✅ **Piano Mode Treble Strict**: Wrong treble note blows up treble target immediately  
✅ **Chord Completion**: All unique tones required within 100ms window  
✅ **MIDI Routing**: Bass ≤59, Treble ≥60, no cross-credit  
✅ **Movement Speed**: Constant per lane, density controlled by spawn cadence  
✅ **Life Management**: Per-lane lives, game continues when one lane dies  

## Integration Points

### MIDI Input Flow
```
MIDI Note → routeLane() → handleMidiNoteOn() → Lane-specific Logic
```

### Game Loop Integration
```
gameLoop() → laneSystem.gameTickLoop() → Spawn Management & Visual Updates
```

### UI Integration
- Existing Piano Mode UI (lives, clef display)
- Grand Staff visual representation
- Compatible with current scoring system

## Testing

Comprehensive validation tests verify:
- MIDI routing accuracy
- Boundary condition handling
- Lane initialization in both modes
- Strict melody behavior
- Chord stray detection

All tests pass with 100% compliance to specification.

## Future Enhancements

The system is designed to support:
- Advanced chord progressions
- Custom difficulty curves
- Per-lane scoring metrics
- Extended MIDI device support
- Accidentals integration

## Files Modified

- `src/midi/lane-system.ts` - Core lane system implementation
- `src/midi/midi-integration.ts` - MIDI routing integration  
- `script.js` - Game loop integration
- `game.html` - Module loading updates
- `tests/` - Validation test suite