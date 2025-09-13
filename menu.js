// Game settings that will be passed to the game
let gameSettings = {
  music: true,
  soundEffects: true,
  clef: 'treble',
  ledgerLines: 0,  // Default to none (easy)
  pianoMode: {
    enabled: false,
    active: false,  // New property for user activation
    strictMode: false,
    leftHand: 'none',
    rightHand: 'none'
  }
};

// Difficulty levels for ledger lines
const difficultyLevels = [
  { level: 0, label: 'Easy (No Ledger Lines)', ledgerLines: 0 },
  { level: 1, label: 'Medium (1 Line Each Side)', ledgerLines: 1 },
  { level: 2, label: 'Hard (2 Lines Each Side)', ledgerLines: 2 },
  { level: 3, label: 'Expert (3 Lines Each Side)', ledgerLines: 3 },
  { level: 4, label: 'Master (4 Lines Each Side)', ledgerLines: 4 }
];

let currentDifficultyLevel = 0;

// High scores storage
let highScores = {
  treble: 0,
  bass: 0,
  grand: 0
};

// Load high scores from localStorage
function loadHighScores() {
  const saved = localStorage.getItem('noteGameHighScores');
  if (saved) {
    highScores = { ...highScores, ...JSON.parse(saved) };
  }
  updateHighScoresDisplay();
}

// Save high scores to localStorage
function saveHighScores() {
  localStorage.setItem('noteGameHighScores', JSON.stringify(highScores));
}

// Update the high scores display
function updateHighScoresDisplay() {
  // Update modal display (if modal still exists)
  if (document.getElementById('trebleHighScore')) {
    document.getElementById('trebleHighScore').textContent = highScores.treble;
    document.getElementById('bassHighScore').textContent = highScores.bass;
    document.getElementById('grandHighScore').textContent = highScores.grand;
  }
  
  // Update always-visible display
  if (document.getElementById('trebleHighScoreDisplay')) {
    document.getElementById('trebleHighScoreDisplay').textContent = highScores.treble;
    document.getElementById('bassHighScoreDisplay').textContent = highScores.bass;
    document.getElementById('grandHighScoreDisplay').textContent = highScores.grand;
  }
}

// Reset high scores
function resetHighScores() {
  highScores = { treble: 0, bass: 0, grand: 0 };
  saveHighScores();
  updateHighScoresDisplay();
}

// Load settings from localStorage if available
function loadSettings() {
  const saved = localStorage.getItem('noteGameSettings');
  if (saved) {
    const savedSettings = JSON.parse(saved);
    gameSettings = { ...gameSettings, ...savedSettings };
    
    // Ensure pianoMode object has all required properties
    if (!gameSettings.pianoMode) {
      gameSettings.pianoMode = {
        enabled: false,
        active: false,
        strictMode: false,
        leftHand: 'none',
        rightHand: 'none'
      };
    } else {
      // Fill in any missing properties
      gameSettings.pianoMode = {
        enabled: false,
        active: false,
        strictMode: false,
        leftHand: 'none',
        rightHand: 'none',
        ...gameSettings.pianoMode
      };
    }
  } else {
    // If no saved settings, use default (start with easy)
    gameSettings.ledgerLines = 0;
  }
  updateSettingsDisplay();
}

// Save settings to localStorage
function saveSettings() {
  localStorage.setItem('noteGameSettings', JSON.stringify(gameSettings));
}

// Update the settings display in the options modal and main menu
function updateSettingsDisplay() {
  const musicToggle = document.getElementById('musicToggle');
  const soundEffectsToggle = document.getElementById('soundEffectsToggle');
  const hardModeToggle = document.getElementById('hardModeToggle');
  
  if (musicToggle) musicToggle.checked = gameSettings.music;
  if (soundEffectsToggle) soundEffectsToggle.checked = gameSettings.soundEffects;
  // Hard mode toggle removed from main menu
  if (hardModeToggle) {
    hardModeToggle.checked = gameSettings.ledgerLines;
  }
  
  // Update difficulty dropdown
  updateDifficultyDisplay();
  
  // Update clef buttons
  updateClefButtons();
  
  // Update Piano Mode UI
  updatePianoModeUI();
}

