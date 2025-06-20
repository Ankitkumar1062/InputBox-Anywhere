// Background script for Floating Input Box extension

let extensionState = {
  enabled: true,
  mode: 'habit', // 'habit' or 'advanced'
  position: 'top', // 'top' or 'center'
  server: {
    url: 'http://localhost:8000',
    connected: false
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