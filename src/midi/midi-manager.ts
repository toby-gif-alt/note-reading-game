/**
 * MIDI Manager for Note Reading Game
 * Handles Web MIDI API integration, device management, and note input processing
 */

import {
  MidiDevice,
  MidiNote,
  MidiNoteMapping,
  MidiConnectionStatus,
  MidiInputCallback,
  MidiManagerEvents
} from './midi-types.js';

import { midiNoteToMapping, isNaturalNote } from './midi-utils.js';

export class MidiManager {
  private midiAccess: MIDIAccess | null = null;
  private connectedDevices = new Map<string, MidiDevice>();
  private selectedDeviceId: string | null = null;
  private inputCallbacks: MidiInputCallback[] = [];
  private eventListeners = new Map<keyof MidiManagerEvents, Function[]>();

  constructor() {
    this.initializeMidi();
  }

  private async initializeMidi(): Promise<void> {
    try {
      if (!navigator.requestMIDIAccess) {
        console.warn('Web MIDI API not supported in this browser');
        return;
      }
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.setupDeviceMonitoring();
      this.scanForDevices();
      console.log('MIDI system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MIDI:', error);
      this.emitStatusChange({ lastError: `MIDI initialization failed: ${(error as Error).message}` });
    }
  }

  private setupDeviceMonitoring(): void {
    if (!this.midiAccess) return;
    this.midiAccess.onstatechange = (event: MIDIConnectionEvent) => {
      const port = event.port;
      if (port && port.type === 'input') {
        if (port.state === 'connected') this.addDeviceInternal(port as MIDIInput);
        else if (port.state === 'disconnected') this.removeDevice(port.id);
      }
    };
  }

  private scanForDevices(): void {
    if (!this.midiAccess) return;
    this.midiAccess.inputs.forEach((input: MIDIInput) => {
      if (input.state === 'connected') this.addDeviceInternal(input);
    });
  }

  public addDevice(input: MIDIInput): void {
    this.addDeviceInternal(input);
  }

  private shouldFilterDevice(input: MIDIInput): boolean {
    const name = (input.name || '').toLowerCase();
    const manufacturer = (input.manufacturer || '').toLowerCase();
    const isAndroid = /android/i.test(navigator.userAgent);

    if (isAndroid) {
      const androidUnwantedPatterns = [
        'through port-0', 'midi through port-0', 'through port', 'midi through',
        'through', 'unknown', 'loopback', 'virtual', 'software', 'thru',
        'system', 'default', 'android', 'port', 'client', 'seq'
      ];
      for (const pattern of androidUnwantedPatterns) {
        if (name.includes(pattern) || manufacturer.includes(pattern)) {
          console.log(`Filtering out Android phantom MIDI device: ${input.name} (${input.manufacturer})`);
          return true;
        }
      }
      const hasRealManufacturer = !!manufacturer && !['unknown', 'android', 'linux'].includes(manufacturer);
      const hasRealName = !!name && !['unknown', 'midi', 'input', 'output'].includes(name);
      if (!hasRealManufacturer || !hasRealName) {
        console.log(`Filtering out Android phantom MIDI device (no real name/manufacturer): ${input.name} (${input.manufacturer})`);
        return true;
      }
    } else {
      const unwantedPatterns = [
        'through port-0', 'midi through port-0', 'through port', 'midi through',
        'through', 'unknown', 'loopback', 'virtual', 'software', 'thru'
      ];
      for (const pattern of unwantedPatterns) {
        if (name.includes(pattern) || manufacturer.includes(pattern)) {
          let totalInputs = 0;
          this.midiAccess?.inputs.forEach(() => totalInputs++);
          if (totalInputs <= 1) {
            console.log(`Allowing filtered device '${input.name}' as it's the only available device`);
            return false;
          }
          console.log(`Filtering out unwanted MIDI device: ${input.name} (${input.manufacturer})`);
          return true;
        }
      }
    }
    return false;
  }

  private addDeviceInternal(input: MIDIInput): void {
    if (this.shouldFilterDevice(input)) return;
    const device: MidiDevice = {
      id: input.id,
      name: input.name || 'Unknown MIDI Device',
      manufacturer: input.manufacturer || 'Unknown',
      state: input.state as 'connected' | 'disconnected',
      connection: input.connection as 'open' | 'closed' | 'pending'
    };
    this.connectedDevices.set(device.id, device);
    if (!this.selectedDeviceId) this.selectBestAvailableDevice();
    this.emit('deviceConnected', device);
    this.emitStatusChange();
    console.log(`MIDI device connected: ${device.name}`);
  }

  private selectBestAvailableDevice(): void {
    if (this.connectedDevices.size === 0) return;
    const deviceIds = Array.from(this.connectedDevices.keys());
    if (deviceIds.length === 1) {
      this.selectDevice(deviceIds[0]);
      return;
    }
    const preferredDevice = deviceIds.find(deviceId => {
      const device = this.connectedDevices.get(deviceId);
      if (!device) return false;
      const name = device.name.toLowerCase();
      return name.includes('keyboard') || name.includes('piano') || name.includes('casio') ||
        name.includes('yamaha') || name.includes('roland') || name.includes('korg') ||
        (!name.includes('through') && !name.includes('unknown'));
    });
    this.selectDevice(preferredDevice || deviceIds[0]);
  }

