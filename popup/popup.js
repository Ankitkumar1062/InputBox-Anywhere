// Popup script to handle user interactions

document.addEventListener('DOMContentLoaded', async () => {
  const enableToggle = document.getElementById('enable-toggle');
  const habitModeRadio = document.getElementById('habit-mode');
  const advancedModeRadio = document.getElementById('advanced-mode');
  const positionTopRadio = document.getElementById('position-top');
  const positionCenterRadio = document.getElementById('position-center');
  const checkServerButton = document.getElementById('check-server');
  const openOptionsLink = document.getElementById('open-options');
  const advancedTools = document.getElementById('advanced-tools');
  
  // Advanced tool buttons
  const summarizeBtn = document.getElementById('summarize-btn');
  const applyCssBtn = document.getElementById('apply-css-btn');
  const editCssBtn = document.getElementById('edit-css-btn');
  
  // Get current state from background script
  const response = await browser.runtime.sendMessage({ action: 'getState' });
  const state = response.state;
  
  // Update UI based on current state
  enableToggle.checked = state.enabled;
  
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
  
  // Update server status indicator
  updateServerStatus(state.server.connected);
  
  // Add event listeners for mode switches
  enableToggle.addEventListener('change', () => {
    updateState({ enabled: enableToggle.checked });
  });
  
  habitModeRadio.addEventListener('change', () => {
    if (habitModeRadio.checked) {
      updateState({ mode: 'habit' });
      advancedTools.style.display = 'none';
    }
  });
  
  advancedModeRadio.addEventListener('change', () => {
    if (advancedModeRadio.checked) {
      updateState({ mode: 'advanced' });
      advancedTools.style.display = 'block';
      checkServerConnection();
    }
  });
  
  positionTopRadio.addEventListener('change', () => {
    if (positionTopRadio.checked) {
      updateState({ position: 'top' });
    }
  });
  
  positionCenterRadio.addEventListener('change', () => {
    if (positionCenterRadio.checked) {
      updateState({ position: 'center' });
    }
  });
  
  checkServerButton.addEventListener('click', checkServerConnection);
  
  openOptionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    browser.runtime.openOptionsPage();
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
  
  // Check server connection if in advanced mode
  if (state.mode === 'advanced') {
    checkServerConnection();
  }
});

// Update state in background script
async function updateState(newState) {
  try {
    await browser.runtime.sendMessage({ 
      action: 'setState', 
      state: newState 
    });
    console.log("State updated successfully:", newState);
  } catch (error) {
    console.error("Error updating state:", error);
  }
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