// Content script for Floating Input Box extension

// Global variables for state management
let currentInputElement = null;
let floatingBox = null;
let extensionState = {
  enabled: true,
  mode: 'habit',
  position: 'top'
};
let isProcessing = false;
let currentCSS = '';
let cssEditor = null;

// Initialize as soon as the script loads
console.log("Floating Input Box content script loaded");

// Initialize state from background script
browser.runtime.sendMessage({ action: 'getState' })
  .then(response => {
    if (response && response.state) {
      extensionState = response.state;
      console.log('Floating Input Box initialized:', extensionState);
    } else {
      console.error("Failed to get initial state, using defaults");
    }
  })
  .catch(error => console.error('Failed to get state:', error));

// Listen for state updates from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message);
  
  if (message.action === 'stateUpdated') {
    extensionState = message.state;
    
    // If disabled, remove the floating box
    if (!extensionState.enabled && floatingBox) {
      removeFloatingBox();
    }
    
    sendResponse({ success: true });
  } else if (message.action === 'summarize') {
    console.log("Summarize action received:", message.summaryType);
    summarizePage(message.summaryType);
    sendResponse({ success: true });
  } else if (message.action === 'applyCSS') {
    console.log("Apply CSS action received:", message.cssPreset);
    applyCSS(message.cssPreset);
    sendResponse({ success: true });
  } else if (message.action === 'openCSSEditor') {
    console.log("Open CSS Editor action received");
    openCSSEditor();
    sendResponse({ success: true });
  }
  
  return true; // Keep the message channel open for async responses
});

// Create and inject the floating input box
function createFloatingBox() {
  console.log("Creating floating box");
  if (floatingBox) {
    console.log("Floating box already exists");
    return;
  }
  
  floatingBox = document.createElement('div');
  floatingBox.id = 'floating-input-box-extension';
  floatingBox.className = `floating-input-box ${extensionState.position}`;
  
  const inputContainer = document.createElement('div');
  inputContainer.className = 'input-container';
  
  const floatingInput = document.createElement('textarea');
  floatingInput.className = 'floating-input';
  floatingInput.placeholder = 'Type here...';
  
  // Sync from floating input to original input
  floatingInput.addEventListener('input', () => {
    if (currentInputElement) {
      currentInputElement.value = floatingInput.value;
      
      // Trigger change and input events on the original element
      const inputEvent = new Event('input', { bubbles: true });
      const changeEvent = new Event('change', { bubbles: true });
      currentInputElement.dispatchEvent(inputEvent);
      currentInputElement.dispatchEvent(changeEvent);
    }
  });
  
  // Add keyboard handling
  floatingInput.addEventListener('keydown', (e) => {
    // Handle tab, enter, etc.
    if (e.key === 'Escape') {
      removeFloatingBox();
      if (currentInputElement) {
        currentInputElement.blur();
      }
    }
  });
  
  const closeButton = document.createElement('button');
  closeButton.className = 'close-button';
  closeButton.innerText = '×';
  closeButton.addEventListener('click', removeFloatingBox);
  
  inputContainer.appendChild(floatingInput);
  inputContainer.appendChild(closeButton);
  floatingBox.appendChild(inputContainer);
  
  document.body.appendChild(floatingBox);
  console.log("Floating box added to DOM");
  
  // Focus the floating input
  setTimeout(() => {
    floatingInput.focus();
    
    // Copy current input text if it exists
    if (currentInputElement && currentInputElement.value) {
      floatingInput.value = currentInputElement.value;
    }
  }, 100);
}

// Remove the floating box
function removeFloatingBox() {
  if (floatingBox && floatingBox.parentNode) {
    floatingBox.parentNode.removeChild(floatingBox);
    floatingBox = null;
    currentInputElement = null;
    console.log("Floating box removed");
  }
}

// Monitor focus events on input elements
document.addEventListener('focusin', (event) => {
  console.log("Focus detected on:", event.target.tagName);
  
  if (!extensionState.enabled || extensionState.mode !== 'habit') {
    console.log("Extension disabled or not in habit mode");
    return;
  }
  
  const target = event.target;
  
  // Check if target is a text input or textarea
  if ((target.tagName === 'INPUT' && 
       (target.type === 'text' || target.type === 'search' || target.type === 'email' || target.type === 'password')) || 
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable) {
    
    console.log("Valid input detected, creating floating box");
    currentInputElement = target;
    createFloatingBox();
  }
});