  private removeDevice(deviceId: string): void {
    const device = this.connectedDevices.get(deviceId);
    if (!device) return;
    this.connectedDevices.delete(deviceId);
    if (this.selectedDeviceId === deviceId) {
      this.selectedDeviceId = null;
      this.selectBestAvailableDevice();
    }
    this.emit('deviceDisconnected', device);
    this.emitStatusChange();
    console.log(`MIDI device disconnected: ${device.name}`);
  }

  public selectDevice(deviceId: string): boolean {
    if (!this.midiAccess || !this.connectedDevices.has(deviceId)) return false;
    if (this.selectedDeviceId) this.disconnectDevice(this.selectedDeviceId);
    let input: MIDIInput | undefined;
    this.midiAccess.inputs.forEach((candidate: MIDIInput) => {
      if (candidate.id === deviceId) input = candidate;
    });
    if (!input) return false;
    try {
      input.onmidimessage = (event: MIDIMessageEvent) => this.handleMidiMessage(event);
      this.selectedDeviceId = deviceId;
      this.emitStatusChange();
      console.log(`Selected MIDI device: ${this.connectedDevices.get(deviceId)?.name}`);
      return true;
    } catch (error) {
      console.error('Failed to connect to MIDI device:', error);
      return false;
    }
  }

  private disconnectDevice(deviceId: string): void {
    if (!this.midiAccess) return;
    let input: MIDIInput | undefined;
    this.midiAccess.inputs.forEach((candidate: MIDIInput) => {
      if (candidate.id === deviceId) input = candidate;
    });
    if (input) input.onmidimessage = null;
  }

  private handleMidiMessage(event: MIDIMessageEvent): void {
    if (!event.data || event.data.length < 3) return;
    const [status, note, velocity] = Array.from(event.data);
    const channel = status & 0x0F;
    const messageType = status & 0xF0;

    if (messageType === 0x90 && velocity > 0) {
      // The current game displays natural notes only. Do not silently turn a
      // black-key pitch into a neighbouring white-key answer, because that can
      // reward an incorrect pitch. Accidentals can be enabled explicitly later.
      if (!isNaturalNote(note)) return;
      const midiNote: MidiNote = { note, velocity, channel, timestamp: event.timeStamp };
      const mapping = this.midiNoteToMapping(note);
      this.emit('noteOn', midiNote, mapping);
      this.inputCallbacks.forEach(callback => callback(mapping));
    } else if ((messageType === 0x90 && velocity === 0) || messageType === 0x80) {
      if (!isNaturalNote(note)) return;
      const midiNote: MidiNote = { note, velocity: 0, channel, timestamp: event.timeStamp };
      const mapping = this.midiNoteToMapping(note);
      this.emit('noteOff', midiNote, mapping);
    }
  }

  private midiNoteToMapping(midiNote: number): MidiNoteMapping {
    return midiNoteToMapping(midiNote);
  }

  public onNoteInput(callback: MidiInputCallback): void { this.inputCallbacks.push(callback); }
  public removeNoteInputCallback(callback: MidiInputCallback): void {
    const index = this.inputCallbacks.indexOf(callback);
    if (index > -1) this.inputCallbacks.splice(index, 1);
  }
  public clearNoteInputCallbacks(): void { this.inputCallbacks = []; }

  public on<T extends keyof MidiManagerEvents>(event: T, listener: MidiManagerEvents[T]): void {
    if (!this.eventListeners.has(event)) this.eventListeners.set(event, []);
    this.eventListeners.get(event)!.push(listener);
  }

  private emit<T extends keyof MidiManagerEvents>(event: T, ...args: Parameters<MidiManagerEvents[T]>): void {
    const listeners = this.eventListeners.get(event);
    listeners?.forEach(listener => {
      try { (listener as any)(...args); }
      catch (error) { console.error(`Error in MIDI event listener for ${event}:`, error); }
    });
  }

  private emitStatusChange(additionalProps: Partial<MidiConnectionStatus> = {}): void {
    this.emit('statusChanged', {
      isSupported: !!navigator.requestMIDIAccess,
      isEnabled: !!this.midiAccess,
      selectedDeviceId: this.selectedDeviceId || undefined,
      connectedDevices: Array.from(this.connectedDevices.values()),
      ...additionalProps
    });
  }

  public getStatus(): MidiConnectionStatus {
    return {
      isSupported: !!navigator.requestMIDIAccess,
      isEnabled: !!this.midiAccess,
      selectedDeviceId: this.selectedDeviceId || undefined,
      connectedDevices: Array.from(this.connectedDevices.values())
    };
  }
  public getConnectedDevices(): MidiDevice[] { return Array.from(this.connectedDevices.values()); }
  public getSelectedDevice(): MidiDevice | null {
    return this.selectedDeviceId ? this.connectedDevices.get(this.selectedDeviceId) || null : null;
  }
  public setEnabled(enabled: boolean): void {
    if (enabled && !this.midiAccess) this.initializeMidi();
    else if (!enabled && this.selectedDeviceId) {
      this.disconnectDevice(this.selectedDeviceId);
      this.selectedDeviceId = null;
    }
    this.emitStatusChange();
  }
  public destroy(): void {
    if (this.selectedDeviceId) this.disconnectDevice(this.selectedDeviceId);
    this.connectedDevices.clear();
    this.inputCallbacks = [];
    this.eventListeners.clear();
    this.midiAccess = null;
    this.selectedDeviceId = null;
  }
}

export const midiManager = new MidiManager();
