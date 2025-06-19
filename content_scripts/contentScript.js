/**
 * Main content script for Custom Input Box Everywhere
 * Last updated: 2025-06-18 12:47:57
 * Author: Ankitkumar1062
 */

// Global state
const state = {
  enabled: true,
  mode: 'habit',
  position: 'top',
  grokApiKey: '',
  inputBox: null,
  activeElement: null,
  isVisible: false,
  isSyncing: false,
  lastPosition: { top: '100px', left: '100px' },
  lastDimensions: { width: '600px', height: '300px' }
};

// Initialize the extension
function initializeExtension() {
  console.log('Initializing Custom Input Box Everywhere...');
  
  // Load settings from storage
  browser.storage.local.get('settings')
    .then(result => {
      const settings = result.settings;
      
      if (settings) {
        state.enabled = settings.enabled;
        state.mode = settings.mode;
        state.position = settings.position;
        state.grokApiKey = settings.grokApiKey || '';
        state.lastPosition = settings.lastPosition;
        state.lastDimensions = settings.lastDimensions;
      }
      
      console.log(`Extension initialized. Mode: ${state.mode}, Position: ${state.position}, Enabled: ${state.enabled}`);
      
      // Set up event listeners
      setupEventListeners();
    })
    .catch(error => {
      console.error('Error loading settings:', error);
    });
}

// Set up event listeners
function setupEventListeners() {
  // Listen for focus events on input elements
  document.addEventListener('focusin', handleFocusIn);
  document.addEventListener('focusout', handleFocusOut);
  
  // Listen for keyboard shortcuts
  document.addEventListener('keydown', handleKeyDown);
  
  // Listen for messages from the background script or popup
  browser.runtime.onMessage.addListener(handleMessage);
}

// Handle focus events on input elements
function handleFocusIn(event) {
  if (!state.enabled) return;
  
  const target = event.target;
  
  // Check if the target is an input element
  if (
    (target.tagName === 'INPUT' && ['text', 'email', 'password', 'search', 'tel', 'url'].includes(target.type)) ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  ) {
    console.log('Input element focused:', target);
    
    state.activeElement = target;
    
    // Show the input box
    if (state.mode === 'habit') {
      showHabitModeInput(target);
    } else if (state.mode === 'advanced') {
      showAdvancedModeInput(target);
    }
  }
}

// Handle focus out events
function handleFocusOut(event) {
  // Check if the focus is moving to our input box to avoid hiding it
  if (state.inputBox && event.relatedTarget && state.inputBox.contains(event.relatedTarget)) {
    return;
  }
  
  // Hide the input box after a short delay to allow for clicks on the input box
  setTimeout(() => {
    if (state.isVisible && !document.activeElement?.closest('.custom-input-box-container')) {
      hideInputBox();
    }
  }, 100);
}

