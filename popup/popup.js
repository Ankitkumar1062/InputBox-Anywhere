// Popup script to handle user interactions
const CURRENT_DATE_TIME = "2025-06-21 06:49:44";
const CURRENT_USERNAME = "Ankitkumar1062";

// ===== Module: StateManager =====
const StateManager = (() => {
  async function getState() {
    const response = await browser.runtime.sendMessage({ action: 'getState' });
    return response.state || {};
  }

  async function updateState(newState) {
    await browser.runtime.sendMessage({ action: 'setState', state: newState });
  }

  return { getState, updateState };
})();

// ===== Module: FormListRenderer =====
const FormListRenderer = (() => {
  const container = document.getElementById('form-list');

  function clear() {
    container.innerHTML = '';
  }

  function render(forms) {
    clear();
    if (!forms || forms.length === 0) {
      container.textContent = 'No forms detected on this page.';
      return;
    }
    const ul = document.createElement('ul');
    forms.forEach(({ id, label }) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', () => toggleForm(id));
      li.appendChild(btn);
      ul.appendChild(li);
    });
    container.appendChild(ul);
  }

  async function toggleForm(formId) {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    await browser.tabs.sendMessage(tab.id, { action: 'toggleForm', formId });
  }

  return { render };
})();

document.addEventListener('DOMContentLoaded', async () => {
  const enableToggle = document.getElementById('enable-toggle');
  const habitModeRadio = document.getElementById('habit-mode');
  const advancedModeRadio = document.getElementById('advanced-mode');
  const positionTopRadio = document.getElementById('position-top');
  const positionCenterRadio = document.getElementById('position-center');
  const checkServerButton = document.getElementById('check-server');
  const openOptionsLink = document.getElementById('open-options');
  const advancedTools = document.getElementById('advanced-tools');
  const formListContainer = document.getElementById('form-list');
  
  // Advanced tool buttons
  const summarizeBtn = document.getElementById('summarize-btn');
  const applyCssBtn = document.getElementById('apply-css-btn');
  const editCssBtn = document.getElementById('edit-css-btn');
  const applyThemeBtn = document.getElementById('apply-theme-btn');
  const resetThemeBtn = document.getElementById('reset-theme-btn');
  const floatingBoxToggle = document.getElementById('floating-box-toggle');
  
  // Initialize accordions
  const accordions = document.querySelectorAll('.accordion-header');
  accordions.forEach(header => {
    header.addEventListener('click', () => {
      const accordion = header.parentElement;
      accordion.classList.toggle('active');
    });
  });

  
  
  // Initialize range inputs
  const rangeInputs = document.querySelectorAll('input[type="range"]');
  rangeInputs.forEach(input => {
    const valueDisplay = input.nextElementSibling;
    if (valueDisplay && valueDisplay.classList.contains('range-value')) {
      // Set initial value
      valueDisplay.textContent = `${input.value}${getUnitForInput(input.id)}`;
      
      // Update value on change
      input.addEventListener('input', () => {
        valueDisplay.textContent = `${input.value}${getUnitForInput(input.id)}`;
      });
    }
  });

  
  // Get current state from background script
  const state = await StateManager.getState();
  
  // Update UI based on current state
  enableToggle.checked = state.enabled;
  floatingBoxToggle.checked = state.isFloating || false;
  
  if (state.mode === 'habit') {
    habitModeRadio.checked = true;
    advancedTools.style.display = 'none';
  } else {
    advancedModeRadio.checked = true;
    advancedTools.style.display = 'block';
  }
  
  if (state.position === 'top') {
    positionTopRadio.checked = true;
  } else {
    positionCenterRadio.checked = true;
  }
  
  // Load custom theme settings if available
  if (state.customTheme) {
    loadThemeSettings(state.customTheme);
  }
  
  // Update server status indicator
  updateServerStatus(state.server.connected);
  
  // Add event listeners for mode switches
  enableToggle.addEventListener('change', () => {
    StateManager.updateState({ enabled: enableToggle.checked });
  });
  
  habitModeRadio.addEventListener('change', () => {
    if (habitModeRadio.checked) {
      StateManager.updateState({ mode: 'habit' });
      advancedTools.style.display = 'none';
    }
  });
  
  advancedModeRadio.addEventListener('change', async () => {
    if (advancedModeRadio.checked) {
      await StateManager.updateState({ mode: 'advanced' });
      advancedTools.style.display = 'block';
      await listAndRenderForms();
    }
  });
  
  positionTopRadio.addEventListener('change', () => {
    if (positionTopRadio.checked) {
      StateManager.updateState({ position: 'top' });
    }
  });
  
  positionCenterRadio.addEventListener('change', () => {
    if (positionCenterRadio.checked) {
      StateManager.updateState({ position: 'center' });
    }
  });
  
  checkServerButton.addEventListener('click', checkServerConnection);
  
  openOptionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    browser.runtime.openOptionsPage();
  });
  
  floatingBoxToggle.addEventListener('change', () => {
    StateManager.updateState({ isFloating: floatingBoxToggle.checked });
  });
  
  // Advanced tools handlers
  if (summarizeBtn) {
    summarizeBtn.addEventListener('click', async () => {
      console.log("Summarize button clicked");
      const summaryType = document.getElementById('summary-type').value;
      
      try {
        // Get the active tab
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) {
          console.error("No active tab found");
          return;
        }
        
        const activeTab = tabs[0];
        console.log("Sending summarize message to tab:", activeTab.id);
        
        // Send message to content script to perform summarization
        await browser.tabs.sendMessage(activeTab.id, { 
          action: 'summarize', 
          summaryType: summaryType 
        });
        
        console.log("Message sent successfully");
        // Close popup
        window.close();
      } catch (error) {
        console.error("Error sending message:", error);
        alert("Error: Could not communicate with the page. Please refresh the page and try again.");
      }
    });
  } else {
    console.error("Summarize button not found in the DOM");
  }
  
  if (applyCssBtn) {
    applyCssBtn.addEventListener('click', async () => {
      console.log("Apply CSS button clicked");
      const cssPreset = document.getElementById('css-preset').value;
      
      try {
        // Get the active tab
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) {
          console.error("No active tab found");
          return;
        }
        
        const activeTab = tabs[0];
        console.log("Sending applyCSS message to tab:", activeTab.id);
        
        // Send message to content script to apply CSS
        await browser.tabs.sendMessage(activeTab.id, { 
          action: 'applyCSS', 
          cssPreset: cssPreset 
        });
        
        console.log("CSS message sent successfully");
        // Close popup
        window.close();
      } catch (error) {
        console.error("Error sending CSS message:", error);
        alert("Error: Could not communicate with the page. Please refresh the page and try again.");
      }
    });
  } else {
    console.error("Apply CSS button not found in the DOM");
  }
  
  if (editCssBtn) {
    editCssBtn.addEventListener('click', async () => {
      console.log("Edit CSS button clicked");
      
      try {
        // Get the active tab
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) {
          console.error("No active tab found");
          return;
        }
        
        const activeTab = tabs[0];
        console.log("Sending openCSSEditor message to tab:", activeTab.id);
        
        // Send message to content script to open CSS editor
        await browser.tabs.sendMessage(activeTab.id, { 
          action: 'openCSSEditor'
        });
        
        console.log("Editor message sent successfully");
        // Close popup
        window.close();
      } catch (error) {
        console.error("Error sending editor message:", error);
        alert("Error: Could not communicate with the page. Please refresh the page and try again.");
      }
    });
  } else {
    console.error("Edit CSS button not found in the DOM");
  }
  
  // Theme customization handlers
  if (applyThemeBtn) {
    applyThemeBtn.addEventListener('click', async () => {
      console.log("Apply Theme button clicked");
      
      try {
        // Collect all theme settings
        const themeSettings = collectThemeSettings();
        
        // Save theme settings to extension state
        await StateManager.updateState({ 
          customTheme: themeSettings 
        });
        
        // Get the active tab
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) {
          console.error("No active tab found");
          return;
        }
        
        const activeTab = tabs[0];
        
        // Send message to content script to apply theme
        await browser.tabs.sendMessage(activeTab.id, { 
          action: 'applyInputBoxTheme', 
          theme: themeSettings 
        });
        
        console.log("Theme applied successfully");
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.textContent = "Theme applied successfully!";
        successMessage.style.cssText = "color: #4caf50; text-align: center; margin-top: 5px; font-size: 13px;";
        applyThemeBtn.parentNode.appendChild(successMessage);
        
        setTimeout(() => {
          successMessage.remove();
        }, 2000);
      } catch (error) {
        console.error("Error applying theme:", error);
        alert("Error: Could not apply theme. Please try again.");
      }
    });
  }
  
  if (resetThemeBtn) {
    resetThemeBtn.addEventListener('click', async () => {
      console.log("Reset Theme button clicked");
      
      try {
        // Reset to default theme
        const defaultTheme = getDefaultTheme();
        
        // Load default theme into UI
        loadThemeSettings(defaultTheme);
        
        // Save default theme to extension state
        await StateManager.updateState({ 
          customTheme: defaultTheme 
        });
        
        // Get the active tab
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) {
          console.error("No active tab found");
          return;
        }
        
        const activeTab = tabs[0];
        
        // Send message to content script to apply default theme
        await browser.tabs.sendMessage(activeTab.id, { 
          action: 'applyInputBoxTheme', 
          theme: defaultTheme 
        });
        
        console.log("Theme reset successfully");
      } catch (error) {
        console.error("Error resetting theme:", error);
        alert("Error: Could not reset theme. Please try again.");
      }
    });
  }
  
  // Handle theme selection dropdown changes
  const themeSelect = document.getElementById('box-theme');
  if (themeSelect) {
    themeSelect.addEventListener('change', () => {
      const selectedTheme = themeSelect.value;
      
      if (selectedTheme !== 'custom') {
        // Load preset theme values
        const presetTheme = getPresetTheme(selectedTheme);
        loadThemeSettings(presetTheme);
      }
    });
  }
  
  // Check server connection if in advanced mode
  if (state.mode === 'advanced') {
    checkServerConnection();
  }

  async function listAndRenderForms() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const response = await browser.tabs.sendMessage(tab.id, { action: 'listForms' });
    console.log('Forms from content:', response.forms);
    FormListRenderer.render(response.forms);
  }
});

