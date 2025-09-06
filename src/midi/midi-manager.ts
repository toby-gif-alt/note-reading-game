/**
 * MIDI Manager for Note Reading Game
 * Handles Web MIDI API integration, device management, and note input processing
 * 
 * Features:
 * - Automatic MIDI device detection and connection
 * - MIDI note to musical note conversion
 * - Event-based architecture for easy integration
 * - Error handling and fallback support
 */

import { 
  MidiDevice, 
  MidiNote, 
  MidiNoteMapping, 
  MidiConnectionStatus, 
  MidiInputCallback,
  MidiManagerEvents
} from './midi-types.js';

import { midiNoteToMapping, getClosestNaturalNote } from './midi-utils.js';

export class MidiManager {
  private midiAccess: MIDIAccess | null = null;
  private connectedDevices = new Map<string, MidiDevice>();
  private selectedDeviceId: string | null = null;
  private inputCallbacks: MidiInputCallback[] = [];
  private eventListeners = new Map<keyof MidiManagerEvents, Function[]>();

  constructor() {
    this.initializeMidi();
  }

  /**
   * Initialize Web MIDI API and set up device monitoring
   */
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

  /**
   * Set up monitoring for device connection/disconnection events
   */
  private setupDeviceMonitoring(): void {
    if (!this.midiAccess) return;

    this.midiAccess.onstatechange = (event: MIDIConnectionEvent) => {
      const port = event.port;
      
      if (port && port.type === 'input') {
        if (port.state === 'connected') {
          this.addDeviceInternal(port as MIDIInput);
        } else if (port.state === 'disconnected') {
          this.removeDevice(port.id);
        }
      }
    };
  }

  /**
   * Scan for currently connected MIDI input devices
   */
  private scanForDevices(): void {
    if (!this.midiAccess) return;

    this.midiAccess.inputs.forEach((input: MIDIInput) => {
      if (input.state === 'connected') {
        this.addDeviceInternal(input);
      }
    });
  }

  /**
   * Add a newly connected MIDI device (public for testing)
   */
  public addDevice(input: MIDIInput): void {
    this.addDeviceInternal(input);
  }

