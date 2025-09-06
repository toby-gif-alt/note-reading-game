/**
 * Test suite for MIDI functionality in the Note Reading Game
 * Tests MIDI manager, device handling, and integration logic
 */
import { MidiManager } from '../midi-manager.js';
import { midiNoteToMapping, scientificToMidi } from '../midi-utils.js';
// Mock Web MIDI API for testing
class MockMIDIAccess {
    constructor() {
        this.inputs = new Map();
        this.outputs = new Map();
        this.onstatechange = null;
    }
    // Helper method to simulate device connection
    simulateDeviceConnection(device) {
        this.inputs.set(device.id, device);
        if (this.onstatechange) {
            this.onstatechange({ port: device });
        }
    }
}
class MockMIDIInput {
    constructor(id, name, manufacturer = 'Test') {
        this.id = id;
        this.name = name;
        this.manufacturer = manufacturer;
        this.state = 'connected';
        this.connection = 'open';
        this.type = 'input';
        this.onmidimessage = null;
    }
    // Helper method to simulate MIDI message
    simulateMessage(status, note, velocity) {
        if (this.onmidimessage) {
            const event = {
                data: new Uint8Array([status, note, velocity]),
                timeStamp: Date.now()
            };
            this.onmidimessage(event);
        }
    }
}
// Test suite
class MidiTestSuite {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }
    test(name, testFn) {
        this.tests.push({ name, testFn });
    }
    async run() {
        console.log('🎹 Running MIDI Test Suite...\n');
        for (const { name, testFn } of this.tests) {
            try {
                await testFn();
                console.log(`✅ ${name}`);
                this.passed++;
            }
            catch (error) {
                console.error(`❌ ${name}: ${error.message}`);
                this.failed++;
            }
        }
        console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);
        return this.failed === 0;
    }
    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }
    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message}: Expected ${expected}, got ${actual}`);
        }
    }
}
// Mock global navigator for testing
const originalNavigator = globalThis.navigator;
globalThis.navigator = {
    ...originalNavigator,
    requestMIDIAccess: () => Promise.resolve(new MockMIDIAccess())
};
// Create test suite
const testSuite = new MidiTestSuite();
// Test: MIDI note conversion
testSuite.test('MIDI Note Conversion', () => {
    // Test scientific notation to MIDI conversion
    testSuite.assertEqual(scientificToMidi('C', 4), 60, 'C4 should be MIDI note 60');
    testSuite.assertEqual(scientificToMidi('A', 4), 69, 'A4 should be MIDI note 69');
    testSuite.assertEqual(scientificToMidi('G', 5), 79, 'G5 should be MIDI note 79');
    // Test MIDI to note mapping conversion
    const c4Mapping = midiNoteToMapping(60);
    testSuite.assertEqual(c4Mapping.noteName, 'C', 'MIDI 60 should be note C');
    testSuite.assertEqual(c4Mapping.octave, 4, 'MIDI 60 should be octave 4');
    testSuite.assertEqual(c4Mapping.scientific, 'C4', 'MIDI 60 should be C4 scientific');
    const a4Mapping = midiNoteToMapping(69);
    testSuite.assertEqual(a4Mapping.noteName, 'A', 'MIDI 69 should be note A');
    testSuite.assertEqual(a4Mapping.octave, 4, 'MIDI 69 should be octave 4');
    // Test sharp note handling (should return natural note)
    const cSharpMapping = midiNoteToMapping(61); // C#4
    testSuite.assertEqual(cSharpMapping.noteName, 'C', 'C# should map to natural C');
});
// Test: Device Management
testSuite.test('Device Management', async () => {
    const manager = new MidiManager();
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    const status = manager.getStatus();
    testSuite.assert(status.isSupported, 'MIDI should be supported');
    testSuite.assert(status.isEnabled, 'MIDI should be enabled');
    // Initially no devices
    testSuite.assertEqual(status.connectedDevices.length, 0, 'Should have no devices initially');
});
// Test: Note Input Callback
testSuite.test('Note Input Callback', async () => {
    const manager = new MidiManager();
    let receivedNote = null;
    // Register callback
    manager.onNoteInput((mapping) => {
        receivedNote = mapping.noteName;
    });
    // Mock device connection and message
    const mockDevice = new MockMIDIInput('test1', 'Test Keyboard');
    // Simulate device connection (this would normally trigger through the mocked MIDI access)
    manager.addDevice(mockDevice);
    manager.selectDevice('test1');
    // Simulate note-on message for C4 (MIDI 60)
    mockDevice.simulateMessage(0x90, 60, 100); // Note on, C4, velocity 100
    await new Promise(resolve => setTimeout(resolve, 50));
    testSuite.assertEqual(receivedNote, 'C', 'Should receive C note from MIDI input');
});
// Test: Event System
testSuite.test('Event System', async () => {
    const manager = new MidiManager();
    let deviceConnectedCalled = false;
    let noteOnCalled = false;
    manager.on('deviceConnected', (device) => {
        deviceConnectedCalled = true;
    });
    manager.on('noteOn', (midiNote, mapping) => {
        noteOnCalled = true;
    });
    // Simulate events
    const mockDevice = new MockMIDIInput('test2', 'Test Piano');
    manager.addDevice(mockDevice);
    testSuite.assert(deviceConnectedCalled, 'deviceConnected event should be fired');
    manager.selectDevice('test2');
    mockDevice.simulateMessage(0x90, 69, 100); // A4
    await new Promise(resolve => setTimeout(resolve, 50));
    testSuite.assert(noteOnCalled, 'noteOn event should be fired');
});
// Test: Integration Functions
testSuite.test('Integration Functions', () => {
    // Test that functions are available globally
    testSuite.assert(typeof window.handleDeviceSelection === 'function', 'handleDeviceSelection should be globally available');
    // Test device selection with invalid ID
    const result = window.handleDeviceSelection('invalid-device-id');
    // Should not throw error
    testSuite.assert(true, 'handleDeviceSelection with invalid ID should not crash');
});
// Utility function tests
testSuite.test('Utility Functions', () => {
    // Test edge cases
    testSuite.assertEqual(scientificToMidi('C', 0), 12, 'C0 should be MIDI note 12');
    testSuite.assertEqual(scientificToMidi('B', -1), 11, 'B-1 should be MIDI note 11');
    // Test mapping edge cases
    const lowNote = midiNoteToMapping(0); // C-1
    testSuite.assertEqual(lowNote.noteName, 'C', 'MIDI 0 should be C');
    testSuite.assertEqual(lowNote.octave, -1, 'MIDI 0 should be octave -1');
    const highNote = midiNoteToMapping(127); // G9
    testSuite.assertEqual(highNote.noteName, 'G', 'MIDI 127 should be G');
    testSuite.assertEqual(highNote.octave, 9, 'MIDI 127 should be octave 9');
});
// Export test suite for running
export { testSuite, MidiTestSuite };
// Auto-run tests if this is the main module
if (typeof window !== 'undefined' && window.location?.pathname.includes('test')) {
    testSuite.run().then(success => {
        if (success) {
            console.log('🎉 All MIDI tests passed!');
        }
        else {
            console.log('❌ Some MIDI tests failed.');
        }
    });
}
//# sourceMappingURL=midi-tests.js.map