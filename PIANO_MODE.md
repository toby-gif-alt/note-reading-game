# Piano Mode Documentation

Piano Mode is an enhanced game mode that automatically activates when a MIDI keyboard is connected to the game. It provides advanced features designed to improve the learning experience for piano players.

## Features

### 🎹 Automatic Activation
Piano Mode automatically activates when a MIDI device is connected and deactivates when all devices are disconnected.

### 🎼 Enhanced UI Controls
When Piano Mode is active, a control panel appears in the top-right corner of the game with the following options:

- **Chord Mode**: Allows playing multiple notes simultaneously (future enhancement)
- **Include Accidentals**: Enables sharp (♯) and flat (♭) notes in the game (future enhancement)
- **Force Grand Staff**: Automatically switches to Grand Staff view for full piano range (enabled by default)

### 🎵 Menu Integration
The pre-game modal displays a "Piano Mode Ready!" indicator when MIDI devices are detected, informing players that enhanced features are available.

## Technical Implementation

### File Structure
- `src/midi/midi-types.ts` - Extended with Piano Mode interfaces
- `src/midi/midi-integration.ts` - Core Piano Mode logic and UI management
- `src/midi/midi-utils.ts` - Enhanced MIDI note utilities
- `game.html` - Piano Mode UI elements
- `menu.html` - Piano Mode status indicator
- `style.css` - Piano Mode styling
- `menu-style.css` - Menu Piano Mode styling
- `script.js` - Game integration with Piano Mode
- `menu.js` - Menu Piano Mode integration

### Settings Persistence
Piano Mode settings are automatically saved to localStorage and restored when the application loads.

### Event Flow
1. MIDI device connection detected
2. Piano Mode activated automatically
3. UI controls appear
4. Game logic enhanced with Piano Mode features
5. Settings persist across sessions

## Usage

1. Connect a MIDI keyboard to your computer
2. Open the game in a modern web browser
3. Grant MIDI access permission when prompted
4. Piano Mode automatically activates
5. Configure options using the Piano Mode control panel
6. Enjoy enhanced musical learning experience!

## Future Enhancements

- **Chord Mode**: Full implementation of simultaneous note recognition
- **Accidentals Support**: Sharp and flat note generation and recognition
- **Advanced Scoring**: Piano Mode specific scoring algorithms
- **Real-time Feedback**: Visual feedback for chord progressions
- **Practice Modes**: Specific exercises for piano players