// Helper function to get the appropriate unit for input fields
function getUnitForInput(inputId) {
  if (inputId === 'box-opacity') {
    return '%';
  } else if (inputId === 'box-width') {
    return '%';
  } else if (inputId.includes('height') || inputId.includes('radius') || inputId.includes('blur') || inputId.includes('font-size')) {
    return 'px';
  }
  return '';
}

// Collect theme settings from UI
function collectThemeSettings() {
  return {
    theme: document.getElementById('box-theme').value,
    backgroundColor: document.getElementById('box-bg-color').value,
    textColor: document.getElementById('box-text-color').value,
    accentColor: document.getElementById('box-accent-color').value,
    width: document.getElementById('box-width').value,
    minHeight: document.getElementById('box-height').value,
    opacity: document.getElementById('box-opacity').value,
    backdropBlur: document.getElementById('box-blur').value,
    animation: document.getElementById('floating-animation').value,
    borderRadius: document.getElementById('box-border-radius').value,
    shadowSize: document.getElementById('box-shadow-size').value,
    fontSize: document.getElementById('box-font-size').value,
    fontFamily: document.getElementById('box-font-family').value,
    showTimestamp: document.getElementById('show-timestamp').checked,
    timestamp: getCurrentDateTime(),
    username: CURRENT_USERNAME, // Use the constant defined at the top
  };
}

