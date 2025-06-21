// Background script for Floating Input Box extension

// Update the extension state object to include customTheme
let extensionState = {
  enabled: true,
  mode: 'habit',
  position: 'top',
  server: {
    url: 'http://localhost:8000',
    connected: false
  },
  customTheme: {
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
    timestamp: '2025-06-21 05:07:20',
    username: 'Ankitkumar1062'
  }
};


// Initialize state from storage
browser.storage.local.get('extensionState').then(result => {
  if (result.extensionState) {
    extensionState = result.extensionState;
    console.log("Loaded extension state from storage:", extensionState);
  } else {
    // Save default state
    browser.storage.local.set({ extensionState });
    console.log("Initialized default extension state");
  }
}).catch(error => {
  console.error("Error loading extension state:", error);
});

// Listen for keyboard shortcuts
browser.commands.onCommand.addListener(command => {
  console.log("Command received:", command);
  
  if (command === 'toggle-floating-box') {
    extensionState.enabled = !extensionState.enabled;
    console.log("Toggled extension enabled state:", extensionState.enabled);
    updateState();
  } else if (command === 'toggle-advanced-mode') {
    extensionState.mode = extensionState.mode === 'habit' ? 'advanced' : 'habit';
    console.log("Toggled mode to:", extensionState.mode);
    updateState();
  }
});

// Handle messages from content script or popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background script received message:", message);
  
  if (message.action === 'getState') {
    console.log("Sending current state:", extensionState);
    sendResponse({ state: extensionState });
    return true;
  } else if (message.action === 'setState') {
      // FIXED: Properly merge nested objects like customTheme
      if (message.state.customTheme) {
        extensionState.customTheme = {
          ...extensionState.customTheme,
          ...message.state.customTheme
        };
        // Delete from message.state to avoid double application
        delete message.state.customTheme;
      }
      extensionState = { ...extensionState, ...message.state };
      console.log("Updated state:", extensionState);
      updateState();
      sendResponse({ success: true });
      return true;
  } else if (message.action === 'checkServer') {
    console.log("Checking server connection");
    checkServerConnection()
      .then(connected => {
        extensionState.server.connected = connected;
        console.log("Server connection status:", connected);
        updateState();
        sendResponse({ connected });
      })
      .catch(error => {
        console.error('Server connection error:', error);
        extensionState.server.connected = false;
        updateState();
        sendResponse({ connected: false, error: error.message });
      });
    return true;
  } else if (message.action === 'getLLMServerURL') {
    sendResponse({ url: extensionState.server.url });
    return true;
  } else if (message.action === 'setLLMServerURL') {
    extensionState.server.url = message.url;
    updateState();
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'callLLM') {
    console.log("Calling LLM with prompt:", message.prompt.substring(0, 100) + "...");
    callLLM(message.prompt)
      .then(response => {
        sendResponse({ success: true, response: response });
      })
      .catch(error => {
        console.error('Error calling LLM:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Update state and notify content scripts
function updateState() {
  browser.storage.local.set({ extensionState });
  console.log("Saved state to storage");
  
  // Notify all content scripts about state change
  browser.tabs.query({}).then(tabs => {
    console.log(`Notifying ${tabs.length} tabs about state update`);
    for (const tab of tabs) {
      browser.tabs.sendMessage(tab.id, { 
        action: 'stateUpdated', 
        state: extensionState 
      }).catch(err => {
        // Ignore errors for tabs where content script isn't loaded
        console.log(`Could not update tab ${tab.id}: ${err.message}`);
      });
    }
  });
}

// Check if local LLM server is running
async function checkServerConnection() {
  console.log("Attempting to connect to server at:", extensionState.server.url);
  try {
    const response = await fetch(`${extensionState.server.url}/health`, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 2000
    });
    console.log("Server connection successful");
    return true;
  } catch (error) {
    console.error('Server connection failed:', error);
    return false;
  }
}

// Function to call the local LLM server for processing prompts
async function callLLM(prompt) {
  console.log("Sending prompt to LLM server:", prompt.substring(0, 100) + "...");
  try {
    const response = await fetch(`${extensionState.server.url}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: prompt,
        action: 'summarize' // Assuming 'summarize' action for LLM server
      }),
      timeout: 30000 // 30 seconds timeout for LLM response
    });

    if (!response.ok) {
      throw new Error(`LLM Server error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data.summary) {
      console.log("LLM response successful");
      return data.summary;
    } else {
      throw new Error("LLM response did not contain a summary.");
    }
  } catch (error) {
    console.error('Error during LLM call:', error);
    throw error; // Re-throw to be caught by the message handler
  }
}

// Context menu setup
browser.contextMenus.create({
  id: "summarize-selection",
  title: "Summarize Selection",
  contexts: ["selection"]
});

browser.contextMenus.create({
  id: "apply-readability-css",
  title: "Apply Readability Mode",
  contexts: ["page"]
});

browser.contextMenus.create({
  id: "open-css-editor",
  title: "Edit Page CSS",
  contexts: ["page"]
});

// Handle context menu clicks
browser.contextMenus.onClicked.addListener((info, tab) => {
  console.log("Context menu clicked:", info.menuItemId);
  
  if (info.menuItemId === "summarize-selection") {
    browser.tabs.sendMessage(tab.id, { action: "summarize", summaryType: "selection" });
  } else if (info.menuItemId === "apply-readability-css") {
    browser.tabs.sendMessage(tab.id, { action: "applyCSS", cssPreset: "readability" });
  } else if (info.menuItemId === "open-css-editor") {
    browser.tabs.sendMessage(tab.id, { action: "openCSSEditor" });
  }
});

console.log("Background script initialized");
