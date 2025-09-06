/**
 * Test suite for MIDI functionality in the Note Reading Game
 * Tests MIDI manager, device handling, and integration logic
 */
declare class MidiTestSuite {
    constructor();
    test(name: any, testFn: any): void;
    run(): Promise<boolean>;
    assert(condition: any, message: any): void;
    assertEqual(actual: any, expected: any, message: any): void;
}
declare const testSuite: MidiTestSuite;
export { testSuite, MidiTestSuite };