  /**
   * Check if a MIDI device should be filtered out (phantom/unwanted devices)
   */
  private shouldFilterDevice(input: MIDIInput): boolean {
    const name = (input.name || '').toLowerCase();
    const manufacturer = (input.manufacturer || '').toLowerCase();
    
    // Enhanced Android device detection - filter out common Android phantom devices
    const isAndroid = /android/i.test(navigator.userAgent);
    if (isAndroid) {
      // On Android, be very aggressive about filtering phantom devices
      // Only allow devices that clearly have manufacturer info and meaningful names
      
      // First check for common phantom device patterns
      const androidUnwantedPatterns = [
        'through port-0',
        'midi through port-0', 
        'through port',
        'midi through',
        'through',
        'unknown',
        'loopback',
        'virtual',
        'software',
        'thru',
        'system',
        'default',
        'android',  // Generic Android MIDI devices
        'port',     // Generic port names
        'client',   // ALSA client names
        'seq'       // ALSA sequencer
      ];
      
      // Check if device name or manufacturer contains unwanted patterns
      for (const pattern of androidUnwantedPatterns) {
        if (name.includes(pattern) || manufacturer.includes(pattern)) {
          console.log(`Filtering out Android phantom MIDI device: ${input.name} (${input.manufacturer})`);
          return true;
        }
      }
      
      // On Android, be very strict - require both meaningful name AND manufacturer  
      // Unless it's a clearly branded device
      const hasRealManufacturer = manufacturer && 
                                  manufacturer !== 'unknown' && 
                                  manufacturer !== '' && 
                                  manufacturer !== 'android' &&
                                  manufacturer !== 'linux';
      
      const hasRealName = name && 
                          name !== 'unknown' && 
                          name !== '' && 
                          name !== 'midi' &&
                          name !== 'input' &&
                          name !== 'output';
      
      // If it doesn't have both a real manufacturer and real name, it's likely phantom
      if (!hasRealManufacturer || !hasRealName) {
        console.log(`Filtering out Android phantom MIDI device (no real name/manufacturer): ${input.name} (${input.manufacturer})`);
        return true;
      }
    } else {
      // Filter out common phantom/unwanted MIDI devices for other platforms
      // Enhanced filtering to specifically exclude "MIDI Through port-0" (Chromebook bug)
      const unwantedPatterns = [
        'through port-0',    // Specific Chromebook MIDI through port
        'midi through port-0', // Alternative naming  
        'through port',
        'midi through',
        'through',
        'unknown',
        'loopback',
        'virtual',
        'software',
        'thru'
      ];
      
      // Check if device name or manufacturer contains unwanted patterns
      for (const pattern of unwantedPatterns) {
        if (name.includes(pattern) || manufacturer.includes(pattern)) {
          // Additional check: if it's the only available device, allow it
          // Count total MIDI inputs
          let totalInputs = 0;
          if (this.midiAccess) {
            this.midiAccess.inputs.forEach(() => totalInputs++);
          }
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

  /**
   * Add a newly connected MIDI device (internal implementation)
   */
  private addDeviceInternal(input: MIDIInput): void {
    // Filter out unwanted devices
    if (this.shouldFilterDevice(input)) {
      return;
    }
    
    const device: MidiDevice = {
      id: input.id,
      name: input.name || 'Unknown MIDI Device',
      manufacturer: input.manufacturer || 'Unknown',
      state: input.state as 'connected' | 'disconnected',
      connection: input.connection as 'open' | 'closed' | 'pending'
    };

    this.connectedDevices.set(device.id, device);
    
    // Auto-select first device if none selected, but prefer non-filtered devices
    if (!this.selectedDeviceId) {
      this.selectBestAvailableDevice();
    }

    this.emit('deviceConnected', device);
    this.emitStatusChange();
    
    console.log(`MIDI device connected: ${device.name}`);
  }

  /**
   * Select the best available MIDI device (prioritize non-filtered devices)
   */
  private selectBestAvailableDevice(): void {
    if (this.connectedDevices.size === 0) return;
    
    // Get all device IDs
    const deviceIds = Array.from(this.connectedDevices.keys());
    
    // If only one device, select it
    if (deviceIds.length === 1) {
      this.selectDevice(deviceIds[0]);
      return;
    }
    
    // If multiple devices, prefer the first one that looks like a real keyboard
    const preferredDevice = deviceIds.find(deviceId => {
      const device = this.connectedDevices.get(deviceId);
      if (!device) return false;
      
      const name = device.name.toLowerCase();
      // Look for common keyboard/piano keywords
      return name.includes('keyboard') || 
             name.includes('piano') || 
             name.includes('casio') ||
             name.includes('yamaha') ||
             name.includes('roland') ||
             name.includes('korg') ||
             (!name.includes('through') && !name.includes('unknown'));
    });
    
    // Select preferred device or fall back to first device
    this.selectDevice(preferredDevice || deviceIds[0]);
  }

  /**
   * Remove a disconnected MIDI device
   */
  private removeDevice(deviceId: string): void {
    const device = this.connectedDevices.get(deviceId);
    if (!device) return;

    this.connectedDevices.delete(deviceId);
    
    // If selected device was removed, try to select another one
    if (this.selectedDeviceId === deviceId) {
      this.selectedDeviceId = null;
      // Auto-select next best device if available
      this.selectBestAvailableDevice();
    }

    this.emit('deviceDisconnected', device);
    this.emitStatusChange();
    
    console.log(`MIDI device disconnected: ${device.name}`);
  }

  /**
   * Select a MIDI device for input
   */
  public selectDevice(deviceId: string): boolean {
    if (!this.midiAccess || !this.connectedDevices.has(deviceId)) {
      return false;
    }

    // Disconnect previous device
    if (this.selectedDeviceId) {
      this.disconnectDevice(this.selectedDeviceId);
    }

    let input: MIDIInput | undefined;
    this.midiAccess.inputs.forEach((inp: MIDIInput) => {
      if (inp.id === deviceId) {
        input = inp;
      }
    });
    
    if (!input) return false;

    try {
      input.onmidimessage = (event: MIDIMessageEvent) => {
        this.handleMidiMessage(event);
      };

      this.selectedDeviceId = deviceId;
      this.emitStatusChange();
      
      console.log(`Selected MIDI device: ${this.connectedDevices.get(deviceId)?.name}`);
      return true;
    } catch (error) {
      console.error('Failed to connect to MIDI device:', error);
      return false;
    }
  }

  /**
   * Disconnect from a MIDI device
   */
  private disconnectDevice(deviceId: string): void {
    if (!this.midiAccess) return;

    let input: MIDIInput | undefined;
    this.midiAccess.inputs.forEach((inp: MIDIInput) => {
      if (inp.id === deviceId) {
        input = inp;
      }
    });
    
    if (input) {
      input.onmidimessage = null;
    }
  }

  /**
   * Handle incoming MIDI messages
   */
  private handleMidiMessage(event: MIDIMessageEvent): void {
    if (!event.data || event.data.length < 3) return;
    
    const [status, note, velocity] = Array.from(event.data);
    const channel = status & 0x0F;
    const messageType = status & 0xF0;

    // Only handle note-on messages with velocity > 0
    if (messageType === 0x90 && velocity > 0) {
      const midiNote: MidiNote = {
        note,
        velocity,
        channel,
        timestamp: event.timeStamp
      };

      const mapping = this.midiNoteToMapping(note);
      
      // Emit events
      this.emit('noteOn', midiNote, mapping);
      
      // Call registered callbacks
      this.inputCallbacks.forEach(callback => callback(mapping));
    }
    // Handle note-off messages (note-on with velocity 0 or explicit note-off)
    else if ((messageType === 0x90 && velocity === 0) || messageType === 0x80) {
      const midiNote: MidiNote = {
        note,
        velocity: 0,
        channel,
        timestamp: event.timeStamp
      };

      const mapping = this.midiNoteToMapping(note);
      this.emit('noteOff', midiNote, mapping);
    }
  }

  /**
   * Convert MIDI note number to musical note mapping
   * Uses utility function for consistent conversion
   */
  private midiNoteToMapping(midiNote: number): MidiNoteMapping {
    // Get closest natural note for the game (no sharps/flats)
    const naturalMidiNote = getClosestNaturalNote(midiNote);
    return midiNoteToMapping(naturalMidiNote);
  }

  /**
   * Register a callback for MIDI note input
   */
  public onNoteInput(callback: MidiInputCallback): void {
    this.inputCallbacks.push(callback);
  }

  /**
   * Remove a note input callback
   */
  public removeNoteInputCallback(callback: MidiInputCallback): void {
    const index = this.inputCallbacks.indexOf(callback);
    if (index > -1) {
      this.inputCallbacks.splice(index, 1);
    }
  }

  /**
   * Clear all note input callbacks
   */
  public clearNoteInputCallbacks(): void {
    this.inputCallbacks = [];
  }

  /**
   * Register an event listener
   */
  public on<T extends keyof MidiManagerEvents>(
    event: T, 
    listener: MidiManagerEvents[T]
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Emit an event to all registered listeners
   */
  private emit<T extends keyof MidiManagerEvents>(
    event: T,
    ...args: Parameters<MidiManagerEvents[T]>
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          (listener as any)(...args);
        } catch (error) {
          console.error(`Error in MIDI event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Emit status change event
   */
  private emitStatusChange(additionalProps: Partial<MidiConnectionStatus> = {}): void {
    const status: MidiConnectionStatus = {
      isSupported: !!navigator.requestMIDIAccess,
      isEnabled: !!this.midiAccess,
      selectedDeviceId: this.selectedDeviceId || undefined,
      connectedDevices: Array.from(this.connectedDevices.values()),
      ...additionalProps
    };

    this.emit('statusChanged', status);
  }

  /**
   * Get current connection status
   */
  public getStatus(): MidiConnectionStatus {
    return {
      isSupported: !!navigator.requestMIDIAccess,
      isEnabled: !!this.midiAccess,
      selectedDeviceId: this.selectedDeviceId || undefined,
      connectedDevices: Array.from(this.connectedDevices.values())
    };
  }

  /**
   * Get list of connected devices
   */
  public getConnectedDevices(): MidiDevice[] {
    return Array.from(this.connectedDevices.values());
  }

  /**
   * Get currently selected device
   */
  public getSelectedDevice(): MidiDevice | null {
    if (!this.selectedDeviceId) return null;
    return this.connectedDevices.get(this.selectedDeviceId) || null;
  }

  /**
   * Enable/disable MIDI input
   */
  public setEnabled(enabled: boolean): void {
    if (enabled && !this.midiAccess) {
      this.initializeMidi();
    } else if (!enabled && this.selectedDeviceId) {
      this.disconnectDevice(this.selectedDeviceId);
      this.selectedDeviceId = null;
    }
    
    this.emitStatusChange();
  }

  /**
   * Clean up MIDI connections and resources
   */
  public destroy(): void {
    if (this.selectedDeviceId) {
      this.disconnectDevice(this.selectedDeviceId);
    }
    
    this.connectedDevices.clear();
    this.inputCallbacks = [];
    this.eventListeners.clear();
    this.midiAccess = null;
    this.selectedDeviceId = null;
  }
}

// Export singleton instance for easy use across the application
export const midiManager = new MidiManager();