// Update difficulty display for dropdown
function updateDifficultyDisplay() {
  const ledgerLineSelect = document.getElementById('ledgerLineSelect');
  if (ledgerLineSelect) {
    ledgerLineSelect.value = gameSettings.ledgerLines.toString();
  }
}

// Modal handling
function showModal(modalId) {
  document.getElementById(modalId).style.display = 'block';
  
  // Update Piano Mode status when showing pre-game modal
  if (modalId === 'preGameModal') {
    updatePianoModeStatus();
  }
}

function hideModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// Update Piano Mode status in pre-game modal
function updatePianoModeStatus() {
  const pianoModeStatus = document.getElementById('pianoModeStatus');
  if (pianoModeStatus) {
    // Check if MIDI integration is available and has connected devices
    let hasMidiDevice = false;
    
    if (typeof window.getMenuMidiStatus === 'function') {
      const midiStatus = window.getMenuMidiStatus();
      hasMidiDevice = midiStatus.connectedDevices && midiStatus.connectedDevices.length > 0;
    }
    
    pianoModeStatus.style.display = hasMidiDevice ? 'block' : 'none';
  }
}

// Check if only filtered MIDI devices (like through ports) are available
function hasOnlyFilteredMidiDevices() {
  if (typeof window.getMenuMidiStatus !== 'function') {
    return false;
  }
  
  const midiStatus = window.getMenuMidiStatus();
  if (!midiStatus.connectedDevices || midiStatus.connectedDevices.length === 0) {
    return false;
  }
  
  // Check if all connected devices appear to be filtered devices
  // Enhanced filtering to specifically exclude "MIDI Through port-0" (Chromebook bug)
  const filteredPatterns = [
    'through port-0',    // Specific Chromebook MIDI through port
    'midi through port-0', // Alternative naming
    'through port',      // General through ports
    'midi through', 
    'through',
    'loopback',
    'virtual'
  ];
  
  return midiStatus.connectedDevices.every(device => {
    const name = (device.name || '').toLowerCase();
    const manufacturer = (device.manufacturer || '').toLowerCase();
    
    return filteredPatterns.some(pattern => 
      name.includes(pattern) || manufacturer.includes(pattern)
    );
  });
}

// Track if user has manually opened piano mode options
window.pianoModeOptionsManuallyOpened = false;

