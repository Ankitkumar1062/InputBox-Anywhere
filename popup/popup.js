/**
 * Popup script for Custom Input Box Everywhere
 * Last updated: 2025-06-18 12:54:03
 * Author: Ankitkumar1062
 */

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  mode: 'habit',
  position: 'top',
  grokApiKey: '',
  opacity: 0.9,
  fontSize: 16,
  width: '80%',
  theme: 'light',
  alwaysShowToolbar: true,
  lastPosition: { top: '100px', left: '100px' },
  lastDimensions: { width: '600px', height: '300px' }
};

// DOM elements
const enabledToggle = document.getElementById('enabled-toggle');
const modeRadios = document.querySelectorAll('input[name="mode"]');
const positionRadios = document.querySelectorAll('input[name="position"]');
const grokApiKeyInput = document.getElementById('grok-api-key');
const testApiButton = document.getElementById('test-api');
const apiStatus = document.getElementById('api-status');
const opacityInput = document.getElementById('opacity');
const opacityValue = document.getElementById('opacity-value');
const fontSizeInput = document.getElementById('font-size');
const fontSizeValue = document.getElementById('font-size-value');
const widthSelect = document.getElementById('width');
const themeSelect = document.getElementById('theme');
const saveButton = document.getElementById('save-button');
const resetButton = document.getElementById('reset-button');
const alwaysShowToolbarCheckbox = document.getElementById('always-show-toolbar');

// Load settings when popup opens
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup opened, loading settings...');
  
  // Update the version and user info
  const versionElement = document.querySelector('.version');
  if (versionElement) {
    versionElement.textContent = 'v1.0';
  }
  
  const lastUpdatedElement = document.querySelector('.last-updated');
  if (lastUpdatedElement) {
    lastUpdatedElement.textContent = 'Last Updated: 2025-06-18 12:54:03';
  }
  
  // Add user info
  const footerElement = document.querySelector('.footer');
  if (footerElement) {
    const existingUserInfo = footerElement.querySelector('.user-info');
    if (existingUserInfo) {
      existingUserInfo.remove();
    }
    
    const userElement = document.createElement('span');
    userElement.className = 'user-info';
    userElement.textContent = 'User: Ankitkumar1062';
    footerElement.appendChild(userElement);
  }
  
  // Load current settings from storage
  browser.storage.local.get('settings')
    .then(result => {
      const settings = result.settings || DEFAULT_SETTINGS;
      console.log('Loaded settings:', settings);
      
      // Apply settings to UI
      enabledToggle.checked = settings.enabled;
      
      // Set mode radio buttons
      for (const radio of modeRadios) {
        radio.checked = radio.value === settings.mode;
      }
      
      // Set position radio buttons
      for (const radio of positionRadios) {
        radio.checked = radio.value === settings.position;
      }
      
      // Set Groq API key
      grokApiKeyInput.value = settings.grokApiKey || '';
      
      // Set appearance settings
      opacityInput.value = settings.opacity;
      opacityValue.textContent = settings.opacity;
      
      fontSizeInput.value = settings.fontSize;
      fontSizeValue.textContent = `${settings.fontSize}px`;
      
      widthSelect.value = settings.width;
      themeSelect.value = settings.theme;
      
      // Set always show toolbar checkbox
      if (alwaysShowToolbarCheckbox) {
        alwaysShowToolbarCheckbox.checked = settings.alwaysShowToolbar;
      }
      
      // Toggle advanced settings visibility based on mode
      toggleAdvancedSettings(settings.mode === 'advanced');
    })
    .catch(error => {
      console.error('Error loading settings:', error);
      showStatusNotification('Error loading settings', 'error');
    });
    
  // Expand keyboard shortcuts section
  const shortcutsList = document.querySelector('.shortcut-list');
  if (shortcutsList) {
    // Add additional keyboard shortcuts if they don't exist
    if (shortcutsList.children.length <= 6) {
      const newShortcuts = [
        { keys: 'Alt+Arrow Keys', desc: 'Resize box (float mode)' },
        { keys: 'Ctrl+Shift+Arrow Keys', desc: 'Move box (float mode)' },
        { keys: 'Alt+Shift+Arrow Keys', desc: 'Resize by larger steps' },
        { keys: 'Ctrl+Shift+Q', desc: 'Close input box' },
        { keys: 'Ctrl+Shift+R', desc: 'Reset position (float mode)' },
        { keys: 'Ctrl+Shift+T', desc: 'Toggle formatting toolbar' }
      ];
      
      newShortcuts.forEach(shortcut => {
        const shortcutItem = document.createElement('div');
        shortcutItem.className = 'shortcut-item';
        
        const keysSpan = document.createElement('span');
        keysSpan.className = 'shortcut-keys';
        keysSpan.textContent = shortcut.keys;
        
        const descSpan = document.createElement('span');
        descSpan.className = 'shortcut-desc';
        descSpan.textContent = shortcut.desc;
        
        shortcutItem.appendChild(keysSpan);
        shortcutItem.appendChild(descSpan);
        shortcutsList.appendChild(shortcutItem);
      });
    }
  }
  
  // Initialize collapsible sections
  initializeCollapsibles();
});

