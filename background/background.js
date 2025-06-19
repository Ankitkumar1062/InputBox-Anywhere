/**
 * Background script for the Custom Input Box Everywhere extension
 * Last updated: 2025-06-18 12:47:57
 * Author: Ankitkumar1062
 */

// Default extension settings
const DEFAULT_SETTINGS = {
  enabled: true,
  mode: 'habit', // 'habit' or 'advanced'
  position: 'top', // 'top', 'center', or 'float'
  grokApiKey: '',
  opacity: 0.9,
  fontSize: 16,
  width: '80%',
  theme: 'light', // 'light', 'dark', or 'high-contrast'
  alwaysShowToolbar: true,
  lastPosition: { top: '100px', left: '100px' },
  lastDimensions: { width: '600px', height: '300px' }
};

console.log("Background script starting at", new Date().toLocaleTimeString());

// Initialize extension settings
browser.runtime.onInstalled.addListener(() => {
  console.log('Extension installed or updated');
  browser.storage.local.get('settings', (result) => {
    if (!result.settings) {
      browser.storage.local.set({ settings: DEFAULT_SETTINGS });
      console.log('Extension initialized with default settings');
    }
  });
});

// Handle keyboard shortcuts
browser.runtime.onCommand.addListener((command) => {
  console.log(`Command received: ${command}`);
  
  if (command === 'toggle-extension') {
    browser.storage.local.get('settings', (result) => {
      const settings = result.settings || DEFAULT_SETTINGS;
      settings.enabled = !settings.enabled;
      browser.storage.local.set({ settings });
      
      // Notify all tabs about the change
      notifyAllTabs({ type: 'TOGGLE_EXTENSION', enabled: settings.enabled });
      console.log(`Extension ${settings.enabled ? 'enabled' : 'disabled'}`);
    });
  } else if (command === 'toggle-mode') {
    browser.storage.local.get('settings', (result) => {
      const settings = result.settings || DEFAULT_SETTINGS;
      settings.mode = settings.mode === 'habit' ? 'advanced' : 'habit';
      browser.storage.local.set({ settings });
      
      // Notify all tabs about the change
      notifyAllTabs({ type: 'TOGGLE_MODE', mode: settings.mode });
      console.log(`Mode switched to ${settings.mode}`);
    });
  }
});

// Send a message to all tabs
function notifyAllTabs(message) {
  browser.tabs.query({}, (tabs) => {
    console.log(`Sending message to ${tabs.length} tabs:`, message);
    
    for (const tab of tabs) {
      try {
        browser.tabs.sendMessage(tab.id, message).catch(err => {
          // Silently ignore errors for inactive tabs
          console.debug(`Could not send message to tab ${tab.id}:`, err);
        });
      } catch (err) {
        console.debug(`Error preparing message for tab ${tab.id}:`, err);
      }
    }
  });
}

// Make API call to Groq
async function callGroqAPI(apiKey, body) {
  try {
    console.log('Calling Groq API...');
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
    
    console.log('Groq API response status:', response.status);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `API Error: ${response.status}`);
    }
    
    console.log('Groq API call successful');
    return { success: true, data };
  } catch (error) {
    console.error('Groq API error:', error);
    return { success: false, error: error.message };
  }
}

// Listen for messages from content scripts or popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    console.log('Message received in background:', message.type);
    
    // Handle pings to check if background is alive
    if (message.type === 'PING') {
      console.log('Received ping, sending pong');
      sendResponse({ success: true, message: 'PONG' });
      return true;
    }
    
    // Handle settings requests
    if (message.type === 'GET_SETTINGS') {
      browser.storage.local.get('settings', (result) => {
        sendResponse(result.settings || DEFAULT_SETTINGS);
      });
      return true;
    } 
    
    // Handle settings updates
    if (message.type === 'UPDATE_SETTINGS') {
      browser.storage.local.get('settings', (result) => {
        // Merge the new settings with existing ones
        const currentSettings = result.settings || DEFAULT_SETTINGS;
        const updatedSettings = { ...currentSettings, ...message.settings };
        
        browser.storage.local.set({ settings: updatedSettings })
          .then(() => {
            console.log('Settings updated:', updatedSettings);
            notifyAllTabs({ type: 'SETTINGS_UPDATED', settings: updatedSettings });
            sendResponse({ success: true });
          })
          .catch(error => {
            console.error('Error updating settings:', error);
            sendResponse({ success: false, error: error.message });
          });
      });
      return true;
    } 
    
    // Handle extension toggle
    if (message.type === 'TOGGLE_EXTENSION') {
      browser.storage.local.get('settings', (result) => {
        const settings = result.settings || DEFAULT_SETTINGS;
        settings.enabled = message.enabled;
        
        browser.storage.local.set({ settings })
          .then(() => {
            console.log(`Extension ${settings.enabled ? 'enabled' : 'disabled'}`);
            notifyAllTabs({ type: 'TOGGLE_EXTENSION', enabled: settings.enabled });
            sendResponse({ success: true });
          })
          .catch(error => {
            console.error('Error toggling extension:', error);
            sendResponse({ success: false, error: error.message });
          });
      });
      return true;
    }
    
    // Handle position saving
    if (message.type === 'SAVE_POSITION') {
      browser.storage.local.get('settings', (result) => {
        const settings = result.settings || DEFAULT_SETTINGS;
        settings.lastPosition = message.position;
        
        browser.storage.local.set({ settings })
          .then(() => {
            console.log('Position saved:', message.position);
            sendResponse({ success: true });
          })
          .catch(error => {
            console.error('Error saving position:', error);
            sendResponse({ success: false, error: error.message });
          });
      });
      return true;
    } 
    
    // Handle dimensions saving
    if (message.type === 'SAVE_DIMENSIONS') {
      browser.storage.local.get('settings', (result) => {
        const settings = result.settings || DEFAULT_SETTINGS;
        settings.lastDimensions = message.dimensions;
        
        browser.storage.local.set({ settings })
          .then(() => {
            console.log('Dimensions saved:', message.dimensions);
            sendResponse({ success: true });
          })
          .catch(error => {
            console.error('Error saving dimensions:', error);
            sendResponse({ success: false, error: error.message });
          });
      });
      return true;
    }
    
    // Handle API testing
    if (message.type === 'DIRECT_GROQ_TEST') {
      console.log('Testing Groq API connection');
      
      callGroqAPI(message.apiKey, {
        model: "llama3-8b-8192",
        messages: [{ role: "user", content: "Hello, this is a test." }],
        max_tokens: 1
      }).then(result => {
        sendResponse(result);
      }).catch(error => {
        console.error('Uncaught API test error:', error);
        sendResponse({ success: false, error: error.message });
      });
      
      return true;
    }
    
    // Handle general API requests
    if (message.type === 'DIRECT_GROQ_REQUEST') {
      console.log('Processing Groq API request');
      
      callGroqAPI(message.apiKey, message.body)
        .then(result => {
          sendResponse(result);
        })
        .catch(error => {
          console.error('Uncaught API request error:', error);
          sendResponse({ success: false, error: error.message });
        });
      
      return true;
    }
    
    // For unhandled message types
    console.warn('Unhandled message type:', message.type);
    sendResponse({ success: false, error: 'Unhandled message type' });
    return true;
    
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: 'Background script error: ' + error.message });
    return true;
  }
});

console.log('Background script initialized');