// Musical notation rendering system - Now using Bravura music font
// Professional SMuFL-compliant music font rendering for high-quality musical notation

// Global variables for staff positioning  
let currentTrebleStave = null;
let currentBassStave = null;

// Ledger line settings
let maxLedgerLines = 4; // Default maximum ledger lines each side

// Bravura music font Unicode codepoints (SMuFL standard)
const BRAVURA_SYMBOLS = {
  gClef: '\uE050',        // Treble clef
  fClef: '\uE062',        // Standard Bass clef (F clef)  
  cClef: '\uE058',        // C clef
  noteheadBlack: '\uE0A4', // Black note head (quarter note)
  noteheadWhole: '\uE0A2', // Whole note head (semibreve)
  staff5Lines: '\uE014',   // Five-line staff
  ledgerLine: '\uE022'     // Ledger line
};

// Helper function to draw text with Bravura font
function drawBravuraText(ctx, text, x, y, size = 40, color = '#000') {
  ctx.save();
  ctx.font = `${size}px Bravura`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Draw treble clef using Bravura font
function drawTrebleClef(ctx, x, y, scale = 1) {
  const size = 60 * scale; // Reduced size for better proportion to staff
  drawBravuraText(ctx, BRAVURA_SYMBOLS.gClef, x, y, size, '#FFFFFF'); // White color
}

// Draw bass clef using Bravura font  
function drawBassClef(ctx, x, y, scale = 1) {
  const size = 60 * scale; // Reduced size to match treble clef proportion
  drawBravuraText(ctx, BRAVURA_SYMBOLS.fClef, x, y, size, '#FFFFFF'); // White color
}


// Draw staff lines (keeping traditional approach for proper width, but adjusting for Bravura symbols)
function drawStaffLines(ctx, x, y, width, lineCount = 5) {
  ctx.strokeStyle = '#FFFFFF'; // White staff lines
  ctx.lineWidth = 2.4; // Thicker lines for better visibility
  
  const spacing = 16; // Standard staff spacing for music notation (1 space = 16px)
  
  for (let i = 0; i < lineCount; i++) {
    const lineY = y + (i * spacing);
    ctx.beginPath();
    ctx.moveTo(x, lineY);
    ctx.lineTo(x + width, lineY);
    ctx.stroke();
  }
  
  return {
    top: y,
    bottom: y + ((lineCount - 1) * spacing),
    spacing: spacing,
    x: x,
    width: width
  };
}

// Create staff information object
function createStaff(clef, x, y, width) {
  const staffLines = drawStaffLines(ctx, x, y, width);
  
  // Draw clef symbol with proper positioning for Bravura font
  const clefX = x + 30;
  let clefY;
  
  if (clef === 'treble') {
    clefY = y + 48; // Treble clef positioned so it wraps around line 3 (the G line)
    drawTrebleClef(ctx, clefX, clefY, 1.0); // Standard scale for Bravura
  } else if (clef === 'bass') {
    clefY = y + 16; // Bass clef positioned so F line (line 1) is between the two dots
    drawBassClef(ctx, clefX, clefY, 1.0); // Standard scale for Bravura
  }
  
  return {
    clef: clef,
    x: x,
    y: y,
    width: width,
    staffLines: staffLines,
    clefX: clefX,
    clefY: clefY
  };
}

// Helper functions for pitch conversion and staff positioning
function scientificToMidi(letter, octave) {
  const noteValues = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
  return (octave + 1) * 12 + noteValues[letter.toUpperCase()];
}

function midiToScientific(midi) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return { letter: noteNames[noteIndex].charAt(0), octave: octave, scientific: noteNames[noteIndex] + octave };
}

function getStaffLocalIndex(letter, octave, clef) {
  if (clef === 'treble') {
    // Treble staff diatonic positions: E4=0 (bottom line), F4=1 (space), G4=2 (line), etc.
    // Calculate position relative to E4 using diatonic steps, not chromatic semitones
    const letterOrder = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const noteIndex = letterOrder.indexOf(letter.toUpperCase());
    const e4Index = letterOrder.indexOf('E'); // E = index 2
    
    // Calculate diatonic steps from E4
    const octaveDiff = octave - 4;
    const letterDiff = noteIndex - e4Index;
    return octaveDiff * 7 + letterDiff; // 7 letters per octave
  } else if (clef === 'bass') {
    // Bass staff diatonic positions: G2=0 (bottom line), A2=1 (space), B2=2 (line), etc.
    // Calculate position relative to G2 using diatonic steps
    const letterOrder = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const noteIndex = letterOrder.indexOf(letter.toUpperCase());
    const g2Index = letterOrder.indexOf('G'); // G = index 4
    
    // Calculate diatonic steps from G2
    const octaveDiff = octave - 2;
    const letterDiff = noteIndex - g2Index;
    return octaveDiff * 7 + letterDiff; // 7 letters per octave
  }
  return 0;
}

function buildNoteDefinitions() {
  const definitions = {
    treble: [],
    bass: [],
    grand: []
  };
  
  // Treble clef notes: E4 to F5 + ledger lines
  const trebleNotes = [
    { letter: 'A', octave: 5 }, // Ledger line above
    { letter: 'G', octave: 5 }, // Space above staff
    { letter: 'F', octave: 5 }, // Top staff line
    { letter: 'E', octave: 5 }, // Space
    { letter: 'D', octave: 5 }, // Staff line
    { letter: 'C', octave: 5 }, // Space
    { letter: 'B', octave: 4 }, // Staff line
    { letter: 'A', octave: 4 }, // Space
    { letter: 'G', octave: 4 }, // Staff line (G4)
    { letter: 'F', octave: 4 }, // Space
    { letter: 'E', octave: 4 }, // Bottom staff line
    { letter: 'D', octave: 4 }, // Space below staff
    { letter: 'C', octave: 4 }, // Middle C - ledger line below
    { letter: 'B', octave: 3 }, // Space below
    { letter: 'A', octave: 3 }  // Ledger line below
  ];
  
  trebleNotes.forEach(note => {
    const staffLocalIndex = getStaffLocalIndex(note.letter, note.octave, 'treble');
    definitions.treble.push({
      note: note.letter,
      letter: note.letter,
      octave: note.octave,
      midi: scientificToMidi(note.letter, note.octave),
      scientific: note.letter + note.octave,
      clef: 'treble',
      staffLocalIndex: staffLocalIndex,
      // Keep legacy line property for gradual migration
      line: staffLocalIndex
    });
  });
  
  // Bass clef notes: G2 to A3 + ledger lines  
  const bassNotes = [
    { letter: 'C', octave: 4 }, // Middle C - ledger line above
    { letter: 'B', octave: 3 }, // Space above staff
    { letter: 'A', octave: 3 }, // Top staff line
    { letter: 'G', octave: 3 }, // Space
    { letter: 'F', octave: 3 }, // Staff line
    { letter: 'E', octave: 3 }, // Space
    { letter: 'D', octave: 3 }, // Middle staff line
    { letter: 'C', octave: 3 }, // Space
    { letter: 'B', octave: 2 }, // Staff line
    { letter: 'A', octave: 2 }, // Space
    { letter: 'G', octave: 2 }, // Bottom staff line
    { letter: 'F', octave: 2 }, // Space below staff
    { letter: 'E', octave: 2 }, // Ledger line below
    { letter: 'D', octave: 2 }, // Space below
    { letter: 'C', octave: 2 }  // Ledger line below
  ];
  
  bassNotes.forEach(note => {
    const staffLocalIndex = getStaffLocalIndex(note.letter, note.octave, 'bass');
    definitions.bass.push({
      note: note.letter,
      letter: note.letter,
      octave: note.octave,
      midi: scientificToMidi(note.letter, note.octave),
      scientific: note.letter + note.octave,
      clef: 'bass',
      staffLocalIndex: staffLocalIndex,
      // Keep legacy line property for gradual migration
      line: staffLocalIndex
    });
  });
  
  // Grand staff: combine both but maintain separate clef identification
  definitions.grand = [
    ...definitions.treble.map(note => ({ ...note, clef: 'treble' })),
    ...definitions.bass.map(note => ({ ...note, clef: 'bass' }))
  ];
  
  return definitions;
}

// Debug settings
let debugPitchOverlay = false; // Set to true to show pitch names

// Enable debug mode with a keyboard shortcut (for development/testing)
document.addEventListener('keydown', function(event) {
  if (event.key === 'Backquote' || event.key === '`') { // Backtick key to toggle debug
    debugPitchOverlay = !debugPitchOverlay;
    console.log('Debug pitch overlay:', debugPitchOverlay ? 'ON' : 'OFF');
  }
});

// Note positions for Treble and Bass clef - Updated for accurate pitch mapping per problem statement
const notePositions = buildNoteDefinitions();



const canvas = document.getElementById('staffCanvas');
const ctx = canvas.getContext('2d');

// Make canvas responsive to window size
// Update spaceship position to ensure proper spacing from pitch buttons and stave
function updateSpaceshipPosition() {
  // Position spaceship with adequate clearance from bottom controls and stave
  // Increased clearance to prevent overlap with pitch buttons or staff
  if (currentClef === 'grand') {
    spaceship.y = canvas.height - 320; // Increased spacing for grand stave (was 280)
  } else {
    spaceship.y = canvas.height - 380; // Increased spacing for single staves (was 350)
  }
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  // Update spaceship position based on clef type
  spaceship.x = canvas.width / 2;
  updateSpaceshipPosition();
}

// Resize on window resize
window.addEventListener('resize', resizeCanvas);

// Load game settings from localStorage
let gameSettings = {
  music: true,
  soundEffects: true,
  clef: 'treble',
  pianoMode: {
    enabled: false,
    strictMode: false,
    leftHand: 'none',
    rightHand: 'none'
  }
};

// Piano Mode integration
let pianoModeActive = false;
let pianoModeSettings = {};

// Chord completion tracking for Piano Mode with grace period
let chordProgress = new Map(); // chordId -> { pressedNotes: Set, timestamps: Map, firstPressTime: number }

// Clean up stale chord progress entries to prevent input registration failures
// FIXED: Now called immediately on every input event instead of being throttled
function cleanupStaleChordProgress() {
  const currentTime = Date.now();
  const maxAge = 5000; // 5 seconds - reduced from 10 seconds to prevent excessive accumulation
  
  for (const [chordId, chordData] of chordProgress.entries()) {
    // Remove entries that are too old or reference notes that no longer exist
    const isStale = (currentTime - chordData.firstPressTime) > maxAge;
    const chordStillExists = movingNotes.some(note => note.isChord && note.chordId === chordId);
    
    if (isStale || !chordStillExists) {
      chordProgress.delete(chordId);
    }
  }
  
  // Additional safety check: if chordProgress gets too large, clear the oldest entries
  if (chordProgress.size > 10) {
    // Convert to array, sort by firstPressTime, keep only the 5 most recent
    const entries = Array.from(chordProgress.entries());
    entries.sort((a, b) => b[1].firstPressTime - a[1].firstPressTime);
    
    chordProgress.clear();
    entries.slice(0, 5).forEach(([id, data]) => {
      chordProgress.set(id, data);
    });
  }
}

// FIXED: Remove throttling mechanism to allow immediate cleanup after every MIDI input
// let lastChordCleanup = 0; // REMOVED - was causing chord input registration failures