// Add immediate toggle functionality to the enable/disable switch
enabledToggle.addEventListener('change', () => {
  console.log(`Toggle changed to: ${enabledToggle.checked}`);
  
  // Immediately send the updated setting to storage
  browser.storage.local.get('settings')
    .then(result => {
      const settings = result.settings || DEFAULT_SETTINGS;
      settings.enabled = enabledToggle.checked;
      
      return browser.storage.local.set({ settings });
    })
    .then(() => {
      // Try to notify background about the change
      try {
        browser.runtime.sendMessage({
          type: 'TOGGLE_EXTENSION',
          enabled: enabledToggle.checked
        });
      } catch (error) {
        console.warn('Could not notify background script, but setting was saved:', error);
      }
      
      // Show visual confirmation
      const statusMsg = enabledToggle.checked ? 'Extension enabled' : 'Extension disabled';
      showStatusNotification(statusMsg, enabledToggle.checked ? 'success' : 'info');
    })
    .catch(error => {
      console.error('Error toggling extension:', error);
      showStatusNotification('Error toggling extension', 'error');
    });
});

// Save settings
saveButton.addEventListener('click', () => {
  console.log('Saving settings...');
  
  // Show saving indicator
  saveButton.textContent = 'Saving...';
  saveButton.disabled = true;
  
  // Collect settings from UI
  browser.storage.local.get('settings')
    .then(result => {
      const currentSettings = result.settings || DEFAULT_SETTINGS;
      
      const newSettings = {
        enabled: enabledToggle.checked,
        mode: getSelectedRadioValue(modeRadios),
        position: getSelectedRadioValue(positionRadios),
        grokApiKey: grokApiKeyInput.value.trim(),
        opacity: parseFloat(opacityInput.value),
        fontSize: parseInt(fontSizeInput.value),
        width: widthSelect.value,
        theme: themeSelect.value,
        alwaysShowToolbar: alwaysShowToolbarCheckbox ? alwaysShowToolbarCheckbox.checked : true,
        lastPosition: currentSettings.lastPosition || { top: '100px', left: '100px' },
        lastDimensions: currentSettings.lastDimensions || { width: '600px', height: '300px' }
      };
      
      // Save to storage
      return browser.storage.local.set({ settings: newSettings })
        .then(() => newSettings);
    })
    .then(newSettings => {
      // Try to notify background script about the settings change
      try {
        browser.runtime.sendMessage({
          type: 'UPDATE_SETTINGS',
          settings: newSettings
        });
      } catch (error) {
        console.warn('Could not notify background script, but settings were saved:', error);
      }
      
      // Reset button text and show success notification
      saveButton.textContent = 'Save Settings';
      saveButton.disabled = false;
      showStatusNotification('Settings saved successfully', 'success');
    })
    .catch(error => {
      console.error('Error saving settings:', error);
      saveButton.textContent = 'Save Settings';
      saveButton.disabled = false;
      showStatusNotification('Error saving settings', 'error');
    });
});

// Reset settings to defaults
resetButton.addEventListener('click', () => {
  if (confirm('Reset all settings to defaults? This cannot be undone.')) {
    resetButton.textContent = 'Resetting...';
    resetButton.disabled = true;
    
    browser.storage.local.set({ settings: DEFAULT_SETTINGS })
      .then(() => {
        // Try to notify background about the reset
        try {
          browser.runtime.sendMessage({
            type: 'UPDATE_SETTINGS',
            settings: DEFAULT_SETTINGS
          });
        } catch (error) {
          console.warn('Could not notify background script, but settings were reset:', error);
        }
        
        // Reload the popup to show default settings
        showStatusNotification('Settings reset to defaults', 'info');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      })
      .catch(error => {
        console.error('Error resetting settings:', error);
        resetButton.textContent = 'Reset to Defaults';
        resetButton.disabled = false;
        showStatusNotification('Error resetting settings', 'error');
      });
  }
});

