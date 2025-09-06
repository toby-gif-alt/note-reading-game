# MIDI Keyboard Support for Note Reading Game

This document explains how to use MIDI keyboard support in the Note Reading Game ("Stave Wars").

## Features

### ✅ Implemented Features

- **Automatic MIDI Device Detection**: The game automatically detects connected MIDI keyboards using the Web MIDI API
- **Device Selection**: Choose from multiple connected MIDI devices via dropdown menus
- **Note Input Processing**: MIDI keyboard presses are converted to note letters (A-G) and integrated with the game's existing input system
- **Visual Feedback**: On-screen note buttons highlight when corresponding MIDI notes are played
- **Persistent Settings**: MIDI device preferences are saved and restored between game sessions
- **Real-time Status Updates**: Live connection status showing available devices
- **Error Handling**: Graceful fallback when MIDI is not supported or devices are unavailable
- **TypeScript Support**: Core MIDI functionality is written in TypeScript with proper type safety
- **Comprehensive Testing**: Test suite validates MIDI conversion logic and integration

## How to Use

### Prerequisites

1. **Browser Support**: Use a modern browser that supports the Web MIDI API:
   - Chrome/Chromium (recommended)
   - Edge
   - Opera
   - Safari (limited support)
   - Firefox (requires enabling `dom.webmidi.enabled` in about:config)

2. **MIDI Device**: Connect a MIDI keyboard or controller to your computer via USB or MIDI interface

### Setup Instructions

1. **Connect Your MIDI Device**
   - Plug in your MIDI keyboard before opening the game
   - Ensure your device is recognized by your operating system

2. **Open the Game Menu**
   - Navigate to the game menu (menu.html)
   - Look for MIDI device controls in the options modal

3. **Select Your Device**
   - If devices are detected, they will appear in the dropdown menu
   - Select your preferred MIDI device from the list
   - The status indicator will show "Connected: [Device Name]" when successful

4. **Start Playing**
   - Launch the game normally
   - Play notes on your MIDI keyboard to answer note identification challenges
   - The game accepts both keyboard/mouse input and MIDI input simultaneously

### Game Integration

- **Note Input**: Press any key on your MIDI keyboard corresponding to the correct note (A, B, C, D, E, F, G)
- **Sharp/Flat Notes**: Sharp and flat notes are automatically converted to their natural note equivalents
- **Visual Feedback**: On-screen buttons will briefly highlight green when MIDI notes are played
- **Octaves**: Any octave will work - the game focuses on note names rather than specific octaves

## Technical Details

### Architecture

The MIDI system consists of several TypeScript modules:

- `midi-types.ts`: Type definitions for MIDI functionality
- `midi-manager.ts`: Core MIDI device management and Web MIDI API integration
- `midi-utils.ts`: Utility functions for note conversion and validation
- `midi-integration.ts`: Game-specific integration logic
- `midi-menu-integration.ts`: Menu-specific device selection

### Note Conversion

MIDI note numbers are converted to musical note names using the following logic:

```typescript
// Example: MIDI note 60 = C4
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const octave = Math.floor(midiNote / 12) - 1;
const noteIndex = midiNote % 12;
const noteName = noteNames[noteIndex].charAt(0); // Natural note only
```

### Device Management

- Automatic device scanning on page load
- Real-time connection/disconnection monitoring
- Persistent device preferences stored in localStorage
- Graceful handling of device unavailability

## Troubleshooting

### No MIDI Devices Detected

1. **Check Browser Support**: Ensure your browser supports Web MIDI API
2. **Device Connection**: Verify your MIDI device is properly connected and recognized by your OS
3. **Browser Permissions**: Some browsers may require user interaction before accessing MIDI
4. **Try Refreshing**: Reload the page after connecting your device

### MIDI Not Working in Firefox

Firefox requires manual enabling of MIDI support:
1. Navigate to `about:config`
2. Search for `dom.webmidi.enabled`
3. Set the value to `true`
4. Restart Firefox

### Device Connected But Not Responding

1. **Check Device Selection**: Ensure the correct device is selected in the dropdown
2. **Try Reconnecting**: Disconnect and reconnect your MIDI device
3. **Browser Console**: Check for error messages in the browser developer tools
4. **Try Different Browser**: Test with Chrome/Chromium for best compatibility

### Performance Issues

1. **Close Unnecessary Applications**: Other applications using MIDI may interfere
2. **Disable Other Extensions**: Browser extensions might conflict with MIDI access
3. **Use USB Connection**: USB MIDI typically has lower latency than Bluetooth

## Testing

The game includes a comprehensive test suite accessible at `/test-midi.html`. The tests validate:

- MIDI note number to letter conversion
- Device management functionality  
- Event system integration
- Utility function correctness

Run the tests to verify MIDI functionality is working correctly in your browser.

## Browser Compatibility

| Browser | Support Level | Notes |
|---------|---------------|--------|
| Chrome/Chromium | ✅ Full | Recommended browser |
| Microsoft Edge | ✅ Full | Works well |
| Safari | ⚠️ Limited | May require user interaction |
| Firefox | ⚠️ Manual Setup | Requires enabling in about:config |
| Mobile Browsers | ❌ None | Web MIDI API not supported |

## Future Enhancements

Potential improvements for future versions:

- **MIDI Output**: Visual feedback through MIDI device LEDs
- **Velocity Sensitivity**: Use note velocity for gameplay mechanics  
- **Advanced Device Settings**: Custom key mappings and device-specific configurations
- **MIDI Learning Mode**: Record and playback MIDI sequences for practice
- **Multi-device Support**: Simultaneous input from multiple MIDI devices

For technical support or bug reports, please check the game's repository issues section.