function loadGameSettings() {
  const saved = localStorage.getItem('noteGameSettings');
  if (saved) {
    const settings = JSON.parse(saved);
    gameSettings = { ...gameSettings, ...settings };
    
    // Ensure pianoMode object exists
    if (!gameSettings.pianoMode) {
      gameSettings.pianoMode = {
        enabled: false,
        strictMode: false,
        leftHand: 'none',
        rightHand: 'none'
      };
    }
    
    currentClef = settings.clef || 'treble';
    maxLedgerLines = settings.ledgerLines !== undefined ? settings.ledgerLines : 4;
    
    // Load Piano Mode settings
    pianoModeActive = gameSettings.pianoMode.enabled;
    pianoModeSettings = { ...gameSettings.pianoMode };
    
    // Sync property mappings for Piano Mode settings from menu
    if (gameSettings.pianoMode.strictMode !== undefined) {
      pianoModeSettings.strictMode = gameSettings.pianoMode.strictMode;
    }
    
    updateSpaceshipPosition(); // Update spaceship position when clef is loaded
  }
}

// Piano Mode UI update function (called by MIDI integration)
function onPianoModeChanged(settings) {
  pianoModeActive = settings.isActive;
  
  // Update Piano Mode settings from MIDI integration
  if (settings.leftHand !== undefined) {
    pianoModeSettings.leftHand = settings.leftHand;
  }
  if (settings.rightHand !== undefined) {
    pianoModeSettings.rightHand = settings.rightHand;
  }
  if (settings.forceGrandStaff !== undefined) {
    pianoModeSettings.forceGrandStaff = settings.forceGrandStaff;
  }
  
  if (pianoModeActive) {
    // Force grand staff if Piano Mode is active and setting is enabled
    if (settings.forceGrandStaff && currentClef !== 'grand') {
      currentClef = 'grand';
      drawStaff(currentClef);
      document.getElementById('clefDisplay').textContent = 'Clef selected: Grand Stave (Piano Mode)';
    }
  }
  
  // Update hand score visibility
  updateHandScoreVisibility();
}

// Function to update Piano Mode settings from menu
function updateGamePianoModeSettings(settings) {
  pianoModeSettings = { ...pianoModeSettings, ...settings };
  
  // Sync specific property mappings between menu and game settings
  if (settings.strictMode !== undefined) {
    pianoModeSettings.strictMode = settings.strictMode;
  }
  
  console.log('Piano mode settings updated:', pianoModeSettings);
}

// Make functions available globally
window.onPianoModeChanged = onPianoModeChanged;
window.updateGamePianoModeSettings = updateGamePianoModeSettings;

// Audio system - Layered music system where all tracks play simultaneously
const audioFiles = {
  // Level music tracks - all play simultaneously and get unmuted as levels progress
  // Using correct file names that match the actual files in audio directory
  musicLevel2: new Audio('audio/level 2.wav'),
  musicLevel3: new Audio('audio/level 3.wav'),
  musicLevel4: new Audio('audio/level 4.wav'),
  musicLevel5: new Audio('audio/level 5.wav'),
  musicLevel6: new Audio('audio/level 6.wav'),
  
  // Sound effects
  laser: new Audio('audio/laser.wav'),
  meteorExplosion: new Audio('audio/meteor explosion.wav'),
  explosionLoseLive: new Audio('audio/explosion lose live.wav'),
  gameOver: new Audio('audio/game over.wav')
};

// Set all music tracks to loop and start them muted
const musicTracks = ['musicLevel2', 'musicLevel3', 'musicLevel4', 'musicLevel5', 'musicLevel6'];
musicTracks.forEach(trackName => {
  if (audioFiles[trackName]) {
    audioFiles[trackName].loop = true;
    audioFiles[trackName].volume = 0; // Start muted
    audioFiles[trackName].preload = 'auto'; // Ensure tracks are preloaded for synchronization
  }
});

// Track which music tracks are currently active
let activeMusicTracks = [];

// Show level progression popup
function showLevelPopup(levelNumber) {
  const levelPopup = document.getElementById('levelPopup');
  if (levelPopup) {
    levelPopup.textContent = `Level ${levelNumber}!`;
    levelPopup.style.display = 'block';
    
    // Hide the popup after animation completes (3 seconds)
    setTimeout(() => {
      levelPopup.style.display = 'none';
    }, 3000);
  }
}

// Layered music system - all tracks play simultaneously, unmuted based on level
function updateMusicForLevel(currentLevel) {
  if (!gameSettings.music) {
    // If music is disabled, mute all tracks
    musicTracks.forEach(trackName => {
      if (audioFiles[trackName]) {
        audioFiles[trackName].volume = 0;
      }
    });
    return;
  }
  
  // Get current music volume from slider (if it exists)
  const musicVolumeSlider = document.getElementById('musicVolume');
  const baseVolume = musicVolumeSlider ? parseFloat(musicVolumeSlider.value) : 0.7;
  
  // Level 1: No music (all tracks muted)
  if (currentLevel === 1) {
    musicTracks.forEach(trackName => {
      if (audioFiles[trackName]) {
        audioFiles[trackName].volume = 0;
      }
    });
    activeMusicTracks = [];
    return;
  }
  
  // For levels 2-6: Unmute tracks progressively (only using available tracks)
  // Level 2: only level 2 music
  // Level 3: level 2 + level 3 music  
  // Level 4: level 2 + level 3 + level 4 music
  // Level 5: level 2 + level 3 + level 4 + level 5 music
  // Level 6+: level 2 + level 3 + level 4 + level 5 + level 6 music (keeps looping)
  const tracksToUnmute = [];
  if (currentLevel >= 2) tracksToUnmute.push('musicLevel2');
  if (currentLevel >= 3) tracksToUnmute.push('musicLevel3');
  if (currentLevel >= 4) tracksToUnmute.push('musicLevel4');
  if (currentLevel >= 5) tracksToUnmute.push('musicLevel5');
  if (currentLevel >= 6) tracksToUnmute.push('musicLevel6');
  
  // Update volume for all tracks
  musicTracks.forEach(trackName => {
    if (audioFiles[trackName]) {
      if (tracksToUnmute.includes(trackName)) {
        audioFiles[trackName].volume = baseVolume;
      } else {
        audioFiles[trackName].volume = 0;
      }
    }
  });
  
  activeMusicTracks = tracksToUnmute;
}

async function startAllMusicTracks() {
  if (!gameSettings.music) return;
  
  // Ensure all tracks are loaded and ready before starting
  const trackPromises = musicTracks.map(trackName => {
    const track = audioFiles[trackName];
    if (track) {
      return new Promise((resolve) => {
        const checkReady = () => {
          if (track.readyState >= 3) { // HAVE_FUTURE_DATA or better
            track.currentTime = 0;
            resolve(track);
          } else {
            track.addEventListener('canplay', () => {
              track.currentTime = 0;
              resolve(track);
            }, { once: true });
          }
        };
        checkReady();
      });
    }
    return Promise.resolve(null);
  });
  
  try {
    // Wait for all tracks to be ready
    const readyTracks = await Promise.all(trackPromises);
    
    // Start all tracks at exactly the same moment
    const playPromises = readyTracks.map(track => {
      if (track && track.paused) {
        return track.play().catch(e => console.log(`Failed to start track:`, e));
      }
      return Promise.resolve();
    });
    
    // Wait for all play() calls to complete
    await Promise.all(playPromises);
    
    console.log('All music tracks started synchronously');
  } catch (error) {
    console.log('Error starting music tracks:', error);
  }
}

function stopAllMusic() {
  musicTracks.forEach(trackName => {
    const track = audioFiles[trackName];
    if (track) {
      track.pause();
      track.currentTime = 0;
      track.volume = 0;
    }
  });
  activeMusicTracks = [];
}

function playSound(soundName) {
  if (gameSettings.soundEffects && audioFiles[soundName]) {
    audioFiles[soundName].currentTime = 0;
    audioFiles[soundName].play().catch(e => console.log('Audio play failed:', e));
  }
}

// Try to start music on first user interaction
let musicStarted = false;
async function tryStartMusic() {
  if (!musicStarted && gameSettings.music) {
    await startAllMusicTracks();
    updateMusicForLevel(level);
    musicStarted = true;
  }
}

async function startBackgroundMusic() {
  if (gameSettings.music) {
    await startAllMusicTracks();
    updateMusicForLevel(level);
  }
}

function stopBackgroundMusic() {
  stopAllMusic();
}

// Image loading system (only for non-musical images)
const images = {};
const imagePaths = {
  spaceship: 'images/spaceship.png',
  meteor1: 'images/meteor 1.jpeg',
  meteor2: 'images/meteor 2.jpeg',
  meteor3: 'images/meteor 3.jpeg',
  background: 'images/background.jpg',
  explosion: 'images/explosion.png'
  // Removed clef and staff images - now using canvas rendering
};

let imagesLoaded = 0;
const totalImages = Object.keys(imagePaths).length; // Only count non-musical images

function loadImages() {
  return new Promise((resolve) => {
    // Only load non-musical images (background, spaceship, etc.)
    // Musical notation is now handled by canvas rendering
    
    const actualImageCount = Object.keys(imagePaths).length;
    
    if (actualImageCount === 0) {
      resolve();
      return;
    }
    
    Object.keys(imagePaths).forEach(key => {
      const img = new Image();
      img.onload = () => {
        imagesLoaded++;
        if (imagesLoaded === actualImageCount) {
          resolve();
        }
      };
      img.onerror = () => {
        console.log(`Failed to load image: ${imagePaths[key]}`);
        imagesLoaded++;
        if (imagesLoaded === actualImageCount) {
          resolve();
        }
      };
      img.src = imagePaths[key];
      images[key] = img;
    });
  });
}

// Explosion sprite sheet configuration
// The 1536x1536 image contains 9 explosion frames arranged in a 3x3 grid
const EXPLOSION_FRAMES = {
  totalFrames: 9,
  gridSize: 3, // 3x3 grid
  frameSize: 512 // Each frame is 512x512 pixels
};

// Generate random explosion frames for each explosion (2-3 frames per explosion)
function generateExplosionFrames() {
  const numFrames = Math.floor(Math.random() * 2) + 2; // Random 2-3 frames
  const frames = [];
  const availableFrames = Array.from({length: EXPLOSION_FRAMES.totalFrames}, (_, i) => i);
  
  for (let i = 0; i < numFrames; i++) {
    // Remove random frame from available ones to avoid duplicates in same explosion
    const randomIndex = Math.floor(Math.random() * availableFrames.length);
    const frameIndex = availableFrames.splice(randomIndex, 1)[0];
    frames.push(frameIndex);
  }
  
  return frames;
}

// Create explosion at randomized position around clef area
function createClefExplosion(clefX, clefY, size = 60, duration = 500) {
  // Add randomness to explosion position around clef
  const offsetRange = 25; // Pixels to vary position
  const randomX = clefX + (Math.random() - 0.5) * offsetRange * 2;
  const randomY = clefY + (Math.random() - 0.5) * offsetRange * 2;
  
  explosions.push({
    x: randomX,
    y: randomY,
    size: size,
    startTime: Date.now(),
    duration: duration,
    frames: generateExplosionFrames(),
    currentFrameIndex: 0
  });
}

// Create multiple explosions across clef and staff area for game over
function createGameOverExplosions(clefX, clefY, staffInfo) {
  const gameOverDuration = 3000; // 3 seconds - duration of game over sound
  const numberOfExplosions = 12; // More explosions for dramatic effect
  
  // Calculate staff boundaries for explosion placement
  const staffStartX = staffInfo ? staffInfo.x : clefX - 100;
  const staffEndX = staffInfo ? (staffInfo.x + staffInfo.width) : clefX + 400;
  const staffTopY = staffInfo ? staffInfo.y : clefY - 50;
  const staffBottomY = staffInfo ? (staffInfo.y + 64) : clefY + 50; // 64px = 4 * 16px spacing
  
  // Create explosions at intervals throughout the game over duration
  for (let i = 0; i < numberOfExplosions; i++) {
    setTimeout(() => {
      // Random position across the staff area
      const randomX = staffStartX + Math.random() * (staffEndX - staffStartX);
      const randomY = staffTopY + Math.random() * (staffBottomY - staffTopY);
      
      // Larger explosions that stay visible until the end
      const remainingTime = gameOverDuration - (i * (gameOverDuration / numberOfExplosions));
      
      explosions.push({
        x: randomX,
        y: randomY,
        size: 70 + Math.random() * 30, // Varied sizes between 70-100
        startTime: Date.now(),
        duration: remainingTime, // Stay visible until game over sound ends
        frames: generateExplosionFrames(),
        currentFrameIndex: 0
      });
    }, i * (gameOverDuration / numberOfExplosions)); // Sequential timing
  }
}