// Check if running on mobile device
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Update Piano Mode UI based on MIDI device availability
function updatePianoModeUI() {
  const pianoModeBtn = document.getElementById('pianoModeBtn');
  const pianoModeStatus = document.getElementById('pianoModeStatus');
  const pianoModeOptions = document.getElementById('pianoModeOptions');
  
  if (!pianoModeBtn) return;
  
  // Check if running on mobile device - completely hide piano mode on mobile
  if (isMobileDevice()) {
    // Completely hide the entire piano mode control on mobile
    const pianoModeControl = pianoModeBtn.closest('.piano-mode-control');
    if (pianoModeControl) {
      pianoModeControl.style.display = 'none';
    }
    gameSettings.pianoMode.enabled = false;
    gameSettings.pianoMode.active = false;
    updateClefButtonsForPianoMode(false);
    return;
  } else {
    // Ensure piano mode control is visible on non-mobile devices
    const pianoModeControl = pianoModeBtn.closest('.piano-mode-control');
    if (pianoModeControl) {
      pianoModeControl.style.display = '';
    }
  }
  
  // Check if MIDI integration is available and has connected devices
  let hasMidiDevice = false;
  let hasOnlyFilteredDevices = false;
  
  if (typeof window.getMenuMidiStatus === 'function') {
    const midiStatus = window.getMenuMidiStatus();
    hasMidiDevice = midiStatus.connectedDevices && midiStatus.connectedDevices.length > 0;
    hasOnlyFilteredDevices = hasOnlyFilteredMidiDevices();
  }
  
  // Update button state - keep button clickable but show appropriate status
  // We no longer disable the button completely to allow access to settings
  
  if (!hasMidiDevice) {
    pianoModeStatus.textContent = 'MIDI Required';
    pianoModeBtn.classList.remove('active');
    pianoModeBtn.classList.add('midi-unavailable'); // New class for styling
    // Only auto-close if not manually opened by user
    if (!window.pianoModeOptionsManuallyOpened) {
      pianoModeOptions.style.display = 'none';
    }
    gameSettings.pianoMode.enabled = false;
    gameSettings.pianoMode.active = false;
    updateClefButtonsForPianoMode(false);
  } else if (hasOnlyFilteredDevices) {
    pianoModeStatus.textContent = 'Real MIDI Device Required';
    pianoModeBtn.classList.remove('active');
    pianoModeBtn.classList.add('midi-unavailable'); // New class for styling
    // Only auto-close if not manually opened by user
    if (!window.pianoModeOptionsManuallyOpened) {
      pianoModeOptions.style.display = 'none';
    }
    gameSettings.pianoMode.enabled = false;
    gameSettings.pianoMode.active = false;
    updateClefButtonsForPianoMode(false);
  } else {
    pianoModeStatus.textContent = 'Available';
    pianoModeBtn.classList.remove('disabled', 'midi-unavailable');
    
    if (gameSettings.pianoMode.active) {
      pianoModeBtn.classList.add('active');
      pianoModeStatus.textContent = 'Active';
      pianoModeOptions.style.display = 'block';
      
      // Set enabled based on active status
      gameSettings.pianoMode.enabled = true;
      
      // Force Grand Staff when Piano Mode is active
      if (gameSettings.clef !== 'grand') {
        gameSettings.clef = 'grand';
        updateClefButtons();
        saveSettings();
      }
      
      // Disable other clef options
      updateClefButtonsForPianoMode(true);
    } else {
      pianoModeBtn.classList.remove('active');
      // Only auto-close if not manually opened by user
      if (!window.pianoModeOptionsManuallyOpened) {
        pianoModeOptions.style.display = 'none';
      }
      gameSettings.pianoMode.enabled = false;
      updateClefButtonsForPianoMode(false);
    }
  }
  
  updatePianoModeControls();
}

// Update individual Piano Mode controls
function updatePianoModeControls() {
  const pianoModeActiveToggle = document.getElementById('pianoModeActiveToggle');
  const strictModeToggle = document.getElementById('strictModeToggle');
  const leftHandSelect = document.getElementById('leftHandSelect');
  const rightHandSelect = document.getElementById('rightHandSelect');
  
  // Check if MIDI device is available
  let hasMidiDevice = false;
  if (typeof window.getMenuMidiStatus === 'function') {
    const midiStatus = window.getMenuMidiStatus();
    hasMidiDevice = midiStatus.connectedDevices && midiStatus.connectedDevices.length > 0;
  }
  
  // Disable all controls on mobile devices
  if (isMobileDevice()) {
    if (pianoModeActiveToggle) pianoModeActiveToggle.disabled = true;
    if (strictModeToggle) strictModeToggle.disabled = true;
    if (leftHandSelect) leftHandSelect.disabled = true;
    if (rightHandSelect) rightHandSelect.disabled = true;
    return;
  }
  
  if (pianoModeActiveToggle) {
    pianoModeActiveToggle.checked = gameSettings.pianoMode.active;
    // Fix: Enable checkbox when MIDI device is available, not when Piano Mode is already enabled
    pianoModeActiveToggle.disabled = !hasMidiDevice;
  }
  
  if (strictModeToggle) {
    strictModeToggle.checked = gameSettings.pianoMode.strictMode;
    strictModeToggle.disabled = !gameSettings.pianoMode.active;
  }
  
  if (leftHandSelect) {
    leftHandSelect.value = gameSettings.pianoMode.leftHand;
    leftHandSelect.disabled = !gameSettings.pianoMode.active;
    updateDropdownLabelColor(leftHandSelect);
  }
  
  if (rightHandSelect) {
    rightHandSelect.value = gameSettings.pianoMode.rightHand;
    rightHandSelect.disabled = !gameSettings.pianoMode.active;
    updateDropdownLabelColor(rightHandSelect);
  }
}

