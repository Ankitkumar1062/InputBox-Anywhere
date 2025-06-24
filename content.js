// Content script for Floating Input Box extension

// ===== Module: FormManager =====
const FormManager = (() => {
  const registry = new Map();
  let counter = 1;

  function deepQueryAll(root, selector) {
    const results = [];
    (function recurse(node) {
      if (node.nodeType === Node.ELEMENT_NODE && node.matches(selector)) {
        results.push(node);
      }
      if (node.shadowRoot) recurse(node.shadowRoot);
      let child = node.firstElementChild;
      while (child) {
        recurse(child);
        child = child.nextElementSibling;
      }
    })(root);
    return results;
  }

  function registerNode(node) {
    const id = `form-${counter++}`;
    registry.set(id, { node, placeholder: null, lifted: false });
  }

  function detectForms() {
    console.log('⏱ FormManager.detectForms running...');
    registry.clear();
    counter = 1;

    // Real forms
    deepQueryAll(document, 'form').forEach(registerNode);
    // Pseudo-forms: containers with inputs/textareas
    deepQueryAll(document, 'div, section, article')
      .filter(el => el.querySelector('input,textarea'))
      .forEach(registerNode);

    const list = Array.from(registry.entries()).map(([id, { node }]) => {
      const label = node.id || node.getAttribute('name') || `${node.tagName.toLowerCase()} #${id}`;
      return { id, label };
    });
    console.log(`⏱ FormManager found ${list.length} form(s).`);
    return list;
  }

  function createWrapper(id) {
    const wrapper = document.createElement('div');
    wrapper.id = `form-wrapper-${id}`;
    Object.assign(wrapper.style, {
      position: 'relative',
      margin: '10px 0',
      zIndex: 999999,
      transition: 'transform 0.3s ease'
    });
    const first = document.body.firstElementChild;
    document.body.insertBefore(wrapper, first);
    return wrapper;
  }

  function toggleForm(id) {
    const record = registry.get(id);
    if (!record) return;
    const { node, placeholder, lifted } = record;
    if (!lifted) {
      const comment = document.createComment(`placeholder-${id}`);
      node.parentNode.insertBefore(comment, node);
      const wrapper = document.getElementById(`form-wrapper-${id}`) || createWrapper(id);
      wrapper.appendChild(node);
      record.placeholder = comment;
      record.lifted = true;
    } else {
      placeholder.parentNode.insertBefore(node, placeholder);
      placeholder.remove();
      record.placeholder = null;
      record.lifted = false;
    }
  }

  return { detectForms, toggleForm };
})();

// ===== Message Handling =====
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'listForms') {
    const forms = FormManager.detectForms();
    sendResponse({ forms });
    return true;
  }
  if (message.action === 'toggleForm') {
    FormManager.toggleForm(message.formId);
    sendResponse({ success: true });
    return true;
  }
  // Other actions fall through to existing handlers
  return true;
});

// ===== Legacy functionality =====
// Global variables for state management
let currentInputElement = null;
let floatingBox = null;
let extensionState = {
  enabled: true,
  mode: 'habit',
  position: 'top',
  isFloating: false
};
let isProcessing = false;
let currentCSS = '';
let cssEditor = null;
let documentClickHandler = null;

// Helper functions for reading/writing to original input elements
// Reads text from either a form control or a contentEditable element
function readOriginal(el) {
  if (el.isContentEditable) return el.innerText || '';
  return el.value || '';
}

// Writes text back into either a form control or a contentEditable element
function writeOriginal(el, text) {
  if (el.isContentEditable) el.innerText = text;
  else                      el.value     = text;
}

// Insert a full-screen blurred backdrop
function showBlurOverlay() {
  const ov = document.createElement('div');
  ov.id = 'floating-input-blur-overlay';
  Object.assign(ov.style, {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backdropFilter: 'blur(8px)',      // adjust blur as you like
    backgroundColor: 'rgba(255,255,255,0.2)',
    zIndex: 999998                   // just underneath your floatingBox
  });
  document.body.appendChild(ov);
}

// Remove it
function removeBlurOverlay() {
  const ov = document.getElementById('floating-input-blur-overlay');
  if (ov) ov.remove();
}

let isDragging = false;
let dragOffsetX;
let dragOffsetY;