// Create minimal explosions to prevent screen freeze
function createMinimalExplosions(clefX, clefY) {
  // Just 2-3 small explosions with short duration
  const numberOfExplosions = 3;
  const explosionDuration = 800; // 0.8 seconds total
  
  for (let i = 0; i < numberOfExplosions; i++) {
    setTimeout(() => {
      // Small area around the clef
      const randomX = clefX + (Math.random() - 0.5) * 100;
      const randomY = clefY + (Math.random() - 0.5) * 60;
      
      explosions.push({
        x: randomX,
        y: randomY,
        size: 40 + Math.random() * 20, // Smaller explosions (40-60px)
        startTime: Date.now(),
        duration: 600, // Short duration
        frames: generateExplosionFrames(),
        currentFrameIndex: 0
      });
    }, i * 150); // Quick succession
  }
}

// Trigger screen shake effect
function triggerShake(intensity, duration) {
  shakeEffect.active = true;
  shakeEffect.startTime = Date.now();
  shakeEffect.intensity = intensity;
  shakeEffect.duration = duration;
}

// Draw fluctuating green line to the right of clef (collision line)
function drawFluctuatingLine() {
  // Update the fluctuating line phase
  fluctuatingLine.phase += 0.1;
  
  // Calculate line length fluctuation using sine wave
  const lengthFluctuation = Math.sin(fluctuatingLine.phase) * fluctuatingLine.amplitude;
  
  // Position line to the right of the clef (collision point) with more spacing
  const collisionX = (currentTrebleStave ? currentTrebleStave.clefX : currentBassStave ? currentBassStave.clefX : 65) + 35; // 35px buffer from clef for better visual separation
  
  if (currentTrebleStave && currentBassStave) {
    // Grand staff - draw green lines for both treble and bass staves
    drawStaffGreenLine(collisionX, currentTrebleStave, lengthFluctuation);
    drawStaffGreenLine(collisionX, currentBassStave, lengthFluctuation);
  } else if (currentTrebleStave) {
    drawStaffGreenLine(collisionX, currentTrebleStave, lengthFluctuation);
  } else if (currentBassStave) {
    drawStaffGreenLine(collisionX, currentBassStave, lengthFluctuation);
  }
}

// Helper function to draw green line for a specific staff
function drawStaffGreenLine(collisionX, staff, lengthFluctuation) {
  // Position green line in the middle of the stave (third line)
  const middleLineY = staff.y + 32; // Third staff line (middle line)
  const baseLength = 60; // Standard line height
  
  // Calculate fluctuating line length
  const currentLength = baseLength + lengthFluctuation;
  const halfLength = currentLength / 2;
  
  // Draw the solid green line centered on middle of staff
  ctx.save();
  ctx.strokeStyle = '#00FF00'; // Green color
  ctx.lineWidth = fluctuatingLine.baseThickness; // Fixed thickness
  // No dashed line - solid line as requested
  
  ctx.beginPath();
  ctx.moveTo(collisionX, middleLineY - halfLength);
  ctx.lineTo(collisionX, middleLineY + halfLength);
  ctx.stroke();
  
  ctx.restore();
}

// Update life icons display based on current lives
function updateLifeDisplay() {
  for (let i = 1; i <= 3; i++) {
    const lifeElement = document.getElementById(`life${i}`);
    if (i <= lives) {
      // Life is still active
      lifeElement.className = 'life-icon';
    } else {
      // Life is lost - make it darker and add red cross
      lifeElement.className = 'life-icon lost';
    }
  }
}

const clefSelect = document.getElementById('clefSelect');
const noteInput = null; // Removed input field
const submitBtn = null; // Removed submit button
const restartBtn = document.getElementById('restartBtn');
const feedback = document.getElementById('feedback');
const scoreDisplay = document.getElementById('score');
const livesDisplay = document.getElementById('lives-container');
const notesDestroyedDisplay = document.getElementById('meteorsDestroyed'); // Will be updated to show notes destroyed
const leftHandDisplay = document.getElementById('leftHandScore');
const rightHandDisplay = document.getElementById('rightHandScore');

// Game state
let currentClef = 'treble';
let currentNoteIdx = 0;
let score = 0;
let lives = 3; // Changed from 5 to 3 lives
let notesDestroyed = 0; // Changed from meteorsDestroyed
let level = 1; // Add level system
let correctAnswers = 0; // Track correct answers for level progression
// Piano Mode separate hand scoring
let leftHandScore = 0; // Bass clef score
let rightHandScore = 0; // Treble clef score
let gameRunning = true;
let gameStartTime = Date.now();
let gameInitialized = false;
let includeLedgerLines = false; // Will be loaded from settings

// Game objects
let movingNotes = []; // Notes that move from right to left
let flashEffect = { active: false, startTime: 0 };
let shakeEffect = { active: false, startTime: 0, intensity: 0, duration: 0 };
let fluctuatingLine = { phase: 0, baseThickness: 3, amplitude: 15 };
let explosions = []; // Add explosion effects
let lasers = []; // Add laser effects

let spaceship = {
  x: 800,  // Will be updated by resizeCanvas
  y: 320,  // Will be updated by resizeCanvas
  width: 120,  // Double the original size (was 60)
  height: 60,  // Double the original size (was 30)
  rotation: 0, // Current rotation angle
  targetRotation: 0 // Target rotation angle
};

// Game settings
let lastNoteSpawn = 0;
let noteSpawnRate = 2200; // Initial spawn rate for level 1