// Test Groq API connection with simplified approach
testApiButton.addEventListener('click', () => {
  const apiKey = grokApiKeyInput.value.trim();
  
  if (!apiKey) {
    showApiStatus('Please enter an API key', false);
    return;
  }
  
  // Clear any previous status
  apiStatus.textContent = '';
  apiStatus.className = '';
  apiStatus.style.display = 'none';
  
  // Update button state
  testApiButton.textContent = 'Testing...';
  testApiButton.disabled = true;
  
  // Show testing message
  showStatusNotification('Testing API connection...', 'info');
  
  // Simple approach - just try to send the message and handle errors
  browser.runtime.sendMessage({
    type: 'DIRECT_GROQ_TEST',
    apiKey: apiKey
  })
    .then(response => {
      console.log('API test response:', response);
      
      if (response && response.success) {
        showApiStatus('Connection successful!', true);
        showStatusNotification('API connection successful', 'success');
        
        // Save the successful API key
        browser.storage.local.get('settings')
          .then(result => {
            const settings = result.settings || DEFAULT_SETTINGS;
            settings.grokApiKey = apiKey;
            return browser.storage.local.set({ settings });
          })
          .catch(error => {
            console.warn('Could not save API key to settings:', error);
          });
      } else {
        const errorMsg = response?.error || 'Unknown error';
        showApiStatus(`Connection failed: ${errorMsg}`, false);
        showStatusNotification('API connection failed', 'error');
      }
    })
    .catch(error => {
      console.error('API test error:', error);
      
      // Special handling for the "receiving end does not exist" error
      if (error.message && error.message.includes("Receiving end does not exist")) {
        showApiStatus("Background script connection error. Please reload the extension from about:debugging page.", false);
      } else {
        showApiStatus(`Error: ${error.message}`, false);
      }
      
      showStatusNotification('API connection error', 'error');
    })
    .finally(() => {
      // Reset button
      testApiButton.textContent = 'Test Connection';
      testApiButton.disabled = false;
    });
});

// Toggle advanced settings visibility when mode changes
for (const radio of modeRadios) {
  radio.addEventListener('change', (e) => {
    toggleAdvancedSettings(e.target.value === 'advanced');
  });
}

// Update opacity value display
opacityInput.addEventListener('input', () => {
  opacityValue.textContent = opacityInput.value;
});

// Update font size value display
fontSizeInput.addEventListener('input', () => {
  fontSizeValue.textContent = `${fontSizeInput.value}px`;
});

// Initialize collapsible sections
function initializeCollapsibles() {
  const collapsibles = document.querySelectorAll('.collapsible');
  
  collapsibles.forEach(collapsible => {
    const content = collapsible.nextElementSibling;
    
    // If has 'expanded' class, expand it
    if (content.classList.contains('expanded')) {
      content.style.maxHeight = content.scrollHeight + 'px';
    }
    
    collapsible.addEventListener('click', () => {
      collapsible.classList.toggle('collapsed');
      content.classList.toggle('expanded');
      
      if (content.classList.contains('expanded')) {
        content.style.maxHeight = content.scrollHeight + 'px';
      } else {
        content.style.maxHeight = '0';
      }
    });
  });
}

// Helper function to get selected radio button value
function getSelectedRadioValue(radioButtons) {
  for (const radio of radioButtons) {
    if (radio.checked) {
      return radio.value;
    }
  }
  return null;
}

// Helper function to show API connection status
function showApiStatus(message, isSuccess) {
  apiStatus.textContent = message;
  apiStatus.className = isSuccess ? 'success' : 'error';
  apiStatus.style.display = 'block';
  
  // Hide after 5 seconds
  setTimeout(() => {
    apiStatus.style.display = 'none';
  }, 5000);
}

// Helper function to show general status notification
function showStatusNotification(message, type) {
  // Create notification if it doesn't exist
  let notification = document.querySelector('.status-notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.className = 'status-notification';
    document.querySelector('.container').appendChild(notification);
  }
  
  // Update notification
  notification.textContent = message;
  notification.className = `status-notification ${type}`;
  notification.style.display = 'block';
  
  // Hide after 3 seconds
  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

// Helper function to toggle advanced settings visibility
function toggleAdvancedSettings(show) {
  const advancedSection = document.querySelector('.advanced-settings');
  if (advancedSection) {
    advancedSection.style.display = show ? 'block' : 'none';
  }
}