// Load theme settings into UI
function loadThemeSettings(settings) {
  if (!settings) return;
  
  try {
    // Update UI elements with saved settings
    if (settings.theme) document.getElementById('box-theme').value = settings.theme;
    if (settings.backgroundColor) document.getElementById('box-bg-color').value = settings.backgroundColor;
    if (settings.textColor) document.getElementById('box-text-color').value = settings.textColor;
    if (settings.accentColor) document.getElementById('box-accent-color').value = settings.accentColor;
    
    if (settings.width) {
      const widthInput = document.getElementById('box-width');
      widthInput.value = settings.width;
      widthInput.nextElementSibling.textContent = `${settings.width}%`;
    }
    
    if (settings.minHeight) {
      const heightInput = document.getElementById('box-height');
      heightInput.value = settings.minHeight;
      heightInput.nextElementSibling.textContent = `${settings.minHeight}px`;
    }
    
    if (settings.opacity) {
      const opacityInput = document.getElementById('box-opacity');
      opacityInput.value = settings.opacity;
      opacityInput.nextElementSibling.textContent = `${settings.opacity}%`;
    }
    
    if (settings.backdropBlur) {
      const blurInput = document.getElementById('box-blur');
      blurInput.value = settings.backdropBlur;
      blurInput.nextElementSibling.textContent = `${settings.backdropBlur}px`;
    }
    
    if (settings.animation) document.getElementById('floating-animation').value = settings.animation;
    
    if (settings.borderRadius) {
      const radiusInput = document.getElementById('box-border-radius');
      radiusInput.value = settings.borderRadius;
      radiusInput.nextElementSibling.textContent = `${settings.borderRadius}px`;
    }
    
    if (settings.shadowSize) document.getElementById('box-shadow-size').value = settings.shadowSize;
    
    if (settings.fontSize) {
      const fontSizeInput = document.getElementById('box-font-size');
      fontSizeInput.value = settings.fontSize;
      fontSizeInput.nextElementSibling.textContent = `${settings.fontSize}px`;
    }
    
    if (settings.fontFamily) document.getElementById('box-font-family').value = settings.fontFamily;
    if (settings.showTimestamp !== undefined) document.getElementById('show-timestamp').checked = settings.showTimestamp;
  } catch (error) {
    console.error("Error loading theme settings:", error);
  }
}

