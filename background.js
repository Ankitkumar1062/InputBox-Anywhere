/**
 * Custom Input Box Everywhere
 * Background script with robust LLM integration for Advanced Mode
 */

// Default configuration
const defaultConfig = {
  enabled: true,
  mode: 'habit', // 'habit' or 'advanced'
  position: 'top', // 'top', 'center', 'floating', or 'custom'
  theme: 'light',
  llmEndpoint: 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
  llmModel: 'mistral',
  apiKey: '', // User needs to provide their Hugging Face API key
  customStyles: {},
  editorSupport: true,
  cssModification: false,
  templates: [],
  customPosition: {
    top: '10%',
    left: '50%',
    transform: 'translateX(-50%)'
  },
  dragEnabled: true,
  summarizeContent: false
};

// Initialize the extension
async function initialize() {
  console.log('Background script initializing...');
  
  try {
    // Load or set default configuration
    const result = await browser.storage.sync.get('inputBoxConfig');
    if (!result.inputBoxConfig) {
      await browser.storage.sync.set({ inputBoxConfig: defaultConfig });
      console.log('Default configuration saved');
    } else {
      console.log('Configuration loaded from storage');
    }
    
    // Set up command listeners
    browser.commands.onCommand.addListener(handleCommand);
    console.log('Command listeners registered');
    
    // Set up message listeners
    browser.runtime.onMessage.addListener(handleMessage);
    console.log('Message listeners registered');
    
    // Initialize template manager
    await initializeTemplates();
    console.log('Templates initialized');
    
    console.log('Background script initialization complete');
  } catch (error) {
    console.error('Error during background script initialization:', error);
  }
}

// Initialize templates
async function initializeTemplates() {
  const result = await browser.storage.sync.get('inputBoxTemplates');
  if (!result.inputBoxTemplates) {
    // Load default templates
    const defaultTemplates = [
      {
        id: 'default-1',
        name: 'Greeting',
        content: 'Hello, thank you for your message. '
      },
      {
        id: 'default-2',
        name: 'Signature',
        content: '\n\nBest regards,\n[Your Name]'
      },
      {
        id: 'default-3',
        name: 'Quick Response',
        content: 'I\'ve received your message and will get back to you as soon as possible.'
      },
      {
        id: 'default-4',
        name: 'Meeting Invite',
        content: 'Would you be available for a quick meeting to discuss this? I\'m free on [Day] at [Time].'
      }
    ];
    
    await browser.storage.sync.set({ inputBoxTemplates: defaultTemplates });
  }
}

// Handle keyboard commands
function handleCommand(command) {
  console.log('Command received:', command);
  
  if (command === 'toggle-extension') {
    toggleExtension();
  } else if (command === 'toggle-mode') {
    toggleMode();
  } else if (command.startsWith('quick-template-')) {
    const templateIndex = parseInt(command.split('-').pop()) - 1;
    insertQuickTemplate(templateIndex);
  }
}

// Toggle the extension on/off
async function toggleExtension() {
  console.log('Toggling extension');
  
  try {
    const result = await browser.storage.sync.get('inputBoxConfig');
    const config = result.inputBoxConfig || defaultConfig;
    
    config.enabled = !config.enabled;
    await browser.storage.sync.set({ inputBoxConfig: config });
    
    // Notify all tabs
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      browser.tabs.sendMessage(tab.id, { action: 'toggleExtension' }).catch(() => {
        // Ignore errors from tabs where content script isn't loaded
      });
    }
    
    console.log('Extension toggled:', config.enabled ? 'enabled' : 'disabled');
  } catch (error) {
    console.error('Error toggling extension:', error);
  }
}

// Toggle between Habit and Advanced modes
async function toggleMode() {
  console.log('Toggling mode');
  
  try {
    const result = await browser.storage.sync.get('inputBoxConfig');
    const config = result.inputBoxConfig || defaultConfig;
    
    config.mode = config.mode === 'habit' ? 'advanced' : 'habit';
    await browser.storage.sync.set({ inputBoxConfig: config });
    
    // Notify all tabs
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      browser.tabs.sendMessage(tab.id, { action: 'toggleMode' }).catch(() => {
        // Ignore errors from tabs where content script isn't loaded
      });
    }
    
    console.log('Mode toggled to:', config.mode);
  } catch (error) {
    console.error('Error toggling mode:', error);
  }
}

// Insert a quick template
async function insertQuickTemplate(index) {
  console.log('Inserting quick template:', index);
  
  try {
    const result = await browser.storage.sync.get('inputBoxTemplates');
    if (!result.inputBoxTemplates || !result.inputBoxTemplates[index]) {
      console.warn('Template not found at index:', index);
      return;
    }
    
    const template = result.inputBoxTemplates[index];
    
    // Get the active tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      // Send the template to the content script
      browser.tabs.sendMessage(tabs[0].id, {
        action: 'insertTemplate',
        content: template.content
      }).catch((error) => {
        console.error('Error sending template to content script:', error);
      });
    }
  } catch (error) {
    console.error('Error inserting quick template:', error);
  }
}