// Draw staff and clef using enhanced canvas-based musical notation
function drawStaff(clef) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.save(); // Save the context state
  
  // Apply screen shake effect
  if (shakeEffect.active) {
    const elapsed = Date.now() - shakeEffect.startTime;
    if (elapsed < shakeEffect.duration) {
      const progress = elapsed / shakeEffect.duration;
      const shakeIntensity = shakeEffect.intensity * (1 - progress); // Fade out over time
      const offsetX = (Math.random() - 0.5) * shakeIntensity * 2;
      const offsetY = (Math.random() - 0.5) * shakeIntensity * 2;
      ctx.translate(offsetX, offsetY);
    } else {
      shakeEffect.active = false;
    }
  }

  // Draw background if available
  if (images.background) {
    ctx.drawImage(images.background, 0, 0, canvas.width, canvas.height);
  }
  
  // Apply red flash effect for wrong answers
  if (flashEffect.active) {
    const elapsed = Date.now() - flashEffect.startTime;
    if (elapsed < 300) {
      ctx.fillStyle = `rgba(255, 0, 0, ${0.3 * (1 - elapsed / 300)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      flashEffect.active = false;
    }
  }
  
  // Draw lasers (visual effects)
  drawLasers();

  // Canvas-based staff drawing
  const staffTop = canvas.height * 0.15;
  const staffWidth = canvas.width * 0.9; // Much wider, stretch across screen
  const staffX = (canvas.width - staffWidth) / 2;
  

  
  if (clef === 'grand') {
    // Draw grand staff (both treble and bass)
    // Increase spacing based on maxLedgerLines to prevent overlap
    const baseSpacing = 100;
    const extraSpacing = Math.max(0, (maxLedgerLines - 2) * 20); // Add space for additional ledger lines
    const grandStaffSpacing = baseSpacing + extraSpacing;
    
    currentTrebleStave = createStaff('treble', staffX, staffTop, staffWidth);
    currentBassStave = createStaff('bass', staffX, staffTop + grandStaffSpacing, staffWidth);
  } else {
    // Draw single staff
    if (clef === 'treble') {
      currentTrebleStave = createStaff('treble', staffX, staffTop + 50, staffWidth);
      currentBassStave = null;
    } else if (clef === 'bass') {
      currentBassStave = createStaff('bass', staffX, staffTop + 50, staffWidth);
      currentTrebleStave = null;
    }
  }
  
  // Draw fluctuating line in front of clef
  drawFluctuatingLine();
  
  // Draw moving notes AFTER staff so they appear on top
  drawMovingNotes();
  
  // Draw explosions (on top of everything)
  drawExplosions();
  
  // Draw spaceship
  drawSpaceship();
  
  ctx.restore(); // Restore the context state
}

// Draw spaceship at bottom
function drawSpaceship() {
  ctx.save();
  ctx.translate(spaceship.x, spaceship.y + spaceship.height/2);
  ctx.rotate(spaceship.rotation);
  
  if (images.spaceship) {
    // Process spaceship image to remove white background
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = spaceship.width;
    tempCanvas.height = spaceship.height;
    
    // Draw spaceship to temp canvas
    tempCtx.drawImage(images.spaceship, 0, 0, spaceship.width, spaceship.height);
    
    // Get image data to process pixels
    const imageData = tempCtx.getImageData(0, 0, spaceship.width, spaceship.height);
    const data = imageData.data;
    
    // Make white/light pixels transparent
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // If pixel is white or very light, make it transparent
      if (r > 240 && g > 240 && b > 240) {
        data[i + 3] = 0; // Make transparent
      }
    }
    
    // Put the modified image data back
    tempCtx.putImageData(imageData, 0, 0);
    
    // Draw the processed spaceship
    ctx.drawImage(tempCanvas, -spaceship.width/2, -spaceship.height/2);
  } else {
    // Fallback to drawn spaceship (no white background issues here)
    // Main body (fuselage)
    ctx.fillStyle = '#2C5AA0';
    ctx.fillRect(-spaceship.width/2, -spaceship.height/2, spaceship.width, spaceship.height);
    
    // Wings
    ctx.fillStyle = '#1A365A';
    // Left wing
    ctx.beginPath();
    ctx.moveTo(-spaceship.width/2, -5);
    ctx.lineTo(-spaceship.width/2 - 25, 5);
    ctx.lineTo(-spaceship.width/2 - 20, 15);
    ctx.lineTo(-spaceship.width/2, 10);
    ctx.closePath();
    ctx.fill();
    
    // Right wing
    ctx.beginPath();
    ctx.moveTo(spaceship.width/2, -5);
    ctx.lineTo(spaceship.width/2 + 25, 5);
    ctx.lineTo(spaceship.width/2 + 20, 15);
    ctx.lineTo(spaceship.width/2, 10);
    ctx.closePath();
    ctx.fill();
    
    // Cockpit
    ctx.fillStyle = '#4A90E2';
    ctx.beginPath();
    ctx.ellipse(0, -spaceship.height/4, 8, 12, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // Cockpit glass
    ctx.fillStyle = '#87CEEB';
    ctx.beginPath();
    ctx.ellipse(0, -spaceship.height/4, 6, 8, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // Nose/tip
    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.moveTo(0, -spaceship.height/2);
    ctx.lineTo(-8, -spaceship.height/2 + 10);
    ctx.lineTo(8, -spaceship.height/2 + 10);
    ctx.closePath();
    ctx.fill();
    
    // Engine exhausts
    ctx.fillStyle = '#FF6B35';
    ctx.beginPath();
    ctx.ellipse(-10, spaceship.height/2, 3, 2, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(10, spaceship.height/2, 3, 2, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // Wing tips
    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.arc(-spaceship.width/2 - 22, 10, 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(spaceship.width/2 + 22, 10, 2, 0, 2 * Math.PI);
    ctx.fill();
  }
  
  ctx.restore();
}

// Draw lasers
function drawLasers() {
  lasers.forEach((laser, index) => {
    ctx.save();
    
    // Calculate laser progress (0 to 1)
    const elapsed = Date.now() - laser.startTime;
    const progress = Math.min(elapsed / laser.duration, 1);
    
    // Draw thin green line from ship to target
    ctx.strokeStyle = `rgba(0, 255, 0, ${1 - progress * 0.3})`; // Slight fade over time
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(laser.startX, laser.startY);
    ctx.lineTo(
      laser.startX + (laser.targetX - laser.startX) * progress,
      laser.startY + (laser.targetY - laser.startY) * progress
    );
    ctx.stroke();
    
    // Add glow effect
    ctx.shadowColor = '#00FF00';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Remove laser if complete
    if (progress >= 1) {
      lasers.splice(index, 1);
    }
    
    ctx.restore();
  });
}

// Draw moving notes using canvas-based rendering
// Helper function to calculate note Y position based on staff-local indexing
function getNoteY(note, staffInfo) {
  // Use staffLocalIndex for accurate positioning: bottom line = 0, top line = 8
  // staffLines.top is the top staff line, so we invert the calculation
  return staffInfo.staffLines.top + ((8 - note.staffLocalIndex) * (staffInfo.staffLines.spacing / 2));
}

function drawMovingNotes() {
  movingNotes.forEach(note => {
    // Handle flashing animation for wrong answer notes
    if (note.flashing) {
      const elapsed = Date.now() - note.flashStartTime;
      const flashDuration = 150; // Each flash lasts 150ms
      const flashCycle = Math.floor(elapsed / flashDuration);
      
      // Flash twice (0-149ms, 300-449ms are visible, 150-299ms, 450-599ms are hidden/red)
      if (flashCycle >= 4) {
        // Done flashing, note will be removed by timeout
        return;
      }
      
      // Set note color based on flash state
      note.isFlashVisible = (flashCycle % 2 === 0);
    }
    
    // Calculate position based on staff positioning
    let staffInfo;
    let noteY;
    
    if (currentClef === 'grand') {
      if (note.clef === 'treble' && currentTrebleStave) {
        staffInfo = currentTrebleStave;
        noteY = getNoteY(note, staffInfo);
      } else if (note.clef === 'bass' && currentBassStave) {
        staffInfo = currentBassStave;
        noteY = getNoteY(note, staffInfo);
      }
    } else {
      if (currentClef === 'treble' && currentTrebleStave) {
        staffInfo = currentTrebleStave;
        noteY = getNoteY(note, staffInfo);
      } else if (currentClef === 'bass' && currentBassStave) {
        staffInfo = currentBassStave;
        noteY = getNoteY(note, staffInfo);
      }
    }
    
    if (staffInfo && noteY !== undefined) {
      // Draw note with professional styling
      drawCanvasNote(note.x, noteY, note.note, note.staffLocalIndex, staffInfo, note);
      
      // Add debug pitch overlay if enabled
      if (debugPitchOverlay && note.scientific) {
        ctx.save();
        // Use green color for natural notes
        ctx.fillStyle = '#00FF00';
        ctx.font = '12px Arial';
        
        ctx.fillText(note.scientific, note.x + 10, noteY - 4);
        ctx.restore();
      }
    }
  });
}

// Draw a single note using Bravura font
function drawCanvasNote(x, y, noteName, staffLocalIndex, staffInfo, noteObj) {
  ctx.save();
  
  // Determine note color based on flashing state
  let noteColor = '#FF0000'; // Default red
  
  if (noteObj && noteObj.flashing) {
    if (noteObj.isFlashVisible) {
      noteColor = '#FF6666'; // Lighter red for flash effect
    } else {
      noteColor = '#CC0000'; // Darker red for flash effect
    }
  }
  
  // Check if this note has an accidental and draw it
  // (Accidental functionality removed)
  
  // Draw red semibreve (whole note) using Bravura font
  const noteSize = 60; // Increased size for better visibility
  drawBravuraText(ctx, BRAVURA_SYMBOLS.noteheadWhole, x, y, noteSize, noteColor);
  
  // No stem for semibreves (whole notes)
  
  // Draw ledger lines if needed
  drawCanvasLedgerLines(x, y, staffLocalIndex, staffInfo);
  
  ctx.restore();
}

// Draw ledger lines for notes outside the staff
function drawCanvasLedgerLines(x, y, staffLocalIndex, staffInfo) {
  // Don't draw ledger lines if maxLedgerLines is 0 (No Ledger Lines setting)
  if (maxLedgerLines === 0) {
    return;
  }
  
  ctx.strokeStyle = '#FFFFFF'; // White ledger lines to match staff
  ctx.lineWidth = 2.4; // Match staff line thickness
  
  const lineLength = 20; // Appropriate length for note head
  const spacing = staffInfo.staffLines.spacing / 2;
  
  // Staff range is 0-8 (E4-F5 for treble, G2-A3 for bass)
  // Notes outside this range need ledger lines
  if (staffLocalIndex < 0) {
    // Ledger lines below staff (negative indices)
    for (let i = -2; i >= staffLocalIndex; i -= 2) { // Draw every even index (line positions)
      const ledgerY = staffInfo.staffLines.top + ((8 - i) * spacing);
      ctx.beginPath();
      ctx.moveTo(x - lineLength/2, ledgerY);
      ctx.lineTo(x + lineLength/2, ledgerY);
      ctx.stroke();
    }
  } else if (staffLocalIndex > 8) {
    // Ledger lines above staff (indices > 8)
    for (let i = 10; i <= staffLocalIndex; i += 2) { // Draw every even index (line positions)
      const ledgerY = staffInfo.staffLines.top + ((8 - i) * spacing);
      ctx.beginPath();
      ctx.moveTo(x - lineLength/2, ledgerY);
      ctx.lineTo(x + lineLength/2, ledgerY);
      ctx.stroke();
    }
  }
}

// Draw explosions using sprite sheet
function drawExplosions() {
  explosions.forEach(explosion => {
    // Skip if explosion image not loaded yet
    if (!images.explosion || !images.explosion.complete) {
      return;
    }
    
    const progress = (Date.now() - explosion.startTime) / explosion.duration;
    const alpha = 1 - progress;
    
    // Determine which frame to show based on progress through the explosion duration
    const frameProgress = Math.floor(progress * explosion.frames.length);
    const currentFrameIndex = Math.min(frameProgress, explosion.frames.length - 1);
    const frameNumber = explosion.frames[currentFrameIndex];
    
    // Calculate sprite sheet coordinates (3x3 grid)
    const row = Math.floor(frameNumber / EXPLOSION_FRAMES.gridSize);
    const col = frameNumber % EXPLOSION_FRAMES.gridSize;
    const sourceX = col * EXPLOSION_FRAMES.frameSize;
    const sourceY = row * EXPLOSION_FRAMES.frameSize;
    
    ctx.save();
    ctx.globalAlpha = alpha;
    
    // Draw the explosion frame centered on the explosion position
    const drawSize = explosion.size;
    ctx.drawImage(
      images.explosion,
      sourceX, sourceY, EXPLOSION_FRAMES.frameSize, EXPLOSION_FRAMES.frameSize, // Source rectangle
      explosion.x - drawSize/2, explosion.y - drawSize/2, drawSize, drawSize    // Destination rectangle
    );
    
    ctx.restore();
  });
}

// Check if there's enough space to spawn a new note without overlap
function canSpawnNote(minDistance = 100) {
  // For normal mode (not piano mode), only allow one note at a time
  if (!pianoModeActive && movingNotes.length > 0) {
    return false;
  }
  
  if (movingNotes.length === 0) return true;
  
  // Piano mode logic (existing behavior)
  // Find the rightmost note
  const rightmostNote = movingNotes.reduce((rightmost, note) => {
    return note.x > rightmost.x ? note : rightmost;
  }, movingNotes[0]);
  
  // Calculate spawn position at right edge of stave (matches spawnNote function logic)
  let spawnX = canvas.width + 20; // Default fallback
  if (currentClef === 'grand') {
    // For grand staff, use treble stave as reference
    if (currentTrebleStave) {
      spawnX = currentTrebleStave.x + currentTrebleStave.width; // Right edge of stave
    }
  } else if (currentClef === 'treble' && currentTrebleStave) {
    spawnX = currentTrebleStave.x + currentTrebleStave.width; // Right edge of treble stave
  } else if (currentClef === 'bass' && currentBassStave) {
    spawnX = currentBassStave.x + currentBassStave.width; // Right edge of bass stave
  }
  
  // Check if there's enough distance from the rightmost note to the spawn point
  const distance = spawnX - rightmostNote.x;
  
  // Always allow spawning if there are fewer than 3 notes on screen to ensure gameplay continues
  if (movingNotes.length < 3) {
    return true;
  }
  
  return distance >= minDistance;
}

// Spawn moving note only (no meteors) - continuous spawning
function spawnNote() {
  const now = Date.now();
  
  // Check what type of note will be spawned to adjust timing
  const isChordSpawn = pianoModeActive && 
    (pianoModeSettings.leftHand === 'chords' || pianoModeSettings.rightHand === 'chords');
  
  // Piano Mode speed adjustment with different rates for chords vs melody
  let effectiveSpawnRate = noteSpawnRate;
  if (pianoModeActive) {
    // Check if both hands are in melody mode for special displacement handling
    const bothHandsMelody = (pianoModeSettings.leftHand !== 'none' && pianoModeSettings.leftHand !== 'chords') &&
                           (pianoModeSettings.rightHand !== 'none' && pianoModeSettings.rightHand !== 'chords');
    
    if (isChordSpawn) {
      // Chords come at same speed as normal mode
      effectiveSpawnRate = Math.floor(noteSpawnRate * 1.0); // Same speed as normal mode
    } else if (bothHandsMelody) {
      // Different speeds for each hand when both are melody, but closer spacing allowed
      const leftHandSpawnRate = Math.floor(noteSpawnRate * 0.9); // Left hand 10% faster
      const rightHandSpawnRate = Math.floor(noteSpawnRate * 1.0); // Right hand normal speed
      // Use alternating spawn rates to create displacement
      effectiveSpawnRate = (now % 2 === 0) ? leftHandSpawnRate : rightHandSpawnRate;
    } else {
      // Melody comes at normal speed
      effectiveSpawnRate = Math.floor(noteSpawnRate * 1.0); // Same speed as normal mode
    }
  }
  
  if (now - lastNoteSpawn > effectiveSpawnRate) {
    // Check if there's enough space to spawn a new note without overlap
    // Use consistent 120px spacing for non-piano mode, flexible spacing for piano mode
    const minDistance = pianoModeActive ? 80 : 120; // Tighter spacing for piano mode
    if (!canSpawnNote(minDistance)) {
      return; // Don't spawn if there would be overlap
    }
    
    const noteData = pickRandomNote(); // Now returns note object directly or array for chords
    
    // Speed increases more gradually from level 3 onward
    let baseSpeed;
    if (level === 1) {
      baseSpeed = 0.8; // Starting speed
    } else if (level === 2) {
      baseSpeed = 1.4; // 75% faster than level 1
    } else if (level === 3) {
      baseSpeed = 1.8; // More gradual increase from level 2
    } else if (level === 4) {
      baseSpeed = 2.2; // Gradual increase
    } else {
      // Slightly increased progression for higher levels (improved acceleration after level 3)
      baseSpeed = 2.2 + (level - 4) * 0.4; // Each level adds 0.4 speed (increased from 0.3)
    }
    
    // Piano Mode speed adjustment for note movement
    if (pianoModeActive) {
      // Check if both hands are in melody mode for different speed handling  
      const bothHandsMelody = (pianoModeSettings.leftHand !== 'none' && pianoModeSettings.leftHand !== 'chords') &&
                             (pianoModeSettings.rightHand !== 'none' && pianoModeSettings.rightHand !== 'chords');
      
      if (Array.isArray(noteData)) {
        // Chords move slower
        baseSpeed = baseSpeed * 0.7; // 30% slower movement for chords
      } else if (bothHandsMelody) {
        // Different speeds for each hand when both are melody
        if (noteData.clef === 'bass') {
          baseSpeed = baseSpeed * 0.95; // Left hand (bass) slightly faster
        } else if (noteData.clef === 'treble') {
          baseSpeed = baseSpeed * 0.85; // Right hand (treble) slower
        } else {
          baseSpeed = baseSpeed * 0.9; // Default melody speed
        }
      } else {
        // Melody moves at normal Piano Mode speed
        baseSpeed = baseSpeed * 0.9; // 10% slower movement for melody
      }
    }
    
    // Handle chord mode (multiple notes)
    if (Array.isArray(noteData)) {
      // Spawn chord (multiple notes at once)
      // Calculate spawn position at right edge of stave
      let spawnX = canvas.width + 20; // Default fallback
      if (currentClef === 'grand') {
        // For grand staff, use treble stave position (notes will be filtered by clef anyway)
        if (currentTrebleStave) {
          spawnX = currentTrebleStave.x + currentTrebleStave.width; // Right edge of stave
        }
      } else if (currentClef === 'treble' && currentTrebleStave) {
        spawnX = currentTrebleStave.x + currentTrebleStave.width; // Right edge of treble stave
      } else if (currentClef === 'bass' && currentBassStave) {
        spawnX = currentBassStave.x + currentBassStave.width; // Right edge of bass stave
      }
      const baseX = spawnX;
      const chordId = Date.now();
      
      noteData.forEach((singleNote, index) => {
        // Calculate displacement for adjacent notes (one staff position apart)
        let xOffset = 0;
        if (index > 0) {
          const prevNote = noteData[index - 1];
          const staffDiff = Math.abs(singleNote.staffLocalIndex - prevNote.staffLocalIndex);
          if (staffDiff === 1) {
            // Adjacent notes get displaced slightly
            xOffset = (index % 2 === 0) ? -8 : 8; // Alternate left/right displacement
          }
        }
        
        const movingNote = {
          x: baseX + xOffset, // Stack vertically with displacement for adjacent notes
          staffLocalIndex: singleNote.staffLocalIndex,
          note: singleNote.note,
          letter: singleNote.letter,
          octave: singleNote.octave,
          midi: singleNote.midi,
          scientific: singleNote.scientific,
          clef: singleNote.clef || currentClef,
          speed: baseSpeed,
          id: Date.now() + index,
          isChord: true,
          chordId: chordId, // Same chord ID for all notes in the chord
          // Keep legacy line property for compatibility during transition
          line: singleNote.line || singleNote.staffLocalIndex
        };
        movingNotes.push(movingNote);
      });
    } else {
      // Create single moving note
      // Calculate spawn position at right edge of stave
      let spawnX = canvas.width + 20; // Default fallback
      if (currentClef === 'grand') {
        // For grand staff, determine spawn position based on note's clef
        if (noteData.clef === 'treble' && currentTrebleStave) {
          spawnX = currentTrebleStave.x + currentTrebleStave.width; // Right edge of treble stave
        } else if (noteData.clef === 'bass' && currentBassStave) {
          spawnX = currentBassStave.x + currentBassStave.width; // Right edge of bass stave
        }
      } else if (currentClef === 'treble' && currentTrebleStave) {
        spawnX = currentTrebleStave.x + currentTrebleStave.width; // Right edge of treble stave
      } else if (currentClef === 'bass' && currentBassStave) {
        spawnX = currentBassStave.x + currentBassStave.width; // Right edge of bass stave
      }
      
      const movingNote = {
        x: spawnX, // Start from right edge of clef
        staffLocalIndex: noteData.staffLocalIndex,
        note: noteData.note,
        letter: noteData.letter,
        octave: noteData.octave,
        midi: noteData.midi,
        scientific: noteData.scientific,
        clef: noteData.clef || currentClef,
        speed: baseSpeed,
        id: Date.now(),
        // Keep legacy line property for compatibility during transition
        line: noteData.line || noteData.staffLocalIndex
      };
      
      movingNotes.push(movingNote);
    }
    
    lastNoteSpawn = now;
    
    // Spawn rate also increases gradually with level
    if (level === 1) {
      noteSpawnRate = 2200; // Starting spawn rate
    } else if (level === 2) {
      noteSpawnRate = 1600; // Faster spawning
    } else if (level === 3) {
      noteSpawnRate = 1400; // More gradual increase
    } else if (level === 4) {
      noteSpawnRate = 1200; // Gradual increase
    } else {
      // More gradual spawn rate increase for higher levels
      noteSpawnRate = Math.max(800, 1200 - (level - 4) * 50); // Each level reduces spawn time by only 50ms
    }
  }
}

// Force spawn a new note immediately (for single-note flow)
function forceSpawnNote() {
  // Reset spawn timing to allow immediate spawn
  lastNoteSpawn = 0;
  
  // Spawn the note immediately
  spawnNote();
}

// Spawn a replacement note when one is destroyed (wrong answer or collision)
function respawnNote() {
  // Check if there's enough space to spawn a new note without overlap
  // Use consistent 120px spacing for non-piano mode, flexible spacing for piano mode
  const minDistance = pianoModeActive ? 80 : 120; // Tighter spacing for piano mode
  if (!canSpawnNote(minDistance)) {
    // Try again shortly if there's not enough space
    setTimeout(respawnNote, 300); // Try again after 300ms
    return;
  }
  
  const noteData = pickRandomNote(); // Now returns note object directly
  
  // Use the same speed calculation as spawnNote
  let baseSpeed;
  if (level === 1) {
    baseSpeed = 0.8; // Starting speed
  } else if (level === 2) {
    baseSpeed = 1.4; // 75% faster than level 1
  } else if (level === 3) {
    baseSpeed = 1.8; // More gradual increase from level 2
  } else if (level === 4) {
    baseSpeed = 2.2; // Gradual increase
  } else {
    // Slightly increased progression for higher levels (improved acceleration after level 3)
    baseSpeed = 2.2 + (level - 4) * 0.4; // Each level adds 0.4 speed (increased from 0.3)
  }
  
  // Create moving note that slides across the staff using new data structure
  const movingNote = {
    x: canvas.width + 20, // Start from right side
    staffLocalIndex: noteData.staffLocalIndex,
    note: noteData.note,
    letter: noteData.letter,
    octave: noteData.octave,
    midi: noteData.midi,
    scientific: noteData.scientific,
    clef: noteData.clef || currentClef,
    speed: baseSpeed,
    id: Date.now(),
    // Keep legacy line property for compatibility during transition
    line: noteData.line || noteData.staffLocalIndex
  };
  
  movingNotes.push(movingNote);
}

// Update moving notes
function updateMovingNotes() {
  movingNotes.forEach((note, index) => {
    note.x -= note.speed;
    
    // Check if note reached the green line (collision point) - use dynamic positioning
    let greenLineCollisionX = 120; // Default fallback
    let staffClef, clefX, clefY, staffBottomY;
    
    // Get dynamic staff position based on current staff and note clef
    if (currentClef === 'grand') {
      if (note.clef === 'treble' && currentTrebleStave) {
        greenLineCollisionX = currentTrebleStave.clefX + 35; // Green line position
        staffClef = currentTrebleStave;
        clefX = currentTrebleStave.clefX;
        clefY = currentTrebleStave.clefY;
        staffBottomY = currentTrebleStave.y + 64; // Bottom of treble staff
      } else if (note.clef === 'bass' && currentBassStave) {
        greenLineCollisionX = currentBassStave.clefX + 35; // Green line position
        staffClef = currentBassStave;
        clefX = currentBassStave.clefX;
        clefY = currentBassStave.clefY;
        staffBottomY = currentBassStave.y + 64; // Bottom of bass staff
      }
    } else {
      if (currentClef === 'treble' && currentTrebleStave) {
        greenLineCollisionX = currentTrebleStave.clefX + 35; // Green line position
        staffClef = currentTrebleStave;
        clefX = currentTrebleStave.clefX;
        clefY = currentTrebleStave.clefY;
        staffBottomY = currentTrebleStave.y + 64; // Bottom of staff
      } else if (currentClef === 'bass' && currentBassStave) {
        greenLineCollisionX = currentBassStave.clefX + 35; // Green line position
        staffClef = currentBassStave;
        clefX = currentBassStave.clefX;
        clefY = currentBassStave.clefY;
        staffBottomY = currentBassStave.y + 64; // Bottom of staff
      }
    }
    
    if (note.x < greenLineCollisionX) {
      // Note hit the green line because player was too slow - lose a life and create explosion
      
      // Clean up chord progress if this was part of a chord
      if (note.isChord && chordProgress.has(note.chordId)) {
        chordProgress.delete(note.chordId);
      }
      
      movingNotes.splice(index, 1);
      
      // Create explosion at clef position, not at note position
      let explosionX, explosionY;
      explosionX = clefX; // Use clef X position for explosion
      explosionY = clefY; // Use clef Y position for explosion
      
      createClefExplosion(explosionX, explosionY, 60, 500);
      
      lives--;
      
      // Add shake effect - stronger shake for losing a life
      triggerShake(8, 500); // Medium intensity, half second
      
      playSound('explosionLoseLive');
      updateLifeDisplay();
      
      // Show feedback
      feedback.textContent = `Too slow! The note was ${note.note}`;
      feedback.style.color = '#d0021b';
      feedback.style.fontSize = '16px';
      
      // Spawn next note immediately for single-note flow
      forceSpawnNote();
      
      if (lives <= 0) {
        gameOver();
      }
    }
    
    // Remove notes that are off screen
    if (note.x < -50) {
      movingNotes.splice(index, 1);
    }
  });
}

// Update spaceship rotation (simplified - no meteors to track)
function updateSpaceship() {
  // Keep spaceship facing upward
  spaceship.targetRotation = 0;
  
  // Smoothly rotate towards target
  const rotationDiff = spaceship.targetRotation - spaceship.rotation;
  const shortestAngle = Math.atan2(Math.sin(rotationDiff), Math.cos(rotationDiff));
  spaceship.rotation += shortestAngle * 0.1; // Smooth rotation speed
}

// Update explosions
function updateExplosions() {
  explosions.forEach((explosion, index) => {
    const elapsed = Date.now() - explosion.startTime;
    if (elapsed > explosion.duration) {
      explosions.splice(index, 1);
    }
  });
}

// Game over
function gameOver() {
  gameRunning = false;
  stopBackgroundMusic();
  playSound('gameOver');
  
  // Reduced shake effect to prevent freeze - shorter duration and lower intensity
  triggerShake(6, 500); // Lower intensity, shorter duration (0.5 seconds)
  
  // Minimal explosion effects instead of the heavy game over explosions
  // Just a few small explosions instead of 12 large ones
  if (currentClef === 'grand') {
    // For grand staff, create minimal explosions
    if (currentTrebleStave) {
      createMinimalExplosions(currentTrebleStave.clefX, currentTrebleStave.clefY);
    }
    if (currentBassStave) {
      createMinimalExplosions(currentBassStave.clefX, currentBassStave.clefY);
    }
  } else {
    // Single staff - create minimal explosions for the active clef
    let clefX = 35; // Default fallback  
    let clefY = canvas.height * 0.2 + 60; // Default fallback
    
    if (currentClef === 'treble' && currentTrebleStave) {
      clefX = currentTrebleStave.clefX;
      clefY = currentTrebleStave.clefY;
    } else if (currentClef === 'bass' && currentBassStave) {
      clefX = currentBassStave.clefX;
      clefY = currentBassStave.clefY;
    }
    
    // Create minimal explosions for single staff
    createMinimalExplosions(clefX, clefY);
  }
  
  // Check and save high score
  checkAndSaveHighScore();
  
  feedback.textContent = `Game Over! Level ${level} reached. Notes destroyed: ${notesDestroyed}! Final Score: ${score}`;
  feedback.style.color = '#d0021b';
  feedback.style.fontSize = '24px';
  restartBtn.style.display = 'inline-block';
  
  // Add return to menu button
  if (!document.getElementById('menuBtn')) {
    const menuBtn = document.createElement('button');
    menuBtn.id = 'menuBtn';
    menuBtn.textContent = 'Return to Menu';
    menuBtn.style.cssText = `
      font-size: 18px; padding: 8px 16px; border-radius: 4px; border: none;
      background: #6c757d; color: #fff; cursor: pointer; margin-left: 6px;
    `;
    menuBtn.onclick = () => window.location.href = 'menu.html';
    restartBtn.parentNode.appendChild(menuBtn);
  }
}

// Check and save high score
function checkAndSaveHighScore() {
  // Load current high scores
  let highScores = { treble: 0, bass: 0, grand: 0 };
  const saved = localStorage.getItem('noteGameHighScores');
  if (saved) {
    highScores = { ...highScores, ...JSON.parse(saved) };
  }
  
  // Check if current score is a new high score for the current clef
  if (score > highScores[currentClef]) {
    highScores[currentClef] = score;
    localStorage.setItem('noteGameHighScores', JSON.stringify(highScores));
    
    // Show high score message
    feedback.textContent = `NEW HIGH SCORE! Level ${level} reached. Notes destroyed: ${notesDestroyed}! Score: ${score}`;
    feedback.style.color = '#FFD700'; // Gold color for high score
  }
}

// Restart game
async function restartGame() {
  gameRunning = true;
  lives = 3; // New 3-life system
  notesDestroyed = 0;
  score = 0;
  level = 1;
  correctAnswers = 0;
  // Reset Piano Mode hand scores
  leftHandScore = 0;
  rightHandScore = 0;
  
  // Hide Piano Mode controls during gameplay
  const pianoModeControls = document.getElementById('pianoModeControls');
  if (pianoModeControls) {
    pianoModeControls.style.display = 'none';
  }
  
  // Clear Piano Mode chord progress tracking to prevent input blocking
  chordProgress.clear();
  
  movingNotes = [];
  explosions = [];
  lasers = [];
  gameStartTime = Date.now();
  lastNoteSpawn = 0;
  noteSpawnRate = 2200; // Reset to level 1 spawn rate
  flashEffect.active = false;
  
  // Reset spaceship rotation
  spaceship.rotation = 0;
  spaceship.targetRotation = 0;
  
  // Reinitialize MIDI connections to ensure they work after restart
  if (typeof window.reinitializeMidiAfterRestart === 'function') {
    window.reinitializeMidiAfterRestart();
  }
  
  // Restart music system - start all tracks and then update for current level
  if (gameSettings.music) {
    await startAllMusicTracks();
  }
  updateMusicForLevel(level);
  
  // Update displays
  updateLifeDisplay();
  notesDestroyedDisplay.textContent = `Notes Destroyed: ${notesDestroyed}`;
  scoreDisplay.textContent = `Score: ${score}`;
  feedback.textContent = '';
  
  // Update clef display
  updateClefDisplay();
  
  restartBtn.style.display = 'none';
  
  gameLoop();
}

// Helper function to filter notes for Piano Mode clef separation
function getNotesForPianoModeHand(hand, clef, availableNotes) {
  if (hand === 'none') return [];
  
  let handNotes = availableNotes.filter(note => note.clef === clef);
  
  // Apply Piano Mode note range limits
  if (clef === 'bass') {
    // Bass clef: highest note should be B3
    handNotes = handNotes.filter(note => {
      const midi = note.midi || scientificToMidi(note.letter, note.octave);
      const b3Midi = scientificToMidi('B', 3);
      return midi <= b3Midi;
    });
  } else if (clef === 'treble') {
    // Treble clef: lowest note should be C4  
    handNotes = handNotes.filter(note => {
      const midi = note.midi || scientificToMidi(note.letter, note.octave);
      const c4Midi = scientificToMidi('C', 4);
      return midi >= c4Midi;
    });
  }
  
  return handNotes;
}

function pickRandomNote() {
  const arr = notePositions[currentClef];
  let availableNotes = arr;
  
  // Piano Mode enhancements
  if (pianoModeActive) {
    // In Piano Mode, force Grand Staff if enabled
    if (currentClef !== 'grand') {
      currentClef = 'grand';
      drawStaff(currentClef);
      document.getElementById('clefDisplay').textContent = 'Clef selected: Grand Stave (Piano Mode)';
      // Update available notes for grand staff
      availableNotes = notePositions[currentClef];
    }
    
    // Handle accidentals removed
  }
  
  // Filter notes based on ledger line settings using staffLocalIndex
  if (maxLedgerLines === 0) {
    // No ledger lines - only staff notes (staffLocalIndex 0-8 for 5-line staff)
    availableNotes = availableNotes.filter(notePos => {
      return notePos.staffLocalIndex >= 0 && notePos.staffLocalIndex <= 8;
    });
  } else {
    // Filter based on maximum ledger lines allowed
    availableNotes = availableNotes.filter(notePos => {
      if (currentClef === 'grand') {
        // For grand staff, both treble and bass use staff-local indexing
        // Allow ledger lines symmetrically around each staff
        return notePos.staffLocalIndex >= -maxLedgerLines && 
               notePos.staffLocalIndex <= 8 + maxLedgerLines;
      } else {
        // For single clef: allow full range based on maxLedgerLines
        return notePos.staffLocalIndex >= -maxLedgerLines && 
               notePos.staffLocalIndex <= 8 + maxLedgerLines;
      }
    });
  }
  
  // Fallback to all notes if filtering results in empty array
  if (availableNotes.length === 0) {
    availableNotes = arr;
  }
  
  // Handle Piano Mode - separate hands with different roles
  if (pianoModeActive) {
    const leftHandMode = pianoModeSettings.leftHand;
    const rightHandMode = pianoModeSettings.rightHand;
    
    // Determine which hands are active
    const leftHandActive = leftHandMode !== 'none';
    const rightHandActive = rightHandMode !== 'none';
    
    if (leftHandActive || rightHandActive) {
      // Randomly choose which hand to generate for (weighted by which hands are active)
      const activeHands = [];
      if (leftHandActive) activeHands.push('left');
      if (rightHandActive) activeHands.push('right');
      
      const chosenHand = activeHands[Math.floor(Math.random() * activeHands.length)];
      
      if (chosenHand === 'left' && leftHandActive) {
        // Generate for left hand (bass clef)
        const bassNotes = getNotesForPianoModeHand(leftHandMode, 'bass', availableNotes);
        if (bassNotes.length > 0) {
          if (leftHandMode === 'chords' && bassNotes.length >= 2) {
            return generateChord(bassNotes);
          } else {
            // Melody mode or not enough notes for chord
            const randomIndex = Math.floor(Math.random() * bassNotes.length);
            return bassNotes[randomIndex];
          }
        }
      } else if (chosenHand === 'right' && rightHandActive) {
        // Generate for right hand (treble clef)
        const trebleNotes = getNotesForPianoModeHand(rightHandMode, 'treble', availableNotes);
        if (trebleNotes.length > 0) {
          if (rightHandMode === 'chords' && trebleNotes.length >= 2) {
            return generateChord(trebleNotes);
          } else {
            // Melody mode or not enough notes for chord
            const randomIndex = Math.floor(Math.random() * trebleNotes.length);
            return trebleNotes[randomIndex];
          }
        }
      }
    }
  }
  
  // Return a random note from available notes (return the note object directly)
  const randomIndex = Math.floor(Math.random() * availableNotes.length);
  return availableNotes[randomIndex];
}

// Generate a chord (2-4 notes) for Piano Mode chord mode
function generateChord(availableNotes) {
  if (availableNotes.length < 2) {
    // Fallback to single note if not enough notes available
    return availableNotes[0];
  }
  
  // Enhanced chord range generation - allow spanning up to an octave
  // Sort all available notes by pitch first
  const sortedNotes = [...availableNotes].sort((a, b) => {
    const aPitch = scientificToMidi(a.letter, a.octave);
    const bPitch = scientificToMidi(b.letter, b.octave);
    return aPitch - bPitch;
  });
  
  // Determine chord size (2-4 notes)
  const chordSize = Math.floor(Math.random() * 3) + 2; // 2, 3, or 4 notes
  const actualChordSize = Math.min(chordSize, sortedNotes.length);
  
  // Select notes that can span up to an octave (12 semitones)
  const selectedNotes = [];
  const maxSpread = 12; // One octave in semitones
  
  // Start with a random base note
  const baseIndex = Math.floor(Math.random() * (sortedNotes.length - actualChordSize + 1));
  const baseNote = sortedNotes[baseIndex];
  const basePitch = scientificToMidi(baseNote.letter, baseNote.octave);
  selectedNotes.push(baseNote);
  
  // Add additional notes within the octave range
  const usedIndices = new Set([baseIndex]);
  
  for (let i = 1; i < actualChordSize; i++) {
    let attempts = 0;
    let foundNote = false;
    
    // Try to find notes within the octave range
    while (attempts < 50 && !foundNote) { // Prevent infinite loops
      const candidateIndex = Math.floor(Math.random() * sortedNotes.length);
      
      if (usedIndices.has(candidateIndex)) {
        attempts++;
        continue;
      }
      
      const candidateNote = sortedNotes[candidateIndex];
      const candidatePitch = scientificToMidi(candidateNote.letter, candidateNote.octave);
      const pitchDiff = Math.abs(candidatePitch - basePitch);
      
      // Accept notes within an octave range
      if (pitchDiff <= maxSpread) {
        selectedNotes.push(candidateNote);
        usedIndices.add(candidateIndex);
        foundNote = true;
      }
      
      attempts++;
    }
    
    // If we couldn't find a note in range, just pick the next available note
    if (!foundNote && usedIndices.size < sortedNotes.length) {
      for (let j = 0; j < sortedNotes.length; j++) {
        if (!usedIndices.has(j)) {
          selectedNotes.push(sortedNotes[j]);
          usedIndices.add(j);
          break;
        }
      }
    }
  }
  
  // Sort final selected notes by pitch (lowest to highest) for better visual presentation
  selectedNotes.sort((a, b) => {
    const aPitch = scientificToMidi(a.letter, a.octave);
    const bPitch = scientificToMidi(b.letter, b.octave);
    return aPitch - bPitch;
  });
  
  // Return an array of notes instead of a single note
  return selectedNotes;
}

// Update clef display in game
function updateClefDisplay() {
  const clefDisplay = document.getElementById('clefDisplay');
  if (clefDisplay) {
    const clefNames = {
      'treble': 'Treble Clef',
      'bass': 'Bass Clef', 
      'grand': 'Grand Stave'
    };
    clefDisplay.textContent = `Clef selected: ${clefNames[currentClef]}`;
  }
  
  // Update hand score visibility when clef changes
  updateHandScoreVisibility();
}

// Initialize game
async function initializeGame() {
  // Settings are already loaded by loadGameSettings() before this function is called
  
  // Update clef selector if it exists
  if (clefSelect) {
    clefSelect.value = currentClef;
  }
  
  // Update clef display
  updateClefDisplay();
  
  // Load images
  await loadImages();
  
  // Initialize canvas size
  resizeCanvas();
  
  // Start layered background music system (all tracks start muted)
  if (gameSettings.music) {
    await startAllMusicTracks();
    updateMusicForLevel(level);
  }
  
  // Hide Piano Mode controls during gameplay
  const pianoModeControls = document.getElementById('pianoModeControls');
  if (pianoModeControls) {
    pianoModeControls.style.display = 'none';
  }
  
  // Initialize display values
  updateLifeDisplay();
  notesDestroyedDisplay.textContent = `Notes Destroyed: ${notesDestroyed}`;
  scoreDisplay.textContent = `Score: ${score}`;
  updateHandScoreVisibility(); // Initialize hand score display visibility
  
  gameInitialized = true;
  gameLoop();
}

// Main game loop
function gameLoop() {
  if (gameRunning) {
    drawStaff(currentClef); // Draw staff first to ensure stave objects exist
    spawnNote(); // Changed from spawnNoteAndMeteor
    updateMovingNotes();
    updateSpaceship();
    updateExplosions();
    
    // FIXED: Remove throttled cleanup from game loop - now runs immediately on MIDI input
    // Chord cleanup is now handled directly in handleNoteInputWithOctave for responsive input
    
    requestAnimationFrame(gameLoop);
  }
}

// Handle note input directly from keyboard
async function handleNoteInput(userNote) {
  if (!gameRunning) return;
  
  // Try to start music on first interaction
  await tryStartMusic();
  
  if (!userNote) return;
  
  // For Piano Mode, use more specific note matching
  await handleNoteInputWithOctave(userNote, null); // No octave info from keyboard
}

// Enhanced note input handler with octave support for Piano Mode
async function handleNoteInputWithOctave(userNote, userOctave) {
  if (!gameRunning) return;
  
  // FIXED: Clean up stale chord progress immediately on every input to prevent registration failures
  // This ensures responsive chord input by removing the 5-second throttling that was blocking new input
  cleanupStaleChordProgress();
  
  // Find the leftmost note (closest to clef) - with special handling for piano mode hand independence
  let leftmostNote = null;
  let leftmostIndex = -1;
  let minDistance = Infinity;
  
  // For piano mode with hand independence, only consider notes from active hands' clefs
  movingNotes.forEach((note, index) => {
    if (note.note.toUpperCase() === userNote) {
      // In piano mode, check if this note belongs to an active hand
      if (pianoModeActive && currentClef === 'grand') {
        const leftHandActive = pianoModeSettings.leftHand !== 'none';
        const rightHandActive = pianoModeSettings.rightHand !== 'none';
        
        // Only consider notes from clefs that have active hands
        const noteIsFromActiveHand = 
          (note.clef === 'bass' && leftHandActive) || 
          (note.clef === 'treble' && rightHandActive);
        
        if (!noteIsFromActiveHand) {
          return; // Skip notes from inactive hands
        }
      }
      
      const distance = note.x;
      if (distance < minDistance) {
        minDistance = distance;
        leftmostNote = note;
        leftmostIndex = index;
      }
    }
  });
  
  // For chord mode, find all notes with the same chord ID
  let chordNotes = [];
  let chordIndices = [];
  
  // If this is a chord, find all notes with the same chord ID
  if (leftmostNote && leftmostNote.isChord) {
    movingNotes.forEach((note, index) => {
      if (note.chordId === leftmostNote.chordId) {
        chordNotes.push(note);
        chordIndices.push(index);
      }
    });
  } else {
    chordNotes = [leftmostNote];
    chordIndices = [leftmostIndex];
  }
  
  // Check if user input matches any note in the chord
  let matchFound = false;
  let matchedNote = null;
  let matchedIndex = -1;
  
  for (let i = 0; i < chordNotes.length; i++) {
    const note = chordNotes[i];
    const index = chordIndices[i];
    
    if (note && note.note.toUpperCase() === userNote) {
      // Check strict mode for Piano Mode
      if (pianoModeActive && pianoModeSettings.strictMode && userOctave !== null) {
        // In strict mode, octave must match exactly
        if (note.octave !== userOctave) {
          continue; // Try next note in chord
        }
      }
      
      matchFound = true;
      matchedNote = note;
      matchedIndex = index;
      break;
    }
  }
  
  if (matchFound && matchedNote) {
    // For chord handling - require all notes to be pressed
    if (matchedNote.isChord) {
      const chordId = matchedNote.chordId;
      
      // Get all notes in this chord
      const allChordNotes = movingNotes.filter(note => 
        note.isChord && note.chordId === chordId
      );
      
      // Track which notes have been pressed with timestamps for grace period
      const currentTime = Date.now();
      const gracePeriodsMs = 300; // Increased to 300ms grace period for more forgiving chord completion
      
      if (!chordProgress.has(chordId)) {
        chordProgress.set(chordId, {
          pressedNotes: new Set(),
          timestamps: new Map(),
          firstPressTime: currentTime
        });
      }
      const chordData = chordProgress.get(chordId);
      
      // Check if we're still within the grace period or if this is a continuation of the same chord
      const timeSinceFirstPress = currentTime - chordData.firstPressTime;
      if (timeSinceFirstPress > gracePeriodsMs && chordData.pressedNotes.size > 0) {
        // If grace period expired but we had some progress, be more lenient
        // Only reset if we've been completely idle for a while
        if (timeSinceFirstPress > gracePeriodsMs * 3) {
          chordData.pressedNotes.clear();
          chordData.timestamps.clear();
          chordData.firstPressTime = currentTime;
        }
      }
      
      // Add this note to pressed notes with timestamp
      const noteKey = matchedNote.note.toUpperCase();
      chordData.pressedNotes.add(noteKey);
      chordData.timestamps.set(noteKey, currentTime);
      
      // Check if all notes in chord have been pressed within grace period
      const allNoteLetters = new Set(allChordNotes.map(note => note.note.toUpperCase()));
      const allPressed = [...allNoteLetters].every(noteLetter => chordData.pressedNotes.has(noteLetter));
      
      // Safety check: ensure we don't have more pressed notes than the chord actually contains
      if (chordData.pressedNotes.size > allNoteLetters.size) {
        console.warn(`Chord progress has more notes than chord contains. Resetting. ChordId: ${chordId}`);
        chordData.pressedNotes.clear();
        chordData.timestamps.clear();
        chordData.firstPressTime = currentTime;
        chordData.pressedNotes.add(noteKey);
        chordData.timestamps.set(noteKey, currentTime);
      }
      
      // Chord lockout timer removed - accept chord completion if all notes are pressed within grace period
      
      if (allPressed) {
        // All notes pressed - complete the chord
        score++;
        notesDestroyed++;
        correctAnswers++;
        
        // Piano Mode: Track separate hand scores
        if (pianoModeActive && currentClef === 'grand') {
          if (matchedNote.clef === 'bass') {
            leftHandScore++;
          } else if (matchedNote.clef === 'treble') {
            rightHandScore++;
          }
          updateDisplays(); // Update hand score displays immediately
        }
        
        // Calculate note position for laser effect using first chord note
        const firstChordNote = allChordNotes[0];
        let staffInfo;
        let noteY;
        
        if (currentClef === 'grand') {
          if (firstChordNote.clef === 'treble' && currentTrebleStave) {
            staffInfo = currentTrebleStave;
            noteY = getNoteY(firstChordNote, staffInfo);
          } else if (firstChordNote.clef === 'bass' && currentBassStave) {
            staffInfo = currentBassStave;
            noteY = getNoteY(firstChordNote, staffInfo);
          }
        } else {
          if (currentClef === 'treble' && currentTrebleStave) {
            staffInfo = currentTrebleStave;
            noteY = getNoteY(firstChordNote, staffInfo);
          } else if (currentClef === 'bass' && currentBassStave) {
            staffInfo = currentBassStave;
            noteY = getNoteY(firstChordNote, staffInfo);
          }
        }
        
        // Create laser effect and explosion
        if (staffInfo && noteY !== undefined) {
          lasers.push({
            startX: spaceship.x,
            startY: spaceship.y,
            targetX: firstChordNote.x,
            targetY: noteY,
            startTime: Date.now(),
            duration: 300
          });
          
          explosions.push({
            x: firstChordNote.x,
            y: noteY,
            size: 50,
            startTime: Date.now(),
            duration: 400,
            frames: generateExplosionFrames(),
            currentFrameIndex: 0
          });
        }
        
        // Remove all notes in the chord
        for (let i = movingNotes.length - 1; i >= 0; i--) {
          if (movingNotes[i].isChord && movingNotes[i].chordId === chordId) {
            movingNotes.splice(i, 1);
          }
        }
        
        // Clean up chord progress tracking
        chordProgress.delete(chordId);
        
        // Spawn next note immediately for single-note flow
        forceSpawnNote();
        
        feedback.textContent = `Chord Complete! +1 point!`;
        feedback.style.color = '#00ff00';
        feedback.style.fontSize = '16px';
        
        // Play sound effects
        playSound('laser');
        setTimeout(() => playSound('meteorExplosion'), 100);
        
      } else {
        // Not all notes pressed yet or not simultaneous - show progress but don't remove notes or count score
        const remaining = allNoteLetters.size - chordData.pressedNotes.size;
        let message = `Chord progress: ${chordData.pressedNotes.size}/${allNoteLetters.size} notes pressed`;
        
        if (allPressed && !simultaneousPress) {
          message += ` (not simultaneous - press together!)`;
        }
        
        feedback.textContent = message;
        feedback.style.color = '#ffff00';
        feedback.style.fontSize = '16px';
        // No score increment, no note removal, no laser effects
        // Return early to skip level progression logic
        updateDisplays();
        return;
      }
    } else {
      // Single note (not a chord) - normal processing
      score++;
      notesDestroyed++;
      correctAnswers++;
      
      // Piano Mode: Track separate hand scores
      if (pianoModeActive && currentClef === 'grand') {
        if (matchedNote.clef === 'bass') {
          leftHandScore++;
        } else if (matchedNote.clef === 'treble') {
          rightHandScore++;
        }
        updateDisplays(); // Update hand score displays immediately
      }
      
      // Calculate note position for laser target
      let staffInfo;
      let noteY;
      
      if (currentClef === 'grand') {
        if (matchedNote.clef === 'treble' && currentTrebleStave) {
          staffInfo = currentTrebleStave;
          noteY = getNoteY(matchedNote, staffInfo);
        } else if (matchedNote.clef === 'bass' && currentBassStave) {
          staffInfo = currentBassStave;
          noteY = getNoteY(matchedNote, staffInfo);
        }
      } else {
        if (currentClef === 'treble' && currentTrebleStave) {
          staffInfo = currentTrebleStave;
          noteY = getNoteY(matchedNote, staffInfo);
        } else if (currentClef === 'bass' && currentBassStave) {
          staffInfo = currentBassStave;
          noteY = getNoteY(matchedNote, staffInfo);
        }
      }
      
      // Create laser effect and explosion
      if (staffInfo && noteY !== undefined) {
        lasers.push({
          startX: spaceship.x,
          startY: spaceship.y,
          targetX: matchedNote.x,
          targetY: noteY,
          startTime: Date.now(),
          duration: 300
        });
        
        explosions.push({
          x: matchedNote.x,
          y: noteY,
          size: 50,
          startTime: Date.now(),
          duration: 400,
          frames: generateExplosionFrames(),
          currentFrameIndex: 0
        });
      }
      
      // Remove the single note
      movingNotes.splice(matchedIndex, 1);
      
      // Spawn next note immediately for single-note flow
      forceSpawnNote();
      
      feedback.textContent = `Correct! The note was ${matchedNote.note}`;
      feedback.style.color = '#00ff00';
      feedback.style.fontSize = '16px';
      
      // Play sound effects
      playSound('laser');
      setTimeout(() => playSound('meteorExplosion'), 100);
    }
    
    // Check for level progression
    let canAdvanceLevel = false;
    
    if (pianoModeActive && currentClef === 'grand') {
      // Piano Mode: level up when all active hands reach level 10
      const leftHandActive = pianoModeSettings.leftHand !== 'none';
      const rightHandActive = pianoModeSettings.rightHand !== 'none';
      
      if (leftHandActive && rightHandActive) {
        // Both hands active - need both to reach 10
        if (leftHandScore >= 10 && rightHandScore >= 10) {
          canAdvanceLevel = true;
          // Reset hand scores for next level
          leftHandScore = 0;
          rightHandScore = 0;
          feedback.textContent = `Level ${level + 1}! Both hands mastered!`;
        } else {
          // Show progress for both hands with waiting feedback
          let progressText = `Left: ${leftHandScore}/10, Right: ${rightHandScore}/10`;
          if (leftHandScore >= 10) {
            progressText = `🏆 Left hand ready! Right: ${rightHandScore}/10`;
          } else if (rightHandScore >= 10) {
            progressText = `Left: ${leftHandScore}/10 🏆 Right hand ready!`;
          }
          feedback.textContent = progressText;
        }
      } else if (leftHandActive && !rightHandActive) {
        // Only left hand active
        if (leftHandScore >= 10) {
          canAdvanceLevel = true;
          leftHandScore = 0;
          feedback.textContent = `Level ${level + 1}! Left hand mastered!`;
        } else {
          feedback.textContent = `Left Hand: ${leftHandScore}/10`;
        }
      } else if (!leftHandActive && rightHandActive) {
        // Only right hand active
        if (rightHandScore >= 10) {
          canAdvanceLevel = true;
          rightHandScore = 0;
          feedback.textContent = `Level ${level + 1}! Right hand mastered!`;
        } else {
          feedback.textContent = `Right Hand: ${rightHandScore}/10`;
        }
      } else {
        // Neither hand active - fallback to normal scoring
        if (correctAnswers >= 10) {
          canAdvanceLevel = true;
        }
      }
    } else {
      // Normal mode: every 10 correct answers
      if (correctAnswers >= 10) {
        canAdvanceLevel = true;
      }
    }
    
    if (canAdvanceLevel) {
      level++;
      correctAnswers = 0;
      
      // Clear all notes on screen when advancing to new level
      movingNotes = [];
      
      // Show level popup
      showLevelPopup(level);
      
      if (!pianoModeActive || currentClef !== 'grand') {
        feedback.textContent = `Level ${level}! Speed increased!`;
      }
      feedback.style.color = '#ffff00';
      
      // Update music layers for the new level
      updateMusicForLevel(level);
      
      // Bonus life at level 4 and 8
      if (level === 4 || level === 8) {
        if (lives < 3) { // Only add life if below max
          lives++;
          feedback.textContent = `Level ${level}! Bonus life gained!`;
          updateLifeDisplay();
        }
      }
    }
    
  } else {
    // Wrong answer - no matching note found
    // Find the leftmost note to destroy (regardless of whether it matches user input)
    let leftmostNoteToDestroy = null;
    let minNoteDistance = Infinity;
    
    // Find the leftmost note respecting hand boundaries in piano mode
    movingNotes.forEach((note, index) => {
      // In piano mode, check if this note belongs to an active hand
      if (pianoModeActive && currentClef === 'grand') {
        const leftHandActive = pianoModeSettings.leftHand !== 'none';
        const rightHandActive = pianoModeSettings.rightHand !== 'none';
        
        // Only consider notes from clefs that have active hands
        const noteIsFromActiveHand = 
          (note.clef === 'bass' && leftHandActive) || 
          (note.clef === 'treble' && rightHandActive);
        
        if (!noteIsFromActiveHand) {
          return; // Skip notes from inactive hands
        }
      }
      
      // Find the leftmost note regardless of type (chord or single)
      if (note.x < minNoteDistance) {
        minNoteDistance = note.x;
        leftmostNoteToDestroy = note;
      }
    });
    
    // Destroy the leftmost note if found
    if (leftmostNoteToDestroy) {
      if (leftmostNoteToDestroy.isChord) {
        // For chords: destroy the entire chord
        const chordId = leftmostNoteToDestroy.chordId;
        const affectedClef = leftmostNoteToDestroy.clef;
        
        // Remove all notes in this chord
        for (let i = movingNotes.length - 1; i >= 0; i--) {
          if (movingNotes[i].isChord && movingNotes[i].chordId === chordId) {
            movingNotes.splice(i, 1);
          }
        }
        
        // Reset chord progress for this chord
        chordProgress.delete(chordId);
        
        feedback.textContent = `Wrong note! Chord deleted for ${affectedClef} clef.`;
        feedback.style.color = '#d0021b';
        feedback.style.fontSize = '16px';
      } else {
        // Single note - destroy immediately
        const noteIndex = movingNotes.indexOf(leftmostNoteToDestroy);
        if (noteIndex !== -1) {
          movingNotes.splice(noteIndex, 1);
        }
        
        feedback.textContent = `Wrong note! Note deleted. The note was ${leftmostNoteToDestroy.note}`;
        feedback.style.color = '#d0021b';
        feedback.style.fontSize = '16px';
      }
      
      // Spawn next note immediately after destruction
      forceSpawnNote();
    }
    
    lives--;
    
    // Add light shake effect for wrong answer
    triggerShake(3, 200); // Light intensity, short duration
    
    // Add randomized explosion at appropriate clef position
    let clefX = 35; // Default fallback  
    let clefY = canvas.height * 0.2 + 60; // Default fallback

    // Get dynamic clef position based on the note's clef (for grand staff) or current staff
    if (currentClef === 'grand' && leftmostNote) {
      // For grand staff, use the clef that corresponds to the wrong note
      if (leftmostNote.clef === 'treble' && currentTrebleStave) {
        clefX = currentTrebleStave.clefX;
        clefY = currentTrebleStave.clefY;
      } else if (leftmostNote.clef === 'bass' && currentBassStave) {
        clefX = currentBassStave.clefX;
        clefY = currentBassStave.clefY;
      }
    } else {
      if (currentClef === 'treble' && currentTrebleStave) {
        clefX = currentTrebleStave.clefX;
        clefY = currentTrebleStave.clefY;
      } else if (currentClef === 'bass' && currentBassStave) {
        clefX = currentBassStave.clefX;
        clefY = currentBassStave.clefY;
      }
    }
    
    createClefExplosion(clefX, clefY, 65, 500);
    
    // Flash screen red
    flashEffect.active = true;
    flashEffect.startTime = Date.now();
    
    playSound('explosionLoseLive');
    updateLifeDisplay();
    
    // Don't immediately spawn a new note - let the current one finish flashing
    
    if (lives <= 0) {
      gameOver();
    }
  }
  
  // Update displays
  scoreDisplay.textContent = `Score: ${score}`;
  notesDestroyedDisplay.textContent = `Notes Destroyed: ${notesDestroyed}`;
}

// Helper function to update score displays
function updateDisplays() {
  scoreDisplay.textContent = `Score: ${score}`;
  notesDestroyedDisplay.textContent = `Notes Destroyed: ${notesDestroyed}`;
  
  // Update hand scores if Piano Mode is active
  if (pianoModeActive && currentClef === 'grand') {
    leftHandDisplay.textContent = `Left Hand: ${leftHandScore}`;
    rightHandDisplay.textContent = `Right Hand: ${rightHandScore}`;
  }
}

// Helper function to show/hide hand score displays based on Piano Mode state
function updateHandScoreVisibility() {
  const showHandScores = pianoModeActive && currentClef === 'grand';
  leftHandDisplay.style.display = showHandScores ? 'block' : 'none';
  rightHandDisplay.style.display = showHandScores ? 'block' : 'none';
  
  if (showHandScores) {
    leftHandDisplay.textContent = `Left Hand: ${leftHandScore}`;
    rightHandDisplay.textContent = `Right Hand: ${rightHandScore}`;
  }
}

// Add keyboard listener for direct letter input
document.addEventListener('keydown', function(e) {
  if (!gameRunning) return;
  
  // Check if it's a letter A-G (case insensitive)
  const key = e.key.toUpperCase();
  if (key.match(/^[A-G]$/)) {
    handleNoteInput(key);
  }
});

// Restart button handler
if (restartBtn) {
  restartBtn.onclick = restartGame;
}

if (clefSelect) {
  clefSelect.onchange = function () {
    if (!gameRunning) {
      currentClef = clefSelect.value;
      // Clear existing notes and meteors when changing clef
      movingNotes = [];
      meteors = [];
      
      // Update clef display
      updateClefDisplay();
      
      // Update spaceship position for new clef
      updateSpaceshipPosition();
      
      // Redraw staff with new clef
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawStaff(currentClef);
    } else {
      // Reset to current clef if game is running
      this.value = currentClef;
    }
  };
}

window.onload = function () {
  // Load settings first
  loadGameSettings();
  
  // Hide MIDI-related elements on mobile devices
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    const midiControlGame = document.getElementById('midiControlGame');
    if (midiControlGame) {
      midiControlGame.style.display = 'none';
    }
  }
  
  initializeGame();
  
  // Hide Piano Mode controls immediately to prevent popup flash
  const pianoModeControls = document.getElementById('pianoModeControls');
  if (pianoModeControls) {
    pianoModeControls.style.display = 'none';
  }
  
  // Update clef display after DOM is ready
  updateClefDisplay();
  
  // Initialize audio controls
  const musicVolume = document.getElementById('musicVolume');
  const effectsVolume = document.getElementById('effectsVolume');
  const musicToggle = document.getElementById('musicToggle');
  const effectsToggle = document.getElementById('effectsToggle');
  
  if (musicVolume) {
    musicVolume.addEventListener('input', function() {
      // Update volume for all active music tracks
      updateMusicForLevel(level);
    });
  }
  
  if (effectsVolume) {
    effectsVolume.addEventListener('input', function() {
      const volume = parseFloat(this.value);
      Object.keys(audioFiles).forEach(key => {
        if (!key.includes('musicLevel')) {
          audioFiles[key].volume = volume;
        }
      });
    });
  }
  
  if (musicToggle) {
    musicToggle.addEventListener('click', async function() {
      gameSettings.music = !gameSettings.music;
      if (gameSettings.music) {
        await startAllMusicTracks();
        updateMusicForLevel(level);
        this.textContent = '🎵';
      } else {
        stopBackgroundMusic();
        this.textContent = '🔇';
      }
    });
  }
  
  if (effectsToggle) {
    effectsToggle.addEventListener('click', function() {
      gameSettings.soundEffects = !gameSettings.soundEffects;
      this.textContent = gameSettings.soundEffects ? '🔊' : '🔇';
    });
  }
  
  // Add click event listeners for pitch buttons
  document.querySelectorAll('.pitch-btn').forEach(button => {
    button.addEventListener('click', function() {
      const note = this.dataset.note;
      handleNoteInput(note);
      
      // Visual feedback on button press - blue to white to blue
      this.style.background = '#fff';
      this.style.color = '#4378ff';
      setTimeout(() => {
        this.style.background = 'linear-gradient(45deg, #4a90e2, #357abd)';
        this.style.color = 'white';
      }, 150);
    });
  });
  
  // Load ledger line setting from localStorage (set in menu)
  const savedSettings = localStorage.getItem('noteGameSettings');
  if (savedSettings) {
    const settings = JSON.parse(savedSettings);
    if (settings.ledgerLines !== undefined) {
      maxLedgerLines = settings.ledgerLines;
    }
  }
  
  // Set up MIDI device selector
  const midiDeviceSelector = document.getElementById('midiDeviceSelector');
  if (midiDeviceSelector) {
    midiDeviceSelector.addEventListener('change', function() {
      // This will be handled by the MIDI integration module
      if (window.handleDeviceSelection) {
        window.handleDeviceSelection(this.value);
      }
    });
  }
  
  // Make handleNoteInput globally accessible for MIDI integration
  window.handleNoteInput = handleNoteInput;
  window.handleNoteInputWithOctave = handleNoteInputWithOctave;
};