// Handle keyboard shortcuts
function handleKeyDown(event) {
  if (!state.enabled) return;
  
  // Ctrl+Shift+I - Toggle extension
  if (event.ctrlKey && event.shiftKey && event.key === 'I') {
    state.enabled = !state.enabled;
    
    browser.storage.local.get('settings')
      .then(result => {
        const settings = result.settings || {};
        settings.enabled = state.enabled;
        return browser.storage.local.set({ settings });
      })
      .then(() => {
        createTooltip(`Extension ${state.enabled ? 'enabled' : 'disabled'}`, 'top');
        
        if (!state.enabled && state.isVisible) {
          hideInputBox();
        }
      })
      .catch(error => {
        console.error('Error toggling extension:', error);
      });
      
    event.preventDefault();
  }
  
  // Ctrl+Shift+M - Toggle mode
  if (event.ctrlKey && event.shiftKey && event.key === 'M') {
    state.mode = state.mode === 'habit' ? 'advanced' : 'habit';
    
    browser.storage.local.get('settings')
      .then(result => {
        const settings = result.settings || {};
        settings.mode = state.mode;
        return browser.storage.local.set({ settings });
      })
      .then(() => {
        createTooltip(`Mode switched to ${state.mode}`, 'top');
        
        if (state.isVisible) {
          hideInputBox();
          
          if (state.activeElement) {
            if (state.mode === 'habit') {
              showHabitModeInput(state.activeElement);
            } else {
              showAdvancedModeInput(state.activeElement);
            }
          }
        }
      })
      .catch(error => {
        console.error('Error toggling mode:', error);
      });
      
    event.preventDefault();
  }
  
  // Ctrl+Shift+Q - Close input box
  if (event.ctrlKey && event.shiftKey && event.key === 'Q') {
    if (state.isVisible) {
      hideInputBox();
      event.preventDefault();
    }
  }
  
  // Handle resize and move shortcuts when in float mode
  if (state.isVisible && state.position === 'float' && state.inputBox) {
    const movementStep = event.shiftKey ? 20 : 10;
    
    if (event.ctrlKey && event.shiftKey && event.key === 'ArrowUp') {
      // Move up
      moveInputBox(0, -movementStep);
      event.preventDefault();
    } else if (event.ctrlKey && event.shiftKey && event.key === 'ArrowDown') {
      // Move down
      moveInputBox(0, movementStep);
      event.preventDefault();
    } else if (event.ctrlKey && event.shiftKey && event.key === 'ArrowLeft') {
      // Move left
      moveInputBox(-movementStep, 0);
      event.preventDefault();
    } else if (event.ctrlKey && event.shiftKey && event.key === 'ArrowRight') {
      // Move right
      moveInputBox(movementStep, 0);
      event.preventDefault();
    } else if (event.altKey && event.key === 'ArrowUp') {
      // Resize height smaller
      resizeInputBox(0, -movementStep);
      event.preventDefault();
    } else if (event.altKey && event.key === 'ArrowDown') {
      // Resize height larger
      resizeInputBox(0, movementStep);
      event.preventDefault();
    } else if (event.altKey && event.key === 'ArrowLeft') {
      // Resize width smaller
      resizeInputBox(-movementStep, 0);
      event.preventDefault();
    } else if (event.altKey && event.key === 'ArrowRight') {
      // Resize width larger
      resizeInputBox(movementStep, 0);
      event.preventDefault();
    }
  }
  
  // Ctrl+Shift+R - Reset position for float mode
  if (event.ctrlKey && event.shiftKey && event.key === 'R') {
    if (state.isVisible && state.position === 'float') {
      state.inputBox.style.left = '100px';
      state.inputBox.style.top = '100px';
      state.inputBox.style.width = '600px';
      state.inputBox.style.height = '300px';
      
      // Save the position and dimensions
      savePosition();
      saveDimensions();
      
      event.preventDefault();
    }
  }
  
  // Ctrl+Shift+T - Toggle formatting toolbar
  if (event.ctrlKey && event.shiftKey && event.key === 'T') {
    if (state.isVisible && state.inputBox) {
      const toolbar = state.inputBox.querySelector('.formatting-toolbar');
      
      if (toolbar) {
        toolbar.style.display = toolbar.style.display === 'none' ? 'flex' : 'none';
        event.preventDefault();
      }
    }
  }
}