// Function to make an element draggable
function makeDraggable(element) {
  element.addEventListener('mousedown', (e) => {
    if (e.target === element || e.target.closest('.header')) { // Only drag if clicking the box itself or its header
      isDragging = true;
      dragOffsetX = e.clientX - element.getBoundingClientRect().left;
      dragOffsetY = e.clientY - element.getBoundingClientRect().top;
      element.style.cursor = 'grabbing';
      e.preventDefault(); // Prevent default drag behavior
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const newX = e.clientX - dragOffsetX;
    const newY = e.clientY - dragOffsetY;

    element.style.left = `${newX}px`;
    element.style.top = `${newY}px`;
    element.style.right = 'auto'; // Clear right property
    element.style.bottom = 'auto'; // Clear bottom property
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      element.style.cursor = 'grab';
      // Save the new position
      chrome.storage.local.set({
        floatingBoxPosition: {
          left: element.style.left,
          top: element.style.top
        }
      });
    }
  });

  // Add grab cursor when hovering
  element.style.cursor = 'grab';
}

// Function to stop dragging functionality
function stopDragging(element) {
  element.style.cursor = 'auto';
  // To fully stop dragging, you'd need to remove the specific event listeners added by makeDraggable.
  // For simplicity, for now, we're relying on the element being removed or makeDraggable not being called.
  // A more robust implementation would involve storing and removing event listeners.
  element.style.left = '';
  element.style.top = '';
  element.style.right = '';
  element.style.bottom = '';
}

// Function to load the saved position of the floating box
async function loadFloatingBoxPosition(element) {
  const storedData = await chrome.storage.local.get('floatingBoxPosition');
  if (storedData.floatingBoxPosition) {
    element.style.left = storedData.floatingBoxPosition.left;
    element.style.top = storedData.floatingBoxPosition.top;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
  }
}

// Initialize as soon as the script loads
console.log("Floating Input Box content script loaded");