// Handle messages from content script or popup
function handleMessage(message, sender, sendResponse) {
  console.log('Message received:', message.action);
  
  // Simple ping to check if background script is available
  if (message.action === 'ping') {
    sendResponse({ status: 'ok' });
    return true;
  }
  
  // Handle theme updates
  if (message.action === 'updateTheme') {
    // Update the theme in config
    browser.storage.sync.get('inputBoxConfig').then(result => {
      const config = result.inputBoxConfig || defaultConfig;
      config.theme = message.theme;
      return browser.storage.sync.set({ inputBoxConfig: config });
    }).then(() => {
      // Notify all tabs about the theme update
      return browser.tabs.query({});
    }).then(tabs => {
      // Broadcast theme change to all tabs
      for (const tab of tabs) {
        browser.tabs.sendMessage(tab.id, { 
          action: 'updateTheme', 
          theme: message.theme 
        }).catch(() => {
          // Ignore errors from tabs where content script isn't loaded
        });
      }
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Error updating theme:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  // LLM-related actions
  if (message.action === 'generateLLMSuggestion') {
    // Get the current model
    browser.storage.sync.get('inputBoxConfig').then(result => {
      const config = result.inputBoxConfig || defaultConfig;
      const modelName = message.model || config.llmModel || 'dummyLLM';
      
      // Extract text from prompt for better suggestion
      const text = message.prompt.replace(/Suggest 3 short continuations for this text: "|"/g, '');
      
      // Generate suggestions using LLM Service
      return LLMService.generateSuggestions(text, modelName);
    }).then(suggestion => {
      sendResponse({ suggestion });
    }).catch(error => {
      console.error('Error generating LLM suggestion:', error);
      sendResponse({ 
        suggestion: "• Continue your message\n• Be more specific\n• Add relevant details",
        error: error.message 
      });
    });
    return true;
  }
  
  if (message.action === 'summarizeContent') {
    // Get the current model
    browser.storage.sync.get('inputBoxConfig').then(result => {
      const config = result.inputBoxConfig || defaultConfig;
      const modelName = message.model || config.llmModel || 'dummyLLM';
      
      // Extract text from prompt for better summarization
      const textMatch = message.prompt.match(/Please summarize the following text concisely:\s*([\s\S]*?)(?:Summary:|$)/);
      const text = textMatch ? textMatch[1].trim() : message.prompt;
      
      // Generate summary using LLM Service
      return LLMService.summarize(text, modelName);
    }).then(summary => {
      sendResponse({ summary });
    }).catch(error => {
      console.error('Error summarizing content:', error);
      sendResponse({ 
        summary: "This appears to be a detailed text. The main points have been condensed here for easier reading.",
        error: error.message 
      });
    });
    return true;
  }
  
  if (message.action === 'generateCssRules') {
    // Get the current model
    browser.storage.sync.get('inputBoxConfig').then(result => {
      const config = result.inputBoxConfig || defaultConfig;
      const modelName = message.model || config.llmModel || 'dummyLLM';
      
      // Extract description from prompt for better CSS rules
      const descriptionMatch = message.prompt.match(/description: "(.*?)"/);
      const description = descriptionMatch ? descriptionMatch[1] : message.prompt;
      
      // Generate CSS rules using LLM Service
      return LLMService.generateCssRules(description, modelName);
    }).then(rules => {
      sendResponse({ rules });
    }).catch(error => {
      console.error('Error generating CSS rules:', error);
      sendResponse({ 
        rules: [
          {
            "selector": "input[type='text']",
            "styles": { 
              "background-color": "#f5f5f5",
              "border": "1px solid #ccc"
            }
          }
        ],
        error: error.message 
      });
    });
    return true;
  }
  
  if (message.action === 'generateTemplate') {
    // Get the current model
    browser.storage.sync.get('inputBoxConfig').then(result => {
      const config = result.inputBoxConfig || defaultConfig;
      const modelName = message.model || config.llmModel || 'dummyLLM';
      
      // Generate template using LLM Service
      return LLMService.handleRequest(message.prompt, modelName);
    }).then(template => {
      sendResponse({ template });
    }).catch(error => {
      console.error('Error generating template:', error);
      sendResponse({ 
        template: "Hello,\n\nThank you for your message. I'll respond as soon as possible.\n\nBest regards,\n[Your Name]",
        error: error.message 
      });
    });
    return true;
  }
  
  if (message.action === 'testLLMConnection') {
    LLMService.testConnection(message.model, message.apiKey)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({
          success: false,
          error: error.message
        });
      });
    return true;
  }
  
  // Configuration-related actions
  if (message.action === 'updateConfig') {
    browser.storage.sync.set({ inputBoxConfig: message.config })
      .then(() => {
        // Notify all tabs about the config update
        return browser.tabs.query({});
      })
      .then(tabs => {
        for (const tab of tabs) {
          browser.tabs.sendMessage(tab.id, { 
            action: 'updateConfig', 
            config: message.config 
          }).catch(() => {
            // Ignore errors from tabs where content script isn't loaded
          });
        }
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  // Template-related actions
  if (message.action === 'saveTemplates') {
    browser.storage.sync.set({ inputBoxTemplates: message.templates })
      .then(() => {
        // Notify all tabs about the template update
        return browser.tabs.query({});
      })
      .then(tabs => {
        for (const tab of tabs) {
          browser.tabs.sendMessage(tab.id, { 
            action: 'updateTemplates', 
            templates: message.templates 
          }).catch(() => {
            // Ignore errors from tabs where content script isn't loaded
          });
        }
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  // CSS rules-related actions
  if (message.action === 'saveCssRules') {
    browser.storage.sync.set({ cssRules: message.rules })
      .then(() => {
        // Notify all tabs about the CSS rules update
        return browser.tabs.query({});
      })
      .then(tabs => {
        for (const tab of tabs) {
          browser.tabs.sendMessage(tab.id, { 
            action: 'updateCssRules', 
            cssRules: message.rules 
          }).catch(() => {
            // Ignore errors from tabs where content script isn't loaded
          });
        }
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  // If no handler matched
  return false;
}

// Initialize when the background script loads
initialize().catch(error => {
  console.error('Failed to initialize background script:', error);
});