// Get default theme settings
function getDefaultTheme() {
  return {
    theme: 'light',
    backgroundColor: '#ffffff',
    textColor: '#333333',
    accentColor: '#4a90e2',
    width: '60',
    minHeight: '40',
    opacity: '100',
    backdropBlur: '5',
    animation: 'fade',
    borderRadius: '12',
    shadowSize: 'medium',
    fontSize: '16',
    fontFamily: 'system-ui',
    showTimestamp: true,
    timestamp: getCurrentDateTime(),
    username: "Ankitkumar1062"
  };
}

// Get preset theme by name
function getPresetTheme(themeName) {
  const baseTheme = getDefaultTheme();
  
  switch (themeName) {
    case 'dark':
      return {
        ...baseTheme,
        theme: 'dark',
        backgroundColor: '#222222',
        textColor: '#e0e0e0',
        accentColor: '#5c9ce6',
        shadowSize: 'large'
      };
    case 'blue':
      return {
        ...baseTheme,
        theme: 'blue',
        backgroundColor: '#e8f4ff',
        textColor: '#2c3e50',
        accentColor: '#2980b9',
        borderRadius: '8'
      };
    case 'minimal':
      return {
        ...baseTheme,
        theme: 'minimal',
        backgroundColor: '#ffffff',
        textColor: '#333333',
        accentColor: '#999999',
        backdropBlur: '0',
        borderRadius: '4',
        shadowSize: 'small',
        showTimestamp: false
      };
    case 'light':
    default:
      return baseTheme;
  }
}

// Get current date and time
function getCurrentDateTime() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Check server connection
async function checkServerConnection() {
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-text');
  
  if (!statusDot || !statusText) {
    console.error("Status elements not found");
    return;
  }
  
  statusDot.className = 'status-dot connecting';
  statusText.textContent = 'Connecting...';
  
  try {
    const response = await browser.runtime.sendMessage({ action: 'checkServer' });
    updateServerStatus(response.connected);
  } catch (error) {
    console.error('Error checking server:', error);
    updateServerStatus(false);
  }
}

// Update server status UI
function updateServerStatus(connected) {
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-text');
  
  if (!statusDot || !statusText) {
    console.error("Status elements not found");
    return;
  }
  
  if (connected) {
    statusDot.className = 'status-dot connected';
    statusText.textContent = 'Connected';
  } else {
    statusDot.className = 'status-dot disconnected';
    statusText.textContent = 'Disconnected';
  }
}