// Update dropdown label color based on selection
function updateDropdownLabelColor(selectElement) {
  const label = selectElement.parentElement.querySelector('.option-label');
  if (label) {
    if (selectElement.value !== 'none') {
      label.style.color = '#28a745'; // Green when selected
    } else {
      label.style.color = '#333'; // Black when not selected
    }
  }
}

// Update clef buttons for Piano Mode (disable/enable other clefs)
function updateClefButtonsForPianoMode(pianoModeActive) {
  const clefButtons = document.querySelectorAll('.clef-btn');
  
  clefButtons.forEach(btn => {
    if (pianoModeActive) {
      if (btn.dataset.clef !== 'grand') {
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
        btn.disabled = true;
      } else {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
        btn.disabled = false;
      }
    } else {
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
      btn.disabled = false;
    }
  });
}

// Update clef button display
function updateClefButtons() {
  document.querySelectorAll('.clef-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.clef === gameSettings.clef) {
      btn.classList.add('active');
    }
  });
}

// Initialize menu functionality
document.addEventListener('DOMContentLoaded', function() {
  loadSettings();
  loadHighScores(); // Load high scores
  
  // Hide MIDI-related elements on mobile devices
  if (isMobileDevice()) {
    const midiDeviceOptionGroup = document.getElementById('midiDeviceOptionGroup');
    if (midiDeviceOptionGroup) {
      midiDeviceOptionGroup.style.display = 'none';
    }
  }
  
  // Initialize Piano Mode UI
  updatePianoModeUI();
  
  // Clef selection buttons
  document.querySelectorAll('.clef-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      // Don't allow clef changes if Piano Mode is active (except grand staff)
      if (gameSettings.pianoMode.enabled && this.dataset.clef !== 'grand') {
        return;
      }
      
      gameSettings.clef = this.dataset.clef;
      updateClefButtons();
      saveSettings(); // Auto-save clef selection
    });
  });
  
  // Piano Mode button - now only opens options (doesn't toggle)
  document.getElementById('pianoModeBtn').addEventListener('click', function() {
    const pianoModeOptions = document.getElementById('pianoModeOptions');
    // Only open if not already open
    if (pianoModeOptions.style.display !== 'block') {
      pianoModeOptions.style.display = 'block';
      window.pianoModeOptionsManuallyOpened = true;
    }
  });
  
  // Piano Mode close button
  document.getElementById('pianoModeCloseBtn').addEventListener('click', function() {
    const pianoModeOptions = document.getElementById('pianoModeOptions');
    pianoModeOptions.style.display = 'none';
    window.pianoModeOptionsManuallyOpened = false;
  });
  
  // Piano Mode activation toggle
  document.getElementById('pianoModeActiveToggle').addEventListener('change', function() {
    gameSettings.pianoMode.active = this.checked;
    
    updatePianoModeUI();
    saveSettings();
  });
  
  // Piano Mode option handlers
  document.getElementById('strictModeToggle').addEventListener('change', function() {
    gameSettings.pianoMode.strictMode = this.checked;
    saveSettings();
    // Notify the game if it's running
    if (typeof window.updateGamePianoModeSettings === 'function') {
      window.updateGamePianoModeSettings(gameSettings.pianoMode);
    }
  });
  

  
  document.getElementById('leftHandSelect').addEventListener('change', function() {
    gameSettings.pianoMode.leftHand = this.value;
    updateDropdownLabelColor(this);
    saveSettings();
    // Notify the game if it's running
    if (typeof window.updateGamePianoModeSettings === 'function') {
      window.updateGamePianoModeSettings(gameSettings.pianoMode);
    }
  });
  
  document.getElementById('rightHandSelect').addEventListener('change', function() {
    gameSettings.pianoMode.rightHand = this.value;
    updateDropdownLabelColor(this);
    saveSettings();
    // Notify the game if it's running
    if (typeof window.updateGamePianoModeSettings === 'function') {
      window.updateGamePianoModeSettings(gameSettings.pianoMode);
    }
  });
  
  // Ledger line dropdown handler (replaces button)
  document.getElementById('ledgerLineSelect').addEventListener('change', function() {
    gameSettings.ledgerLines = parseInt(this.value);
    saveSettings(); // Auto-save difficulty selection
  });
  
  // Hard mode toggle - removed, so remove this event listener
  // document.getElementById('hardModeToggle')?.addEventListener('change', function() {
  //   gameSettings.ledgerLines = this.checked;
  //   saveSettings(); // Auto-save hard mode selection
  // });
  
  // Tutorial button
  document.getElementById('tutorialBtn').addEventListener('click', function() {
    showModal('tutorialModal');
  });
  
  // Options button - removed from menu
  // document.getElementById('optionsBtn')?.addEventListener('click', function() {
  //   showModal('optionsModal');
  // });
  
  // High Scores button removed - scores are always visible now
  
  // Start game button
  document.getElementById('startGameBtn').addEventListener('click', function() {
    // Save current settings and show pre-game modal
    saveSettings();
    showModal('preGameModal');
  });
  
  // Pre-game modal buttons
  document.getElementById('returnToMenuBtn').addEventListener('click', function() {
    hideModal('preGameModal');
  });
  
  document.getElementById('showNoteHelperBtn').addEventListener('click', function() {
    showModal('noteHelperModal');
  });
  
  document.getElementById('actualStartGameBtn').addEventListener('click', function() {
    // Actually start the game
    window.location.href = 'game.html';
  });
  
  // Save options button
  document.getElementById('saveOptionsBtn').addEventListener('click', function() {
    // Update settings from form
    gameSettings.music = document.getElementById('musicToggle').checked;
    gameSettings.soundEffects = document.getElementById('soundEffectsToggle').checked;
    if (document.getElementById('ledgerLinesToggle')) {
      gameSettings.ledgerLines = document.getElementById('ledgerLinesToggle').checked;
    }
    // Clef is now handled by main menu buttons
    
    saveSettings();
    
    // Save MIDI settings if available
    if (window.saveMidiSettings) {
      window.saveMidiSettings();
    }
    
    hideModal('optionsModal');
    
    // Show confirmation
    const btn = document.getElementById('saveOptionsBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Settings Saved!';
    btn.style.background = '#28a745';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
    }, 1500);
  });
  
  // Reset high scores button
  document.getElementById('resetHighScoresBtn').addEventListener('click', function() {
    if (confirm('Are you sure you want to reset all high scores? This cannot be undone.')) {
      resetHighScores();
      
      // Show confirmation
      const btn = this;
      const originalText = btn.textContent;
      btn.textContent = 'High Scores Reset!';
      btn.style.background = '#28a745';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 1500);
    }
  });
  
  // Close modal handlers
  document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', function() {
      const modal = this.closest('.modal');
      modal.style.display = 'none';
    });
  });
  
  // Close modal when clicking outside
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        this.style.display = 'none';
      }
    });
  });
  
  // Keyboard navigation
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
      });
    }
  });
  
  // Set up a periodic check for MIDI device changes
  setInterval(updatePianoModeUI, 2000); // Check every 2 seconds
});

// Expose function for external MIDI integration to call
window.refreshPianoModeUI = function() {
  updatePianoModeUI();
};