// Initialize state from background script
browser.runtime.sendMessage({ action: 'getState' })
  .then(response => {
    if (response && response.state) {
      extensionState = response.state;
      console.log('Floating Input Box initialized:', extensionState);
      // Initial application of theme and draggable state if box is already present (e.g., page refresh)
      if (floatingBox) {
        applyInputBoxTheme(extensionState.customTheme);
      }
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
    
    // Handle floating box draggable state change or other theme updates
    if (floatingBox) {
      applyInputBoxTheme(extensionState.customTheme);
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
  if (message.action === 'applyInputBoxTheme') {
    console.log("Apply Input Box Theme received:", message.theme);
    applyInputBoxTheme(message.theme);
    sendResponse({ success: true });
    return true;
  }
  
  return true; // Keep the message channel open for async responses
});

// Apply theme to the floating input box
function applyInputBoxTheme(theme) {
  console.log("Applying input box theme:", theme);

  // Store theme settings for future use
  if (theme) {
    extensionState.customTheme = theme;
  } else {
    // Use existing theme if available
    theme = extensionState.customTheme; // Fallback to existing if no new theme provided
  }
  
  if (!theme) {
    console.log("No theme available to apply");
    return;
  }
  
  // Ensure theme includes floatingEnabled based on current extension state
  theme.floatingEnabled = extensionState.isFloating;

  // If there's an existing floating box, update it
  if (floatingBox) {
    updateFloatingBoxTheme(floatingBox, theme);
  } else {
    console.log("No floating box exists to update theme, it will be applied on creation.");
  }
  
  // Generate and inject CSS for future floating boxes
  generateAndInjectThemeCSS(theme);

  // If floating is enabled, make it draggable
  if (floatingBox && extensionState.isFloating) {
    makeDraggable(floatingBox);
    loadFloatingBoxPosition(floatingBox);
  } else if (floatingBox) {
    stopDragging(floatingBox);
  }
}

// Update existing floating box with theme settings
function updateFloatingBoxTheme(boxElement, theme) {
  console.log("Updating floating box theme elements with theme:", theme);
  if (!theme) return;

  // Calculate z-index based on priority (1-10 scale to 999999-9999999 range)
  const zIndexValue = 999999 + (parseInt(theme.zIndex || 5) * 100000);

  // Apply core styles
  let coreCss = `
    background-color: ${hexToRgba(theme.backgroundColor, theme.opacity)} !important;
    width: ${theme.width}% !important;
    min-width: 500px !important;
    border-radius: ${theme.borderRadius}px !important;
    box-shadow: ${getShadowStyle(theme.shadowSize)} !important;
    ${parseInt(theme.backdropBlur) > 0 ? `backdrop-filter: blur(${theme.backdropBlur}px) !important;` : ''}
    z-index: ${zIndexValue} !important;
    position: fixed !important;
  `;

  // Handle floating behavior - clear position for dragging, or set for fixed
  if (theme.floatingEnabled) {
    boxElement.classList.remove('top', 'center');
    // Clear specific positioning to allow dragging
    coreCss += `
      top: auto !important;
      left: auto !important;
      right: auto !important;
      bottom: auto !important;
      transform: none !important;
    `;
    boxElement.classList.add('floating-enabled');
  } else {
    boxElement.classList.add(extensionState.position);
    boxElement.classList.remove('floating-enabled');
    // Re-apply standard positioning properties
    if (extensionState.position === 'center') {
      coreCss += `
        top: 40% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
      `;
    } else { // 'top' position
      coreCss += `
        top: 30px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
      `;
    }
  }

  boxElement.style.cssText = coreCss;
  
  // Set data attributes for ::before and ::after pseudo-elements
  boxElement.setAttribute('data-title', 'Floating Input');
  boxElement.setAttribute('data-theme', theme.theme);
  
  // Find the textarea and update its styles
  const textarea = boxElement.querySelector('.floating-input');
  if (textarea) {
    textarea.style.cssText = `
      min-height: ${theme.minHeight}px !important;
      color: ${theme.textColor} !important;
      font-size: ${theme.fontSize}px !important;
      font-family: ${getFontFamily(theme.fontFamily)} !important;
      border-color: ${theme.accentColor} !important;
    `;
  } else {
    console.error("Textarea not found in floating box");
  }
  
  // Update accent color
  document.documentElement.style.setProperty('--floating-input-accent-color', theme.accentColor);
  
  // Handle timestamp display
  if (theme.showTimestamp) {
    boxElement.setAttribute('data-show-timestamp', 'true');
    boxElement.setAttribute('data-timestamp', theme.timestamp || '2025-06-21 06:22:38');
    boxElement.setAttribute('data-username', theme.username || 'Ankitkumar1062');
  } else {
    boxElement.setAttribute('data-show-timestamp', 'false');
  }
}

// Generate and inject CSS for theme
function generateAndInjectThemeCSS(theme) {
  // Create or update the theme style element
  let themeStyleElement = document.getElementById('floating-input-box-theme');
  
  if (!themeStyleElement) {
    themeStyleElement = document.createElement('style');
    themeStyleElement.id = 'floating-input-box-theme';
    document.head.appendChild(themeStyleElement);
  }
  
  // Generate CSS based on theme settings
  const css = `
    #floating-input-box-extension {
      --accent-color: ${theme.accentColor};
      background-color: ${hexToRgba(theme.backgroundColor, theme.opacity)} !important;
      width: ${theme.width}% !important;
      border-radius: ${theme.borderRadius}px !important;
      box-shadow: ${getShadowStyle(theme.shadowSize)} !important;
      ${parseInt(theme.backdropBlur) > 0 ? `backdrop-filter: blur(${theme.backdropBlur}px) !important;` : ''}
      ${theme.animation !== 'none' ? `animation: ${getAnimationStyle(theme.animation)} !important;` : ''}
    }
    
    #floating-input-box-extension::before {
      color: ${theme.accentColor} !important;
    }
    
    #floating-input-box-extension .floating-input {
      min-height: ${theme.minHeight}px !important;
      color: ${theme.textColor} !important;
      font-size: ${theme.fontSize}px !important;
      font-family: ${getFontFamily(theme.fontFamily)} !important;
      border-color: ${lightenColor(theme.accentColor, 30)} !important;
    }
    
    #floating-input-box-extension .floating-input:focus {
      border-color: ${theme.accentColor} !important;
      box-shadow: 0 0 0 3px ${hexToRgba(theme.accentColor, 20)} !important;
    }
    
    ${theme.showTimestamp ? `
    #floating-input-box-extension[data-show-timestamp="true"]::after {
      content: "Last updated: " attr(data-timestamp) " • " attr(data-username) !important;
      display: block !important;
      font-size: 11px !important;
      color: ${lightenColor(theme.textColor, 30)} !important;
      margin-top: 10px !important;
      text-align: right !important;
      font-family: ${getFontFamily(theme.fontFamily)} !important;
    }
    ` : `
    #floating-input-box-extension[data-show-timestamp="false"]::after {
      display: none !important;
    }
    `}
  `;
  
  themeStyleElement.textContent = css;
}