// Handle input changes in the original input box
document.addEventListener('input', (event) => {
  if (!extensionState.enabled || !floatingBox || !currentInputElement) return;
  
  const target = event.target;
  
  // If the input event is from the original input element
  if (target === currentInputElement && floatingBox) {
    const floatingInput = floatingBox.querySelector('.floating-input');
    if (floatingInput && floatingInput.value !== target.value) {
      floatingInput.value = target.value;
    }
  }
});

// Function to summarize page content
async function summarizePage(summaryType) {
  console.log("Summarizing page:", summaryType);
  
  // Check if we're in advanced mode
  const response = await browser.runtime.sendMessage({ action: 'getState' });
  const state = response.state;
  
  if (!state.enabled || state.mode !== 'advanced') {
    alert('Please enable Advanced Mode to use summarization features.');
    return;
  }
  
  // Check server connection
  const serverResponse = await browser.runtime.sendMessage({ action: 'checkServer' });
  if (!serverResponse.connected) {
    alert('Cannot connect to the local LLM server. Make sure it\'s running at the configured address.');
    return;
  }
  
  // Create a floating UI to show processing status
  const processingUI = document.createElement('div');
  processingUI.id = 'floating-llm-processor';
  processingUI.className = 'floating-processor';
  processingUI.innerHTML = `
    <div class="processor-content">
      <h3>Summarizing Content</h3>
      <div class="progress-indicator">
        <div class="spinner"></div>
        <p>Processing text...</p>
      </div>
      <button class="cancel-button">Cancel</button>
    </div>
  `;
  
  // Add styles for the UI
  processingUI.style = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    padding: 20px;
    z-index: 10000;
    max-width: 500px;
    width: 90%;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  `;
  
  processingUI.querySelector('.processor-content').style = `
    display: flex;
    flex-direction: column;
    align-items: center;
  `;
  
  processingUI.querySelector('.progress-indicator').style = `
    display: flex;
    align-items: center;
    margin: 20px 0;
  `;
  
  processingUI.querySelector('.spinner').style = `
    width: 24px;
    height: 24px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #4a90e2;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 15px;
  `;
  
  processingUI.querySelector('.cancel-button').style = `
    background-color: #f2f2f2;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 10px;
  `;
  
  // Add keyframe animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(processingUI);
  console.log("Processing UI added to DOM");
  
  // Add cancel handler
  processingUI.querySelector('.cancel-button').addEventListener('click', () => {
    document.body.removeChild(processingUI);
  });
  
  try {
    // Extract text based on summary type
    let pageText = '';
    
    if (summaryType === 'selection') {
      // Get selected text
      pageText = window.getSelection().toString();
      if (!pageText || pageText.trim().length === 0) {
        throw new Error('No text selected. Please select some text to summarize.');
      }
    } else if (summaryType === 'main') {
      // Get main content
      pageText = extractMainContent();
    } else {
      // Get all content
      pageText = extractPageContent();
    }
    
    console.log(`Extracted ${pageText.length} characters of text`);
    
    // Send to LLM server
    const response = await fetch(`${state.server.url}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: pageText,
        action: 'summarize'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log("Received summary from server");
    
    // Update UI with results
    processingUI.innerHTML = `
      <div class="processor-content">
        <h3>Summary</h3>
        <div class="summary-results">
          ${result.summary ? 
            `<div class="summary-text">${result.summary}</div>` : 
            '<p>No summary generated.</p>'}
        </div>
        <div class="action-buttons">
          <button class="copy-button">Copy</button>
          <button class="close-button">Close</button>
        </div>
      </div>
    `;
    
    // Style the results UI
    processingUI.querySelector('.summary-results').style = `
      max-height: 300px;
      overflow-y: auto;
      margin: 15px 0;
      padding: 10px;
      background-color: #f9f9f9;
      border-radius: 4px;
      width: 100%;
    `;
    
    processingUI.querySelector('.action-buttons').style = `
      display: flex;
      gap: 10px;
      margin-top: 15px;
    `;
    
    const buttonStyle = `
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    
    processingUI.querySelector('.copy-button').style = buttonStyle + `
      background-color: #4a90e2;
      color: white;
    `;
    
    processingUI.querySelector('.close-button').style = buttonStyle + `
      background-color: #f2f2f2;
      color: #333;
    `;
    
    // Add copy handler
    processingUI.querySelector('.copy-button').addEventListener('click', () => {
      const summaryText = processingUI.querySelector('.summary-text').textContent;
      navigator.clipboard.writeText(summaryText)
        .then(() => {
          const copyBtn = processingUI.querySelector('.copy-button');
          copyBtn.textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
          }, 2000);
        })
        .catch(err => {
          console.error('Could not copy text:', err);
        });
    });
    
    // Add close handler
    processingUI.querySelector('.close-button').addEventListener('click', () => {
      document.body.removeChild(processingUI);
    });
    
  } catch (error) {
    console.error('Error processing with LLM:', error);
    
    // Show error message
    processingUI.innerHTML = `
      <div class="processor-content">
        <h3>Error</h3>
        <div class="error-message">
          <p>${error.message}</p>
        </div>
        <button class="close-button">Close</button>
      </div>
    `;
    
    processingUI.querySelector('.error-message').style = `
      padding: 10px;
      background-color: #ffebee;
      border-radius: 4px;
      color: #c62828;
      margin: 15px 0;
    `;
    
    processingUI.querySelector('.close-button').style = `
      background-color: #f2f2f2;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 10px;
    `;
    
    processingUI.querySelector('.close-button').addEventListener('click', () => {
      document.body.removeChild(processingUI);
    });
  }
}

// Function to extract page content
function extractPageContent() {
  // Get all paragraphs, headings, and list items
  const elements = [...document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, article, section')];
  
  // Extract text from elements
  const textContent = elements
    .map(el => el.textContent.trim())
    .filter(text => text.length > 0)
    .join('\n\n');
  
  // Limit to reasonable size to avoid overwhelming the LLM
  return textContent.substring(0, 6000);
}

// Function to extract main content
function extractMainContent() {
  // Try to find main content elements
  const mainSelectors = [
    'main',
    'article',
    '.content',
    '#content',
    '.main-content',
    '[role="main"]'
  ];
  
  let mainContent = '';
  
  // Try each selector
  for (const selector of mainSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      // Get text from first matching element
      mainContent = elements[0].textContent.trim();
      break;
    }
  }
  
  // If no main content found, fall back to important elements
  if (!mainContent) {
    const headings = document.querySelectorAll('h1, h2, h3');
    const paragraphs = document.querySelectorAll('p');
    
    // Add headings
    headings.forEach(heading => {
      mainContent += heading.textContent.trim() + '\n\n';
    });
    
    // Add paragraphs
    paragraphs.forEach(p => {
      mainContent += p.textContent.trim() + '\n\n';
    });
  }
  
  // Limit length
  return mainContent.substring(0, 6000);
}

// Function to apply CSS presets
function applyCSS(preset) {
  console.log("Applying CSS preset:", preset);
  let cssToApply = '';
  
  switch (preset) {
    case 'readability':
      cssToApply = `
        body {
          font-family: 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif !important;
          font-size: 18px !important;
          line-height: 1.6 !important;
          max-width: 800px !important;
          margin: 0 auto !important;
          padding: 0 20px !important;
          color: #333 !important;
          background-color: #f7f7f7 !important;
        }
        
        p, li {
          font-size: 18px !important;
          line-height: 1.6 !important;
          margin-bottom: 1em !important;
          color: #333 !important;
        }
        
        h1, h2, h3, h4, h5, h6 {
          line-height: 1.3 !important;
          margin-top: 1.5em !important;
          margin-bottom: 0.5em !important;
          color: #222 !important;
        }
        
        a {
          color: #0066cc !important;
          text-decoration: underline !important;
        }
        
        pre, code {
          background-color: #f0f0f0 !important;
          border-radius: 3px !important;
          font-family: monospace !important;
          padding: 0.2em 0.4em !important;
        }
        
        blockquote {
          border-left: 4px solid #ddd !important;
          padding-left: 1em !important;
          margin-left: 0 !important;
          color: #666 !important;
        }
      `;
      break;
      
    case 'dark':
      cssToApply = `
        body {
          background-color: #121212 !important;
          color: #e0e0e0 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif !important;
        }
        
        a {
          color: #90caf9 !important;
        }
        
        h1, h2, h3, h4, h5, h6 {
          color: #bbdefb !important;
        }
        
        p, li, td, th, div {
          color: #e0e0e0 !important;
        }
        
        pre, code, blockquote {
          background-color: #1e1e1e !important;
          border-color: #333 !important;
        }
        
        input, textarea, select {
          background-color: #2d2d2d !important;
          color: #e0e0e0 !important;
          border: 1px solid #444 !important;
        }
        
        button {
          background-color: #2d2d2d !important;
          color: #e0e0e0 !important;
          border: 1px solid #555 !important;
        }
      `;
      break;
      
    case 'large-text':
      cssToApply = `
        body {
          font-size: 20px !important;
          line-height: 1.6 !important;
        }
        
        p, div, li, td, th {
          font-size: 20px !important;
          line-height: 1.6 !important;
        }
        
        h1 {
          font-size: 36px !important;
        }
        
        h2 {
          font-size: 32px !important;
        }
        
        h3 {
          font-size: 28px !important;
        }
        
        h4, h5, h6 {
          font-size: 24px !important;
        }
        
        input, textarea, select, button {
          font-size: 20px !important;
        }
        
        .small, small, .text-sm {
          font-size: 18px !important;
        }
        
        code, pre {
          font-size: 18px !important;
        }
      `;
      break;
      
    case 'minimal':
      cssToApply = `
        /* Hide distracting elements */
        header, nav, aside, footer, .sidebar, .ad, .banner, .promotion, 
        .recommended, .related, .comments, .social, .share, .advertisement,
        [class*="ad-"], [class*="banner-"], [id*="ad-"], [id*="banner-"],
        [aria-label*="advertisement"], [role="banner"], [role="complementary"] {
          display: none !important;
        }
        
        /* Simplify layout */
        body {
          max-width: 800px !important;
          margin: 0 auto !important;
          padding: 20px !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif !important;
        }
        
        /* Focus on content */
        article, main, .content, #content, .main-content, [role="main"] {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          float: none !important;
        }
      `;
      break;
      
    case 'custom':
      // Use stored custom CSS if available, otherwise open editor
      if (currentCSS) {
        cssToApply = currentCSS;
      } else {
        openCSSEditor();
        return;
      }
      break;
  }
  
  applyCSSToPage(cssToApply);
}

// Function to apply CSS to the page
function applyCSSToPage(cssText) {
  console.log("Applying CSS to page");
  // Save current CSS
  currentCSS = cssText;
  
  // Remove existing custom style if it exists
  const existingStyle = document.getElementById('floating-input-box-custom-css');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  // Create and add new style element
  const styleElement = document.createElement('style');
  styleElement.id = 'floating-input-box-custom-css';
  styleElement.textContent = cssText;
  document.head.appendChild(styleElement);
  console.log("CSS style element added to page");
  
  // Show confirmation message
  const confirmationDiv = document.createElement('div');
  confirmationDiv.className = 'css-applied-confirmation';
  confirmationDiv.innerHTML = `
    <div class="confirmation-content">
      <p>CSS Applied!</p>
      <div class="confirmation-actions">
        <button class="edit-button">Edit</button>
        <button class="revert-button">Revert</button>
      </div>
    </div>
  `;
  
  // Style the confirmation
  confirmationDiv.style = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px 15px;
    border-radius: 5px;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    animation: fadeOut 0.5s 3s forwards;
  `;
  
  confirmationDiv.querySelector('.confirmation-content').style = `
    display: flex;
    align-items: center;
    justify-content: space-between;
  `;
  
  confirmationDiv.querySelector('p').style = `
    margin: 0;
    font-size: 14px;
  `;
  
  confirmationDiv.querySelector('.confirmation-actions').style = `
    display: flex;
    gap: 8px;
    margin-left: 15px;
  `;
  
  const buttonStyle = `
    background-color: transparent;
    border: 1px solid rgba(255, 255, 255, 0.5);
    color: white;
    padding: 3px 8px;
    border-radius: 3px;
    font-size: 12px;
    cursor: pointer;
  `;
  
  confirmationDiv.querySelectorAll('button').forEach(btn => {
    btn.style = buttonStyle;
  });
  
  // Add keyframe animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; visibility: hidden; }
    }
  `;
  document.head.appendChild(style);
  
  // Add event listeners
  confirmationDiv.querySelector('.edit-button').addEventListener('click', () => {
    confirmationDiv.remove();
    openCSSEditor();
  });
  
  confirmationDiv.querySelector('.revert-button').addEventListener('click', () => {
    confirmationDiv.remove();
    if (existingStyle) {
      existingStyle.remove();
    }
    currentCSS = '';
  });
  
  document.body.appendChild(confirmationDiv);
  
  // Remove after 5 seconds
  setTimeout(() => {
    if (confirmationDiv.parentNode) {
      confirmationDiv.remove();
    }
  }, 5000);
}

// Function to open CSS editor
function openCSSEditor() {
  console.log("Opening CSS editor");
  // If editor is already open, focus it
  if (cssEditor) {
    console.log("Editor already open, focusing");
    cssEditor.focus();
    return;
  }
  
  // Create editor UI
  cssEditor = document.createElement('div');
  cssEditor.id = 'css-editor-overlay';
  cssEditor.innerHTML = `
    <div class="editor-container">
      <div class="editor-header">
        <h2>CSS Editor</h2>
        <div class="editor-actions">
          <button class="preset-button">Presets</button>
          <button class="close-button">✕</button>
        </div>
      </div>
      <div class="editor-body">
        <textarea class="css-textarea" spellcheck="false" placeholder="/* Enter your custom CSS here */"></textarea>
      </div>
      <div class="editor-footer">
        <button class="apply-button">Apply CSS</button>
        <button class="preview-button">Preview</button>
        <button class="reset-button">Reset</button>
      </div>
      <div class="presets-panel" style="display: none;">
        <h3>CSS Presets</h3>
        <div class="preset-list">
          <button data-preset="readability">Readability Mode</button>
          <button data-preset="dark">Dark Mode</button>
          <button data-preset="large-text">Large Text</button>
          <button data-preset="minimal">Minimal UI</button>
          <button data-preset="generate">Generate with LLM</button>
        </div>
      </div>
    </div>
  `;
  
  // Style the editor
  cssEditor.style = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  const editorContainer = cssEditor.querySelector('.editor-container');
  editorContainer.style = `
    width: 80%;
    max-width: 800px;
    height: 80%;
    max-height: 600px;
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;
  
  const editorHeader = cssEditor.querySelector('.editor-header');
  editorHeader.style = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    border-bottom: 1px solid #eee;
  `;
  
  editorHeader.querySelector('h2').style = `
    margin: 0;
    font-size: 18px;
    color: #333;
  `;
  
  const editorActions = cssEditor.querySelector('.editor-actions');
  editorActions.style = `
    display: flex;
    gap: 10px;
  `;
  
  const presetButton = cssEditor.querySelector('.preset-button');
  presetButton.style = `
    background-color: #f0f0f0;
    border: none;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  
  const closeButton = cssEditor.querySelector('.close-button');
  closeButton.style = `
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: #666;
  `;
  
  const editorBody = cssEditor.querySelector('.editor-body');
  editorBody.style = `
    flex-grow: 1;
    padding: 15px;
    overflow: hidden;
  `;
  
  const cssTextarea = cssEditor.querySelector('.css-textarea');
  cssTextarea.style = `
    width: 100%;
    height: 100%;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 10px;
    font-family: monospace;
    font-size: 14px;
    resize: none;
    outline: none;
  `;
  
  const editorFooter = cssEditor.querySelector('.editor-footer');
  editorFooter.style = `
    padding: 15px;
    border-top: 1px solid #eee;
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  `;
  
  const applyButton = cssEditor.querySelector('.apply-button');
  applyButton.style = `
    background-color: #4a90e2;
    border: none;
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
  `;
  
  const previewButton = cssEditor.querySelector('.preview-button');
  previewButton.style = `
    background-color: #6c757d;
    border: none;
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
  `;
  
  const resetButton = cssEditor.querySelector('.reset-button');
  resetButton.style = `
    background-color: #f8f9fa;
    border: 1px solid #ddd;
    color: #333;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
  `;
  
  const presetsPanel = cssEditor.querySelector('.presets-panel');
  presetsPanel.style = `
    position: absolute;
    top: 60px;
    right: 15px;
    background-color: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    padding: 15px;
    width: 200px;
  `;
  
  presetsPanel.querySelector('h3').style = `
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 16px;
  `;
  
  const presetList = cssEditor.querySelector('.preset-list');
  presetList.style = `
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;
  
  presetList.querySelectorAll('button').forEach(btn => {
    btn.style = `
      background-color: #f8f9fa;
      border: 1px solid #ddd;
      padding: 8px;
      border-radius: 4px;
      text-align: left;
      cursor: pointer;
    `;
  });
  
  // Set initial CSS value if available
  if (currentCSS) {
    cssTextarea.value = currentCSS;
  }
  
  // Add event listeners
  closeButton.addEventListener('click', () => {
    document.body.removeChild(cssEditor);
    cssEditor = null;
  });
  
  applyButton.addEventListener('click', () => {
    const css = cssTextarea.value;
    applyCSSToPage(css);
    document.body.removeChild(cssEditor);
    cssEditor = null;
  });
  
  previewButton.addEventListener('click', () => {
    const css = cssTextarea.value;
    applyCSSToPage(css);
  });
  
  resetButton.addEventListener('click', () => {
    cssTextarea.value = '';
  });
  
  presetButton.addEventListener('click', () => {
    const panel = cssEditor.querySelector('.presets-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  
  // Add preset handlers
  cssEditor.querySelectorAll('.preset-list button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const preset = btn.dataset.preset;
      
      if (preset === 'generate') {
        // Generate CSS with LLM
        generateCSSWithLLM(cssTextarea);
      } else {
        // Load preset CSS
        cssEditor.querySelector('.presets-panel').style.display = 'none';
        
        // Apply the preset
        switch (preset) {
          case 'readability':
          case 'dark':
          case 'large-text':
          case 'minimal':
            // Call applyCSS with the preset, but intercept the CSS
            // Create a backup of the original function
            const originalApplyCSSToPage = window.applyCSSToPage;
            let capturedCSS = '';
            
            // Replace temporarily with a function that captures the CSS
            window.applyCSSToPage = (css) => {
              capturedCSS = css;
            };
            
            // Call applyCSS with the preset
            applyCSS(preset);
            
            // Restore original function
            window.applyCSSToPage = originalApplyCSSToPage;
            
            // Set the captured CSS to the textarea
            cssTextarea.value = capturedCSS;
            break;
        }
      }
    });
  });
  
  document.body.appendChild(cssEditor);
  console.log("CSS editor added to DOM");
  
  // Focus the textarea
  cssTextarea.focus();
}

// Function to generate CSS with LLM
async function generateCSSWithLLM(textarea) {
  // Check if we're in advanced mode
  const response = await browser.runtime.sendMessage({ action: 'getState' });
  const state = response.state;
  
  if (!state.enabled || state.mode !== 'advanced') {
    alert('Please enable Advanced Mode to use LLM features.');
    return;
  }
  
  // Check server connection
  const serverResponse = await browser.runtime.sendMessage({ action: 'checkServer' });
  if (!serverResponse.connected) {
    alert('Cannot connect to the local LLM server. Make sure it\'s running at the configured address.');
    return;
  }
  
  // Show generating indicator
  const presetsPanel = document.querySelector('.presets-panel');
  presetsPanel.style.display = 'none';
  
  const generatingIndicator = document.createElement('div');
  generatingIndicator.className = 'generating-indicator';
  generatingIndicator.innerHTML = `
    <div class="spinner"></div>
    <p>Generating CSS...</p>
  `;
  
  generatingIndicator.style = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 20px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 10001;
  `;
  
  generatingIndicator.querySelector('.spinner').style = `
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  `;
  
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleEl);
  
  cssEditor.appendChild(generatingIndicator);
  
  try {
    // Extract page content
    const pageText = extractPageContent();
    
    // Send to LLM server
    const response = await fetch(`${state.server.url}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: pageText,
        action: 'suggest_css'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Update textarea with generated CSS
    if (result.css_suggestions) {
      textarea.value = result.css_suggestions;
    } else {
      throw new Error('No CSS suggestions returned from the server.');
    }
  } catch (error) {
    console.error('Error generating CSS:', error);
    alert(`Error generating CSS: ${error.message}`);
  } finally {
    // Remove generating indicator
    if (generatingIndicator.parentNode) {
      generatingIndicator.parentNode.removeChild(generatingIndicator);
    }
  }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  console.log(`Key pressed: ${e.key}, Ctrl: ${e.ctrlKey}, Shift: ${e.shiftKey}`);
  
  // Ctrl+Shift+S to summarize
  if (e.ctrlKey && e.shiftKey && e.key === 'S') {
    console.log("Summarize shortcut triggered");
    summarizePage('main');
  }
  
  // Ctrl+Shift+C to open CSS editor
  if (e.ctrlKey && e.shiftKey && e.key === 'C') {
    console.log("CSS editor shortcut triggered");
    openCSSEditor();
  }
});

// For testing purposes
console.log("Content script fully loaded and initialized");