// Handle messages from the background script or popup
function handleMessage(message) {
  console.log('Content script received message:', message);
  
  if (message.type === 'TOGGLE_EXTENSION') {
    state.enabled = message.enabled;
    
    if (!state.enabled && state.isVisible) {
      hideInputBox();
    }
    
    createTooltip(`Extension ${state.enabled ? 'enabled' : 'disabled'}`, 'top');
  }
  
  if (message.type === 'TOGGLE_MODE') {
    state.mode = message.mode;
    
    if (state.isVisible) {
      hideInputBox();
      
      if (state.activeElement) {
        if (state.mode === 'habit') {
          showHabitModeInput(state.activeElement);
        } else {
          showAdvancedModeInput(state.activeElement);
        }
      }
    }
    
    createTooltip(`Mode switched to ${state.mode}`, 'top');
  }
  
  if (message.type === 'SETTINGS_UPDATED') {
    state.enabled = message.settings.enabled;
    state.mode = message.settings.mode;
    state.position = message.settings.position;
    state.grokApiKey = message.settings.grokApiKey || '';
    state.lastPosition = message.settings.lastPosition;
    state.lastDimensions = message.settings.lastDimensions;
    
    if (state.isVisible) {
      hideInputBox();
      
      if (state.activeElement) {
        if (state.mode === 'habit') {
          showHabitModeInput(state.activeElement);
        } else {
          showAdvancedModeInput(state.activeElement);
        }
      }
    }
    
    createTooltip('Settings updated', 'top');
  }
}

// Move the input box in float mode
function moveInputBox(deltaX, deltaY) {
  if (!state.inputBox || state.position !== 'float') return;
  
  const currentLeft = parseInt(state.inputBox.style.left) || 0;
  const currentTop = parseInt(state.inputBox.style.top) || 0;
  
  state.inputBox.style.left = `${currentLeft + deltaX}px`;
  state.inputBox.style.top = `${currentTop + deltaY}px`;
  
  // Save the position after a short delay to avoid too many storage operations
  if (state.savePositionTimeout) {
    clearTimeout(state.savePositionTimeout);
  }
  
  state.savePositionTimeout = setTimeout(savePosition, 500);
}

// Resize the input box in float mode
function resizeInputBox(deltaWidth, deltaHeight) {
  if (!state.inputBox || state.position !== 'float') return;
  
  const currentWidth = parseInt(state.inputBox.style.width) || 600;
  const currentHeight = parseInt(state.inputBox.style.height) || 300;
  
  const newWidth = Math.max(200, currentWidth + deltaWidth);
  const newHeight = Math.max(100, currentHeight + deltaHeight);
  
  state.inputBox.style.width = `${newWidth}px`;
  state.inputBox.style.height = `${newHeight}px`;
  
  // Save the dimensions after a short delay to avoid too many storage operations
  if (state.saveDimensionsTimeout) {
    clearTimeout(state.saveDimensionsTimeout);
  }
  
  state.saveDimensionsTimeout = setTimeout(saveDimensions, 500);
}

// Save the current position of the input box
function savePosition() {
  if (!state.inputBox) return;
  
  const position = {
    top: state.inputBox.style.top,
    left: state.inputBox.style.left
  };
  
  state.lastPosition = position;
  
  browser.runtime.sendMessage({
    type: 'SAVE_POSITION',
    position
  }).catch(error => {
    console.warn('Error saving position:', error);
  });
}

// Save the current dimensions of the input box
function saveDimensions() {
  if (!state.inputBox) return;
  
  const dimensions = {
    width: state.inputBox.style.width,
    height: state.inputBox.style.height
  };
  
  state.lastDimensions = dimensions;
  
  browser.runtime.sendMessage({
    type: 'SAVE_DIMENSIONS',
    dimensions
  }).catch(error => {
    console.warn('Error saving dimensions:', error);
  });
}

// Hide the input box
function hideInputBox() {
  if (!state.isVisible || !state.inputBox) return;
  
  state.inputBox.classList.add('cib-closing');
  
  setTimeout(() => {
    if (state.inputBox && state.inputBox.parentNode) {
      state.inputBox.parentNode.removeChild(state.inputBox);
    }
    
    state.inputBox = null;
    state.isVisible = false;
    state.isSyncing = false;
    
    // Return focus to the original input if it still exists in the DOM
    if (state.activeElement && document.contains(state.activeElement)) {
      state.activeElement.focus();
    }
  }, 300);
}

// Initialize the extension when the page is fully loaded
window.addEventListener('load', () => {
  initializeExtension();
});