// Helper function to convert hex color to rgba
function hexToRgba(hex, opacity) {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse the hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate opacity value (0-1)
  const alpha = parseInt(opacity) / 100;
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Helper function to get shadow style based on size
function getShadowStyle(size) {
  switch (size) {
    case 'none':
      return 'none';
    case 'small':
      return '0 2px 10px rgba(0, 0, 0, 0.1)';
    case 'large':
      return '0 10px 30px rgba(0, 0, 0, 0.2)';
    case 'medium':
    default:
      return '0 4px 20px rgba(0, 0, 0, 0.15)';
  }
}

// Helper function to get animation style
function getAnimationStyle(animation) {
  switch (animation) {
    case 'slide':
      return 'slide-down 0.4s ease-out';
    case 'bounce':
      return 'bounce-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    case 'fade':
    default:
      return 'fade-in 0.3s ease-out';
  }
}

// Helper function to get font family
function getFontFamily(fontFamily) {
  switch (fontFamily) {
    case 'roboto':
      return '"Roboto", sans-serif';
    case 'open-sans':
      return '"Open Sans", sans-serif';
    case 'monospace':
      return 'monospace';
    case 'system-ui':
    default:
      return 'system-ui, -apple-system, sans-serif';
  }
}

// Helper function to lighten a color
function lightenColor(color, percent) {
  // Remove # if present
  color = color.replace('#', '');
  
  // Parse the hex values
  let r = parseInt(color.substring(0, 2), 16);
  let g = parseInt(color.substring(2, 4), 16);
  let b = parseInt(color.substring(4, 6), 16);
  
  // Lighten the color
  r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
  g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
  b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
  
  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Add animation keyframes
function addAnimationKeyframes() {
  const style = document.createElement('style');
  style.id = 'floating-input-box-animations';
  style.textContent = `
    @keyframes fade-in {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    
    @keyframes slide-down {
      0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      100% { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    
    @keyframes bounce-in {
      0% { opacity: 0; transform: translateX(-50%) scale(0.8); }
      20% { transform: translateX(-50%) scale(1.05); }
      40% { transform: translateX(-50%) scale(0.95); }
      60% { transform: translateX(-50%) scale(1.02); }
      80% { transform: translateX(-50%) scale(0.98); }
      100% { opacity: 1; transform: translateX(-50%) scale(1); }
    }
  `;
  
  document.head.appendChild(style);
}

// Call this on script load to add animation keyframes
addAnimationKeyframes();

// Create and inject the floating input box
function createFloatingBox() {
  console.log("Creating floating box");
  if (floatingBox) {
    console.log("Floating box already exists");
    return;
  }
  
  floatingBox = document.createElement('div');
  floatingBox.id = 'floating-input-box-extension';
  // The class name will be updated by applyInputBoxTheme/updateFloatingBoxTheme
  // floatingBox.className = `floating-input-box ${extensionState.position}`;
  
  const inputContainer = document.createElement('div');
  inputContainer.className = 'input-container';
  
  const floatingInput = document.createElement('textarea');
  floatingInput.className = 'floating-input';
  floatingInput.placeholder = 'Type here...';

  // 1) Seed the floating textarea from the page
  floatingInput.value = readOriginal(currentInputElement);

  // 2) Floating → Original
  floatingInput.addEventListener('input', () => {
    if (!currentInputElement) return;
    writeOriginal(currentInputElement, floatingInput.value);
    // for real inputs, also fire input/change events
    if (!currentInputElement.isContentEditable) {
      currentInputElement.dispatchEvent(new Event('input',{bubbles:true}));
      currentInputElement.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });

  // only for contentEditable (e.g. WhatsApp)
  let poller = null;
  if (currentInputElement.isContentEditable) {
    poller = setInterval(() => {
      const text = readOriginal(currentInputElement);
      if (floatingInput.value !== text) {
        floatingInput.value = text;
      }
    }, 100); // adjust interval as you like (100ms is usually fine)

    // stash so we can clear it later
    floatingBox._poller = poller;
  }

  // 3) Original → Floating
  const syncHandler = () => {
    const newVal = readOriginal(currentInputElement);
    if (floatingInput.value !== newVal) {
      floatingInput.value = newVal;
    }
  };
  // listen to both input and keyup (covers most contentEditable widgets)
  currentInputElement.addEventListener('input', syncHandler);
  currentInputElement.addEventListener('keyup',  syncHandler);

  // stash this so you can remove it later
  floatingBox._syncHandler = syncHandler;

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
  
  // 1) Advanced mode styling
  if (extensionState.mode === 'advanced') {
    Object.assign(floatingBox.style, {
      position:       'fixed',
      top:            '0',
      left:           '0',
      width:          '100%',
      height:         '100%',
      padding:        '20px',
      boxSizing:      'border-sizing',
      backgroundColor:'rgba(255,255,255,0.15)', // light translucent overlay
      mixBlendMode:   'overlay',                // blend into the page
      zIndex:         '9999999',
      overflow:       'auto',                   // in case content spills
      cursor:         'auto'
    });
  } else if (extensionState.mode === 'habit') {
    showBlurOverlay();
  }

  document.body.appendChild(floatingBox);
  console.log("Floating box added to DOM");

  // Apply custom theme immediately after creation, which will handle draggable state
  if (extensionState.customTheme) {
    console.log("Applying custom theme on creation:", extensionState.customTheme);
    setTimeout(() => {
      applyInputBoxTheme(extensionState.customTheme);
    }, 0);
  }
  
  // Focus the floating input
  setTimeout(() => {
    floatingInput.focus();
    
    // Copy current input text if it exists
    if (currentInputElement && currentInputElement.value) {
      floatingInput.value = currentInputElement.value;
    }
    
    // Add document click handler after a short delay to prevent immediate closing
    setTimeout(() => {
      // Remove any existing click handler first to avoid duplicates
      if (documentClickHandler) {
        document.removeEventListener('click', documentClickHandler, true);
      }
      
      // Create and add the click handler
      documentClickHandler = (event) => {
        console.log("Document click detected. Target:", event.target);
        console.log("Floating Box exists:", !!floatingBox);
        console.log("Current Input Element exists:", !!currentInputElement);
        
        const isClickInsideFloatingBox = floatingBox && floatingBox.contains(event.target);
        const isClickInsideOriginalInput = currentInputElement && currentInputElement.contains(event.target);
        
        console.log("Click inside floating box:", isClickInsideFloatingBox);
        console.log("Click inside original input:", isClickInsideOriginalInput);

        // Check if click is outside both the floating box and the original input
        if (!isClickInsideFloatingBox && !isClickInsideOriginalInput) {
          console.log("Click outside detected, removing floating box");
          removeFloatingBox();
        }
      };
      
      // Attach listener in the capturing phase
      document.addEventListener('click', documentClickHandler, true);
    }, 100);
  }, 100);
}

function removeFloatingBox() {
  // remove blur first
  removeBlurOverlay();

  if (floatingBox && floatingBox.parentNode) {
    floatingBox.parentNode.removeChild(floatingBox);

    // Tear down two-way bind
    if (currentInputElement && floatingBox._syncHandler) {
      currentInputElement.removeEventListener('input', floatingBox._syncHandler);
      currentInputElement.removeEventListener('keyup',  floatingBox._syncHandler);
    }

    // Clear poller if it exists
    if (floatingBox && floatingBox._poller) {
      clearInterval(floatingBox._poller);
    }

    floatingBox = null;
    currentInputElement = null;
    console.log("Floating box removed");
    
    // Remove the document click handler, also in capturing phase
    if (documentClickHandler) {
      document.removeEventListener('click', documentClickHandler, true);
      documentClickHandler = null;
    }
  }
}

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

document.addEventListener('click', (event) => {
  if (!extensionState.enabled) return;

  // If click happened *inside* the floating box, ignore
  if (floatingBox && floatingBox.contains(event.target)) {
    return;
  }

  const tgt = event.target;
  // only true <input type="text|search|email|password">, <textarea>, or contentEditable
  const isTextInput =
    tgt.tagName === 'INPUT' &&
    ['text', 'search', 'email', 'password'].includes(tgt.type);
  const isTextarea = tgt.tagName === 'TEXTAREA';
  const isCE = tgt.isContentEditable;

  if (isTextInput || isTextarea || isCE) {
    // remember which field
    currentInputElement = tgt;
    createFloatingBox();
  } else {
    // click outside any typing area should close it
    removeFloatingBox();
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
      <div class="llm-results">
        <p>Your summary will appear here...</p>
      </div>
      <div class="tool-options mt-10">
        <button id="copy-summary-btn">Copy Summary</button>
        <button id="close-processor-btn" class="secondary-btn">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(processingUI);
  
  const copySummaryBtn = processingUI.querySelector('#copy-summary-btn');
  const closeProcessorBtn = processingUI.querySelector('#close-processor-btn');
  const resultsDiv = processingUI.querySelector('.llm-results');
  const progressText = processingUI.querySelector('.progress-indicator p');
  const spinner = processingUI.querySelector('.spinner');
  
  if (copySummaryBtn) {
    copySummaryBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(resultsDiv.textContent);
      alert('Summary copied to clipboard!');
    });
  }
  
  if (closeProcessorBtn) {
    closeProcessorBtn.addEventListener('click', () => {
      processingUI.remove();
      isProcessing = false;
    });
  }
  
  isProcessing = true;
  resultsDiv.textContent = ''; // Clear previous results
  progressText.textContent = 'Processing text...';
  spinner.style.display = 'inline-block'; // Show spinner
  
  let contentToSummarize = '';
  if (summaryType === 'selection') {
    contentToSummarize = window.getSelection().toString();
    if (!contentToSummarize) {
      alert('Please select some text to summarize.');
      processingUI.remove();
      isProcessing = false;
      return;
    }
  } else if (summaryType === 'full') {
    contentToSummarize = extractPageContent();
  } else if (summaryType === 'main') {
    contentToSummarize = extractMainContent();
  }
  
  console.log("Content to summarize:", contentToSummarize.substring(0, 200) + "...");
  
  try {
    const llmResponse = await browser.runtime.sendMessage({
      action: 'callLLM',
      prompt: `Summarize the following content:\n\n${contentToSummarize}`
    });
    
    spinner.style.display = 'none'; // Hide spinner
    progressText.textContent = 'Summary generated.';
    resultsDiv.textContent = llmResponse.response;
    console.log("Summarization complete.");
  } catch (error) {
    console.error("Error during summarization:", error);
    spinner.style.display = 'none'; // Hide spinner
    progressText.textContent = 'Error.';
    resultsDiv.textContent = 'Error generating summary. Please check the server connection and try again.';
    alert('Error generating summary: ' + error.message);
  }
}

// Function to extract page content for summarization
function extractPageContent() {
  // Get all visible text from the body
  let text = '';
  const body = document.querySelector('body');
  if (body) {
    text = body.innerText;
  }
  
  // Basic cleanup: remove multiple newlines, trim whitespace
  text = text.replace(/\\n\\n+/g, '\\n').trim();
  
  return text;
}

// Function to extract main content (e.g., from article or main tags)
function extractMainContent() {
  let mainContent = '';
  const article = document.querySelector('article');
  const main = document.querySelector('main');
  const body = document.querySelector('body');
  
  if (article) {
    mainContent = article.innerText;
  } else if (main) {
    mainContent = main.innerText;
  } else if (body) {
    mainContent = body.innerText;
  }
  
  // More refined cleanup to remove script/style content, etc.
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = mainContent;
  
  // Remove scripts and styles
  tempDiv.querySelectorAll('script, style, noscript, svg, button, input, textarea, select, option, footer, nav, header, aside, form, iframe, img, picture, video, audio').forEach(el => el.remove());
  
  // Get cleaned text
  let cleanedText = tempDiv.innerText;
  
  // Remove excessive whitespace and newlines
  cleanedText = cleanedText.replace(/\\s\\s+/g, ' ').replace(/\\n\\n+/g, '\\n').trim();
  
  return cleanedText;
}

// Function to apply custom CSS
function applyCSS(preset) {
  console.log("Applying CSS preset:", preset);
  
  // Check if we're in advanced mode
  browser.runtime.sendMessage({ action: 'getState' })
    .then(response => {
      const state = response.state;
      if (!state.enabled || state.mode !== 'advanced') {
        alert('Please enable Advanced Mode to use CSS customization.');
        return;
      }
      
      let cssText = '';
      switch (preset) {
        case 'custom':
          // For custom, we don't apply anything here. User will use the editor.
          break;
        case 'readability':
          cssText = `
            body {
              font-family: 'Merriweather', serif !important;
              line-height: 1.6 !important;
              max-width: 700px !important;
              margin: 40px auto !important;
              padding: 0 20px !important;
              color: #333 !important;
              background-color: #fcfcfc !important;
            }
            p {
              margin-bottom: 1em !important;
            }
            h1, h2, h3, h4, h5, h6 {
              font-family: 'Roboto', sans-serif !important;
              color: #222 !important;
              line-height: 1.2 !important;
              margin-top: 1.5em !important;
              margin-bottom: 0.5em !important;
            }
            a {
              color: #007bff !important;
              text-decoration: none !important;
            }
            a:hover {
              text-decoration: underline !important;
            }
            img {
              max-width: 100% !important;
              height: auto !important;
              display: block !important;
              margin: 20px 0 !important;
            }
            code, pre {
              font-family: 'Fira Code', monospace !important;
              background-color: #f8f8f8 !important;
              border-radius: 4px !important;
              padding: 2px 4px !important;
            }
            pre {
              padding: 15px !important;
              overflow-x: auto !important;
            }
            blockquote {
              border-left: 4px solid #ccc !important;
              padding-left: 15px !important;
              color: #555 !important;
              font-style: italic !important;
            }
          `;
          break;
        case 'dark':
          cssText = `
            body {
              background-color: #1a1a1a !important;
              color: #e0e0e0 !important;
            }
            a {
              color: #90b8f0 !important;
            }
            a:hover {
              color: #6090e0 !important;
            }
            h1, h2, h3, h4, h5, h6 {
              color: #f0f0f0 !important;
            }
            code, pre {
              background-color: #2a2a2a !important;
              color: #e0e0e0 !important;
            }
            blockquote {
              border-left-color: #555 !important;
              color: #bbb !important;
            }
            /* Invert images (optional, might not always look good) */
            img {
              filter: invert(0.8) hue-rotate(180deg) !important;
            }
          `;
          break;
        case 'large-text':
          cssText = `
            body {
              font-size: 1.2em !important;
              line-height: 1.8 !important;
            }
            p {
              font-size: 1.1em !important;
            }
            h1 {
              font-size: 2.5em !important;
            }
            h2 {
              font-size: 2em !important;
            }
            /* Adjust other elements as needed */
          `;
          break;
        case 'minimal':
          cssText = `
            body {
              font-family: sans-serif !important;
              max-width: 800px !important;
              margin: 20px auto !important;
              padding: 15px !important;
              background-color: #fff !important;
              color: #333 !important;
            }
            img, .ad, .sidebar, .related-posts, footer, header {
              display: none !important;
            }
            h1, h2, h3, h4, h5, h6 {
              text-align: center !important;
              border-bottom: 1px solid #eee !important;
              padding-bottom: 10px !important;
              margin-top: 2em !important;
            }
            p {
              text-align: justify !important;
            }
            blockquote {
              border-left: none !important;
              text-align: center !important;
              font-style: normal !important;
            }
          `;
          break;
        default:
          console.log("No CSS preset selected or unknown preset.");
          break;
      }
      
      if (cssText) {
        applyCSSToPage(cssText);
        currentCSS = cssText; // Save current applied CSS
      }
    })
    .catch(error => {
      console.error("Error getting state for CSS application:", error);
      alert("Error: Could not get extension state. Please refresh the page and try again.");
    });
}

// Function to apply CSS to the current page
function applyCSSToPage(cssText) {
  let styleElement = document.getElementById('floating-input-box-custom-css');
  
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'floating-input-box-custom-css';
    document.head.appendChild(styleElement);
  }
  
  styleElement.textContent = cssText;
  console.log("Custom CSS applied.");
}

// Function to open a CSS editor
function openCSSEditor() {
  console.log("Opening CSS editor");
  
  let editorOverlay = document.getElementById('css-editor-overlay');
  if (!editorOverlay) {
    editorOverlay = document.createElement('div');
    editorOverlay.id = 'css-editor-overlay';
    editorOverlay.className = 'css-editor-overlay';
    editorOverlay.innerHTML = `
      <div class="css-editor-container">
        <h3>Edit Custom CSS</h3>
        <textarea id="css-editor-textarea" placeholder="Write your CSS here..."></textarea>
        <div class="editor-actions">
          <button id="save-css-btn">Apply & Save</button>
          <button id="generate-css-btn">Generate with LLM</button>
          <button id="cancel-css-btn" class="secondary-btn">Cancel</button>
        </div>
        <div id="llm-loading-indicator" class="progress-indicator" style="display:none;">
          <div class="spinner"></div>
          <p>Generating CSS...</p>
        </div>
      </div>
    `;
    document.body.appendChild(editorOverlay);
    
    // Pre-fill with current CSS or a default
    const editorTextarea = document.getElementById('css-editor-textarea');
    editorTextarea.value = currentCSS || `/* Example: change background color */
body {
  background-color: #f0f0f0;
}

/* Example: center paragraphs */
p {
  text-align: center;
}
`;
    
    // Event listeners for editor buttons
    document.getElementById('save-css-btn').addEventListener('click', () => {
      const newCss = editorTextarea.value;
      applyCSSToPage(newCss);
      currentCSS = newCss; // Update current CSS
      editorOverlay.remove();
      // Save to storage
      browser.runtime.sendMessage({ action: 'setState', state: { customCss: newCss } });
    });
    
    document.getElementById('generate-css-btn').addEventListener('click', async () => {
      const prompt = editorTextarea.value;
      const loadingIndicator = document.getElementById('llm-loading-indicator');
      loadingIndicator.style.display = 'flex';

      try {
        // Check server connection first
        const serverResponse = await browser.runtime.sendMessage({ action: 'checkServer' });
        if (!serverResponse.connected) {
          alert('Cannot connect to the local LLM server. Make sure it\'s running at the configured address.');
          loadingIndicator.style.display = 'none';
          return;
        }

        const llmResponse = await browser.runtime.sendMessage({
          action: 'callLLM',
          prompt: `Generate CSS for the following description or existing CSS snippet. Only return the CSS code, no explanations or markdown. If the input is already CSS, improve it or complete it:\n\n${prompt}`
        });
        editorTextarea.value = llmResponse.response;
      } catch (error) {
        console.error("Error generating CSS with LLM:", error);
        alert("Error generating CSS: " + error.message);
      } finally {
        loadingIndicator.style.display = 'none';
      }
    });
    
    document.getElementById('cancel-css-btn').addEventListener('click', () => {
      editorOverlay.remove();
    });
  }
  
  // Save the current CSS to storage whenever it's edited
  const editorTextarea = document.getElementById('css-editor-textarea');
  if (editorTextarea) {
    editorTextarea.addEventListener('input', () => {
      browser.runtime.sendMessage({ action: 'setState', state: { customCss: editorTextarea.value } });
    });
  }
}

// Function to generate CSS with LLM (moved to background script)
async function generateCSSWithLLM(textarea) {
  // This function is now handled by the background script after user interaction from the editor.
  // It remains here as a placeholder or if direct content script interaction is needed later.
}

// Inject a base theme CSS to ensure some default styling is always present
function injectBaseThemeCSS() {
  const baseStyle = document.createElement('style');
  baseStyle.id = 'floating-input-box-base-theme';
  baseStyle.textContent = `
    #floating-input-box-extension {
      /* Base styles that can be overridden by custom themes */
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      box-sizing: border-box;
      color: #333;
    }
    #floating-input-box-extension * {
      box-sizing: border-box;
    }
    #floating-input-box-extension .floating-input {
      transition: all 0.2s ease-in-out;
    }
    #floating-input-box-extension .floating-input:focus {
      outline: none;
    }
    
    /* Animations */
    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slide-down {
      from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes bounce-in {
      0% { opacity: 0; transform: translateX(-50%) scale(0.8); }
      20% { transform: translateX(-50%) scale(1.05); }
      40% { transform: translateX(-50%) scale(0.95); }
      60% { transform: translateX(-50%) scale(1.02); }
      80% { transform: translateX(-50%) scale(0.98); }
      100% { opacity: 1; transform: translateX(-50%) scale(1); }
    }
  `;
  document.head.appendChild(baseStyle);
}

// Call base theme injection on load
injectBaseThemeCSS();

// Function to get current date and time (for timestamp)
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

// Initial state and event listeners setup
document.addEventListener('DOMContentLoaded', () => {
  // Inject base theme CSS
  injectBaseThemeCSS();
  // Request initial state from background script
  browser.runtime.sendMessage({ action: 'getState' })
    .then(response => {
      if (response && response.state) {
        extensionState = response.state;
        console.log('Floating Input Box initialized with state:', extensionState);
        
        // Apply any custom CSS that was saved
        if (extensionState.customCss) {
          applyCSSToPage(extensionState.customCss);
          currentCSS = extensionState.customCss;
        }
        
        // Apply existing theme if present
        if (extensionState.customTheme) {
          applyInputBoxTheme(extensionState.customTheme);
        }
      } else {
        console.error("Failed to get initial state, using defaults.");
      }
    })
    .catch(error => console.error('Error getting initial state:', error));

  // Add animation keyframes on DOMContentLoaded for consistency
  addAnimationKeyframes();
});

