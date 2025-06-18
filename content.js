/**
 * Custom Input Box Everywhere
 * Enhanced content script with support for rich text editors, code editors,
 * and additional positioning options
 */

// Configuration defaults with enhanced options
let config = {
  enabled: true,
  mode: 'habit', // 'habit' or 'advanced'
  position: 'top', // 'top', 'center', 'floating', or 'custom'
  theme: 'light',
  llmEndpoint: '',
  llmModel: 'dummyLLM',
  apiKey: '',
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

// Enhanced state management
let state = {
  activeInput: null,
  customInputBox: null,
  originalPlaceholder: '',
  isCustomInputVisible: false,
  lastPosition: null,
  isDragging: false,
  dragOffset: { x: 0, y: 0 },
  detectedEditor: null,
  activeTemplates: [],
  cssRules: []
};

// Check if the background script is ready
function checkBackgroundScript() {
  return new Promise((resolve) => {
    function pingBackground() {
      browser.runtime.sendMessage({ action: 'ping' })
        .then(response => {
          if (response && response.status === 'ok') {
            console.log('Background script is ready');
            resolve();
          } else {
            setTimeout(pingBackground, 100);
          }
        })
        .catch(() => {
          setTimeout(pingBackground, 100);
        });
    }
    
    // Start checking
    pingBackground();
  });
}

// Initialize when the content script loads
async function initialize() {
  console.log("Content script initializing...");
  
  try {
    // Make sure the background script is ready
    await checkBackgroundScript();
    
    // Load config from storage
    browser.storage.sync.get(['inputBoxConfig', 'inputBoxTemplates', 'cssRules']).then(result => {
      if (result.inputBoxConfig) {
        config = { ...config, ...result.inputBoxConfig };
        console.log("Loaded configuration:", config.mode, config.position, config.theme);
      }
      
      if (result.inputBoxTemplates) {
        state.activeTemplates = result.inputBoxTemplates;
        console.log("Loaded templates:", state.activeTemplates.length);
      }
      
      if (result.cssRules) {
        state.cssRules = result.cssRules;
        console.log("Loaded CSS rules:", state.cssRules.length);
      }
      
      // Expose LLMService on window for CssModifier to use
      // This assumes llm-service.js is loaded before content.js
      if (typeof LLMService !== 'undefined') {
        window.LLMService = LLMService;
        window.LLMService.currentModel = config.llmModel; // Set the current model from config
      }

      // Create the custom input box
      createCustomInputBox();
      
      // Set up event listeners
      setupEventListeners();
      
      // Apply CSS modifications if in advanced mode and enabled
      if (config.mode === 'advanced' && config.cssModification && state.cssRules && state.cssRules.length > 0) {
        console.log("Applying CSS rules immediately after initialization");
        applyCssModifications();
      }
      
      // Apply auto-generated rules if in advanced mode
      if (config.mode === 'advanced' && config.cssModification) {
        applyAutoRules(); // Call after initial CSS is applied
      }

      console.log("Content script initialized successfully");
    });
  } catch (error) {
    console.error("Error initializing content script:", error);
  }
}

// Apply CSS modifications
function applyCssModifications() {
  if (!config.cssModification || !state.cssRules || state.cssRules.length === 0) {
    return;
  }
  
  console.log("Applying CSS modifications:", state.cssRules.length, "rules");
  CssModifier.applyRules(state.cssRules);
  
  // Also check if we can generate improved input rules based on the page
  if (config.mode === 'advanced') {
    try {
      const improvedRules = CssModifier.generateImprovedInputRules();
      if (improvedRules && improvedRules.length > 0) {
        console.log("Adding", improvedRules.length, "auto-generated CSS rules");
        CssModifier.applyRules([...state.cssRules, ...improvedRules]);
      }
    } catch (error) {
      console.error("Error generating improved rules:", error);
    }
  }
}

// Create an enhanced custom input box
function createCustomInputBox() {
  console.log("Creating custom input box");
  
  // Create container for our custom input
  const container = document.createElement('div');
  container.id = 'custom-input-box-container';
  container.className = `custom-input-box-theme-${config.theme}`;
  
  // Apply position class based on config
  applyPositionClass(container);
  
  // Create the input or textarea element based on the active input type
  const inputContainer = document.createElement('div');
  inputContainer.className = 'custom-input-box-input-container';
  
  // For basic input (will be replaced with appropriate type as needed)
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'custom-input-box';
  input.placeholder = 'Type here and it will sync with the focused input field';
  inputContainer.appendChild(input);
  
  // Create controls
  const controls = document.createElement('div');
  controls.className = 'custom-input-box-controls';
  
  const modeIndicator = document.createElement('span');
  modeIndicator.id = 'custom-input-box-mode';
  modeIndicator.textContent = config.mode === 'habit' ? 'Habit Mode' : 'Advanced Mode';
  
  // Add advanced mode indicator badge
  if (config.mode === 'advanced') {
    const advancedBadge = document.createElement('span');
    advancedBadge.className = 'advanced-mode-badge';
    advancedBadge.textContent = '✨';
    advancedBadge.title = 'Advanced features enabled';
    modeIndicator.appendChild(advancedBadge);
  }
  
  // Add Enter button
  const enterButton = document.createElement('button');
  enterButton.className = 'custom-input-box-enter';
  enterButton.title = 'Submit (Enter)';
  enterButton.innerHTML = '<span>⏎</span>';
  enterButton.addEventListener('click', () => {
    console.log("Enter button clicked");
    handleEnterKeyAction();
  });
  
  // Add Summarize button (only shown in Advanced Mode)
  const summarizeButton = document.createElement('button');
  summarizeButton.className = 'custom-input-box-summarize';
  summarizeButton.title = 'Summarize Content';
  summarizeButton.innerHTML = '<span>📝</span>';
  summarizeButton.style.display = config.mode === 'advanced' ? 'flex' : 'none';
  summarizeButton.addEventListener('click', () => {
    console.log("Summarize button clicked");
    if (state.activeInput) {
      summarizeContent(state.activeInput);
    } else {
      console.warn("No active input to summarize");
    }
  });
  
  // Add CSS Modification button (only shown in Advanced Mode)
  const cssButton = document.createElement('button');
  cssButton.className = 'custom-input-box-css-button';
  cssButton.title = 'Modify CSS';
  cssButton.innerHTML = '<span>🎨</span>';
  cssButton.style.display = config.mode === 'advanced' ? 'flex' : 'none';
  cssButton.addEventListener('click', () => {
    const description = prompt("Describe how you want to modify the page CSS:", "Move input fields to eye level");
    if (description) {
      applyCssViaLLM(description);
    }
  });
  
  const positionToggle = document.createElement('button');
  positionToggle.className = 'custom-input-box-position-toggle';
  positionToggle.title = 'Change position';
  positionToggle.innerHTML = '<span>⇅</span>';
  positionToggle.addEventListener('click', cyclePosition);
  
  const templateButton = document.createElement('button');
  templateButton.className = 'custom-input-box-template';
  templateButton.title = 'Insert template';
  templateButton.innerHTML = '<span>📋</span>';
  templateButton.addEventListener('click', showTemplateMenu);
  
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.className = 'custom-input-box-close';
  closeButton.title = 'Close';
  closeButton.addEventListener('click', hideCustomInputBox);
  
  // Create a drag handle
  const dragHandle = document.createElement('div');
  dragHandle.className = 'custom-input-box-drag-handle';
  dragHandle.title = 'Drag to reposition';
  dragHandle.innerHTML = '<span>:::</span>';
  
  // Add drag functionality
  if (config.dragEnabled) {
    setupDragging(dragHandle, container);
  }
  
  controls.appendChild(dragHandle);
  controls.appendChild(modeIndicator);
  controls.appendChild(enterButton);
  controls.appendChild(summarizeButton);
  controls.appendChild(cssButton);
  controls.appendChild(positionToggle);
  controls.appendChild(templateButton);
  controls.appendChild(closeButton);
  
  // Create toolbar for rich text operations (hidden by default)
  const toolbar = createRichTextToolbar();
  toolbar.style.display = 'none';
  
  // Assemble the custom input box
  container.appendChild(controls);
  container.appendChild(toolbar);
  container.appendChild(inputContainer);
  
  // Create suggestion area for advanced mode
  const suggestionArea = document.createElement('div');
  suggestionArea.className = 'custom-input-box-suggestions';
  suggestionArea.id = 'custom-input-box-suggestions';
  suggestionArea.style.display = 'none';
  container.appendChild(suggestionArea);
  
  // Add to DOM but keep hidden initially
  document.body.appendChild(container);
  container.style.display = 'none';
  
  // Store reference
  state.customInputBox = container;
  
  // If position is 'custom', apply saved position
  if (config.position === 'custom' && config.customPosition) {
    Object.keys(config.customPosition).forEach(prop => {
      container.style[prop] = config.customPosition[prop];
    });
  }
}

// Create toolbar for rich text editing
function createRichTextToolbar() {
  const toolbar = document.createElement('div');
  toolbar.className = 'custom-input-box-toolbar';
  toolbar.id = 'custom-input-box-toolbar';
  
  // Add formatting buttons
  const buttons = [
    { icon: 'B', title: 'Bold', action: 'bold' },
    { icon: 'I', title: 'Italic', action: 'italic' },
    { icon: 'U', title: 'Underline', action: 'underline' },
    { icon: '¶', title: 'Paragraph', action: 'paragraph' },
    { icon: '•', title: 'Bullet List', action: 'bulletList' },
    { icon: '1.', title: 'Numbered List', action: 'numberedList' },
    { icon: '❮❯', title: 'Code', action: 'code' }
  ];
  
  buttons.forEach(button => {
    const btnElem = document.createElement('button');
    btnElem.textContent = button.icon;
    btnElem.title = button.title;
    btnElem.className = `custom-input-box-toolbar-btn custom-input-box-toolbar-${button.action}`;
    btnElem.dataset.action = button.action;
    btnElem.addEventListener('click', () => handleFormatAction(button.action));
    toolbar.appendChild(btnElem);
  });
  
  return toolbar;
}

// Apply the position class to the container
function applyPositionClass(container) {
  // Remove all position classes first
  container.classList.remove(
    'custom-input-box-position-top',
    'custom-input-box-position-center',
    'custom-input-box-position-floating',
    'custom-input-box-position-custom'
  );
  
  // Apply the appropriate position class
  container.classList.add(`custom-input-box-position-${config.position}`);
}

// Cycle through different positions
function cyclePosition() {
  console.log("Cycling position");
  
  const positions = ['top', 'center', 'floating', 'custom'];
  const currentIndex = positions.indexOf(config.position);
  const nextIndex = (currentIndex + 1) % positions.length;
  config.position = positions[nextIndex];
  
  // Apply the new position
  if (state.customInputBox) {
    applyPositionClass(state.customInputBox);
    
    // Reset custom positioning if not in custom mode
    if (config.position !== 'custom') {
      state.customInputBox.style.top = '';
      state.customInputBox.style.left = '';
      state.customInputBox.style.transform = '';
    } else {
      // Apply custom position
      Object.keys(config.customPosition).forEach(prop => {
        state.customInputBox.style[prop] = config.customPosition[prop];
      });
    }
  }
  
  // Save the new position
  saveConfig();
}

// Save the current configuration
function saveConfig() {
  browser.storage.sync.set({ inputBoxConfig: config }).catch(error => {
    console.error("Error saving configuration:", error);
  });
}

// Set up event listeners
function setupEventListeners() {
  console.log("Setting up event listeners");
  
  // Listen for input field focus
  document.addEventListener('focusin', handleFocusIn);
  
  // Listen for input field blur
  document.addEventListener('focusout', handleFocusOut);
  
  // Listen for key events
  document.addEventListener('keydown', handleKeyDown);
  
  // Listen for messages from background script
  browser.runtime.onMessage.addListener(handleMessages);
  
  // Detect if we need to reposition on window resize
  window.addEventListener('resize', handleResize);
}

// Handle focus on an input element
function handleFocusIn(event) {
  const target = event.target;
  
  // Skip if this is our own input box
  if (target.id === 'custom-input-box' || 
      target.closest('#custom-input-box-container')) {
    return;
  }
  
  // Check if this is an input field we can interact with
  if (isInteractiveInput(target)) {
    console.log("Focus detected on input field:", target.tagName);
    
    // Set as active input
    state.activeInput = target;
    state.originalPlaceholder = target.placeholder || '';
    
    // Modify placeholder to indicate our extension is active
    if (target.placeholder !== undefined) {
      target.placeholder = 'Custom Input Box is active - Type at eye level!';
    }
    
    // Detect if this is a special editor
    state.detectedEditor = config.editorSupport ? 
      EditorDetector.detectEditor(target) : null;
    
    // Show our custom input box
    showCustomInputBox();
    
    // Update our input type to match the active input
    updateCustomInputType();
  }
}

// Check if an element is an interactive input that we can work with
function isInteractiveInput(element) {
  if (!element) return false;
  
  // Get tag name
  const tagName = element.tagName.toLowerCase();
  
  // Basic input types
  if (tagName === 'input') {
    const type = element.type.toLowerCase();
    return ['text', 'email', 'search', 'url', 'tel', 'password', 'number'].includes(type);
  }
  
  // Textarea
  if (tagName === 'textarea') {
    return true;
  }
  
  // Contenteditable elements
  if (element.isContentEditable) {
    return true;
  }
  
  // If editor detection is enabled, check for known editors
  if (config.editorSupport && EditorDetector.isEditor(element)) {
    return true;
  }
  
  return false;
}

// Handle losing focus on an input element
function handleFocusOut(event) {
  // Don't hide if focusing on our own input or within our container
  if (event.relatedTarget && 
      (event.relatedTarget.id === 'custom-input-box' || 
       event.relatedTarget.closest('#custom-input-box-container'))) {
    return;
  }
  
  // Small delay to allow for clicking within our own UI
  setTimeout(() => {
    // Check if focus is still within our custom input box
    if (document.activeElement && 
        (document.activeElement.id === 'custom-input-box' || 
         document.activeElement.closest('#custom-input-box-container'))) {
      return;
    }
    
    // Otherwise, hide our custom input box
    hideCustomInputBox();
    
    // Reset the original placeholder
    if (state.activeInput && state.activeInput.placeholder !== undefined) {
      state.activeInput.placeholder = state.originalPlaceholder;
    }
    
    // Clear the active input
    state.activeInput = null;
    state.detectedEditor = null;
  }, 100);
}

// Update the custom input type to match the active input
function updateCustomInputType() {
  if (!state.activeInput || !state.customInputBox) return;
  
  const customInput = state.customInputBox.querySelector('#custom-input-box');
  if (!customInput) return;
  
  // Remove current input
  customInput.remove();
  
  const inputContainer = state.customInputBox.querySelector('.custom-input-box-input-container');
  if (!inputContainer) return;
  
  // Check if this is a multi-line input
  const isMultiLine = state.activeInput.tagName.toLowerCase() === 'textarea' || 
                      state.activeInput.isContentEditable || 
                      state.detectedEditor;
  
  // Create the appropriate input type
  let newInput;
  
  if (isMultiLine) {
    newInput = document.createElement('div');
    newInput.contentEditable = 'true';
    newInput.className = 'custom-input-box-rich';
    
    // Show the toolbar for rich text
    const toolbar = document.getElementById('custom-input-box-toolbar');
    if (toolbar) {
      toolbar.style.display = 'flex';
    }
  } else {
    newInput = document.createElement('input');
    newInput.type = state.activeInput.type || 'text';
    
    // Hide the toolbar for plain text
    const toolbar = document.getElementById('custom-input-box-toolbar');
    if (toolbar) {
      toolbar.style.display = 'none';
    }
  }
  
  // Set common properties
  newInput.id = 'custom-input-box';
  newInput.placeholder = 'Type here and it will sync with the focused input field';
  
  // Add special class if we detected a specific editor
  if (state.detectedEditor) {
    newInput.classList.add(`custom-input-box-editor-${state.detectedEditor}`);
  }
  
  // Add event listeners
  newInput.addEventListener('input', handleCustomInput);
  newInput.addEventListener('keydown', handleCustomKeyDown);
  
  // Add to the container
  inputContainer.appendChild(newInput);
  
  // Focus on the new input
  setTimeout(() => {
    newInput.focus();
  }, 0);
}

// Handle input in our custom input box
function handleCustomInput(event) {
  if (!state.activeInput) return;
  
  const customInput = event.target;
  const value = customInput.tagName.toLowerCase() === 'input' ? 
    customInput.value : customInput.innerHTML;
  
  // Sync with the active input
  if (state.activeInput.isContentEditable) {
    state.activeInput.innerHTML = value;
  } else if (state.activeInput.tagName.toLowerCase() === 'textarea') {
    state.activeInput.value = customInput.tagName.toLowerCase() === 'input' ? 
      value : stripHtml(value);
  } else {
    state.activeInput.value = customInput.tagName.toLowerCase() === 'input' ? 
      value : stripHtml(value);
  }
  
  // Dispatch input event on the active input
  const inputEvent = new Event('input', { bubbles: true });
  state.activeInput.dispatchEvent(inputEvent);
  
  // In advanced mode, generate suggestions
  if (config.mode === 'advanced') {
    generateSuggestions(value);
  }
}

// Strip HTML tags from a string
function stripHtml(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
}

// Handle key events in our custom input box
function handleCustomKeyDown(event) {
  // Handle special keys
  if (event.key === 'Escape') {
    hideCustomInputBox();
    return;
  }
  
  // Handle tab key to move focus back to the original input
  if (event.key === 'Tab' && !event.shiftKey) {
    if (state.activeInput) {
      event.preventDefault();
      state.activeInput.focus();
    }
  }
}

// Handle window resize
function handleResize() {
  // If we're showing the custom input box, make sure it's properly positioned
  if (state.isCustomInputVisible && state.customInputBox) {
    applyPositionClass(state.customInputBox);
  }
}

// Show the custom input box
function showCustomInputBox() {
  if (!state.customInputBox) return;
  
  // Reset suggestion area
  const suggestionArea = document.getElementById('custom-input-box-suggestions');
  if (suggestionArea) {
    suggestionArea.innerHTML = '';
    suggestionArea.style.display = config.mode === 'advanced' ? 'block' : 'none';
  }
  
  // Show the custom input box
  state.customInputBox.style.display = 'flex';
  state.isCustomInputVisible = true;
  
  // Update mode indicator
  const modeIndicator = document.getElementById('custom-input-box-mode');
  if (modeIndicator) {
    modeIndicator.textContent = config.mode === 'habit' ? 'Habit Mode' : 'Advanced Mode';
    
    // Add advanced mode indicator badge if in advanced mode
    const existingBadge = modeIndicator.querySelector('.advanced-mode-badge');
    if (config.mode === 'advanced') {
      if (!existingBadge) {
        const advancedBadge = document.createElement('span');
        advancedBadge.className = 'advanced-mode-badge';
        advancedBadge.textContent = '✨';
        advancedBadge.title = 'Advanced features enabled';
        modeIndicator.appendChild(advancedBadge);
      }
    } else {
      // Remove badge if in habit mode
      if (existingBadge) {
        existingBadge.remove();
      }
    }
  }
  
  // Update advanced mode buttons visibility
  const summarizeButton = document.querySelector('.custom-input-box-summarize');
  if (summarizeButton) {
    summarizeButton.style.display = config.mode === 'advanced' ? 'flex' : 'none';
  }
  
  const cssButton = document.querySelector('.custom-input-box-css-button');
  if (cssButton) {
    cssButton.style.display = config.mode === 'advanced' ? 'flex' : 'none';
  }
  
  // If in advanced mode, apply CSS modifications and summarize content if enabled
  if (config.mode === 'advanced') {
    if (config.cssModification) {
      applyCssModifications();
    }
    
    if (config.summarizeContent && state.activeInput) {
      const content = state.activeInput.value || state.activeInput.innerHTML || '';
      if (content.length > 200) {
        summarizeContent(state.activeInput);
      }
    }
  }
  
  // Apply animation based on position
  if (config.position === 'top') {
    state.customInputBox.style.animation = 'slide-down 0.3s ease forwards';
  } else if (config.position === 'center') {
    state.customInputBox.style.animation = 'fade-in 0.3s ease forwards';
  } else if (config.position === 'floating') {
    state.customInputBox.style.animation = 'float-in 0.3s ease forwards';
  }
}

// Hide the custom input box
function hideCustomInputBox() {
  if (!state.customInputBox || !state.isCustomInputVisible) return;
  
  // Apply exit animation based on position
  if (config.position === 'top') {
    state.customInputBox.style.animation = 'slide-up 0.3s ease forwards';
  } else if (config.position === 'center') {
    state.customInputBox.style.animation = 'fade-out 0.3s ease forwards';
  } else if (config.position === 'floating') {
    state.customInputBox.style.animation = 'float-out 0.3s ease forwards';
  }
  
  // Hide after animation completes
  setTimeout(() => {
    state.customInputBox.style.display = 'none';
    state.isCustomInputVisible = false;
  }, 300);
}

// Set up dragging functionality
function setupDragging(handle, container) {
  handle.addEventListener('mousedown', (e) => {
    if (!config.dragEnabled) return;
    
    e.preventDefault();
    state.isDragging = true;
    
    // Calculate the initial offset
    const rect = container.getBoundingClientRect();
    state.dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    // Add move and up event listeners
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  });
}

// Handle dragging movement
function handleDragMove(e) {
  if (!state.isDragging || !state.customInputBox) return;
  
  // Calculate new position
  const newLeft = e.clientX - state.dragOffset.x;
  const newTop = e.clientY - state.dragOffset.y;
  
  // Apply new position
  state.customInputBox.style.left = `${newLeft}px`;
  state.customInputBox.style.top = `${newTop}px`;
  state.customInputBox.style.transform = 'none'; // Remove any transform
  
  // Update to custom position mode
  config.position = 'custom';
  applyPositionClass(state.customInputBox);
  
  // Save the custom position
  config.customPosition = {
    top: `${newTop}px`,
    left: `${newLeft}px`,
    transform: 'none'
  };
}

// Handle the end of dragging
function handleDragEnd() {
  state.isDragging = false;
  
  // Save the position
  saveConfig();
  
  // Remove event listeners
  document.removeEventListener('mousemove', handleDragMove);
  document.removeEventListener('mouseup', handleDragEnd);
}

// Handle key events on the page
function handleKeyDown(event) {
  // Check for template keyboard shortcuts (Alt+1, Alt+2, etc.)
  if (event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey) {
    const num = parseInt(event.key);
    if (!isNaN(num) && num >= 1 && num <= 9) {
      // Templates are 0-indexed in the array, but 1-indexed for shortcuts
      const templateIndex = num - 1;
      insertTemplate(templateIndex);
    }
  }
}

// Show the template menu
function showTemplateMenu(event) {
  // Remove any existing menu
  const existingMenu = document.querySelector('.custom-input-box-template-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  // Create menu
  const menu = document.createElement('div');
  menu.className = 'custom-input-box-template-menu';
  
  // Get templates
  const templates = state.activeTemplates || [];
  
  // Add templates to menu
  if (templates.length > 0) {
    templates.forEach((template, index) => {
      const item = document.createElement('div');
      item.className = 'custom-input-box-template-item';
      item.textContent = template.name;
      item.title = `Alt+${index + 1}`;
      item.addEventListener('click', () => {
        insertTemplate(index);
        menu.remove();
      });
      menu.appendChild(item);
    });
  } else {
    // No templates message
    const item = document.createElement('div');
    item.className = 'custom-input-box-template-item';
    item.textContent = 'No templates available';
    item.style.fontStyle = 'italic';
    menu.appendChild(item);
  }
  
  // Add close option
  const closeItem = document.createElement('div');
  closeItem.className = 'custom-input-box-template-item custom-input-box-template-close';
  closeItem.textContent = 'Close';
  closeItem.addEventListener('click', () => {
    menu.remove();
  });
  menu.appendChild(closeItem);
  
  // Position the menu near the button
  const buttonRect = event.target.closest('button').getBoundingClientRect();
  menu.style.top = `${buttonRect.bottom + 5}px`;
  menu.style.left = `${buttonRect.left}px`;
  
  // Add to DOM
  document.body.appendChild(menu);
  
  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== event.target) {
      menu.remove();
    }
  }, { once: true });
}

// Insert a template at the cursor position
function insertTemplate(index) {
  const templates = state.activeTemplates || [];
  
  if (!templates[index]) {
    console.warn(`Template at index ${index} not found`);
    return;
  }
  
  const template = templates[index];
  console.log(`Inserting template: ${template.name}`);
  
  // Get our custom input
  const customInput = document.getElementById('custom-input-box');
  if (!customInput) return;
  
  // Insert the template
  if (customInput.tagName.toLowerCase() === 'input') {
    // For plain text inputs
    const currentValue = customInput.value;
    const selStart = customInput.selectionStart;
    const selEnd = customInput.selectionEnd;
    
    // Insert at cursor position
    customInput.value = currentValue.substring(0, selStart) + 
                        template.content + 
                        currentValue.substring(selEnd);
    
    // Set cursor position after the inserted template
    customInput.selectionStart = customInput.selectionEnd = 
      selStart + template.content.length;
  } else {
    // For rich text inputs
    document.execCommand('insertHTML', false, template.content);
  }
  
  // Trigger input event to sync with the active input
  const inputEvent = new Event('input', { bubbles: true });
  customInput.dispatchEvent(inputEvent);
}

// Handle formatting actions from the toolbar
function handleFormatAction(action) {
  const customInput = document.getElementById('custom-input-box');
  if (!customInput || customInput.tagName.toLowerCase() === 'input') return;
  
  // Apply formatting using execCommand
  switch (action) {
    case 'bold':
      document.execCommand('bold', false);
      break;
    case 'italic':
      document.execCommand('italic', false);
      break;
    case 'underline':
      document.execCommand('underline', false);
      break;
    case 'paragraph':
      document.execCommand('formatBlock', false, '<p>');
      break;
    case 'bulletList':
      document.execCommand('insertUnorderedList', false);
      break;
    case 'numberedList':
      document.execCommand('insertOrderedList', false);
      break;
    case 'code':
      document.execCommand('formatBlock', false, '<pre>');
      break;
  }
  
  // Trigger input event to sync with the active input
  const inputEvent = new Event('input', { bubbles: true });
  customInput.dispatchEvent(inputEvent);
}

// Generate suggestions based on user input (Advanced Mode)
function generateSuggestions(text) {
  if (!config.mode === 'advanced' || !text || text.length < 5) return;
  
  // Throttle suggestions to avoid too many API calls
  if (state.suggestionTimeout) {
    clearTimeout(state.suggestionTimeout);
  }
  
  state.suggestionTimeout = setTimeout(() => {
    // Get the suggestion area
    const suggestionArea = document.getElementById('custom-input-box-suggestions');
    if (!suggestionArea) return;
    
    // Set a pending state in the suggestion area
    suggestionArea.innerHTML = '<div class="suggestion-loading">Generating suggestions...</div>';
    
    console.log("Generating suggestions for text:", text.substring(0, 30) + "...");
    
    // Request suggestions from the background script
    browser.runtime.sendMessage({
      action: 'generateLLMSuggestion',
      prompt: text,
      model: config.llmModel
    }).then(response => {
      if (response && response.suggestion) {
        displaySuggestions(response.suggestion);
      } else {
        console.warn("No suggestions received");
        suggestionArea.innerHTML = '';
      }
    }).catch(error => {
      console.error('Error generating suggestions:', error);
      suggestionArea.innerHTML = '';
    });
  }, 500); // Wait 500ms after typing stops
}

// Display suggestions in the UI
function displaySuggestions(suggestionText) {
  const suggestionArea = document.getElementById('custom-input-box-suggestions');
  if (!suggestionArea) return;
  
  // Clear previous suggestions
  suggestionArea.innerHTML = '';
  
  // Create the header
  const header = document.createElement('div');
  header.className = 'custom-input-box-suggestions-header';
  header.textContent = 'Suggestions:';
  suggestionArea.appendChild(header);
  
  // Process the suggestion text
  let suggestions = [];
  
  // Try to extract bullet points
  if (suggestionText.includes('•')) {
    suggestions = suggestionText.split('•').map(s => s.trim()).filter(s => s);
  } else if (suggestionText.includes('-')) {
    suggestions = suggestionText.split('-').map(s => s.trim()).filter(s => s);
  } else if (suggestionText.includes('\n')) {
    suggestions = suggestionText.split('\n').map(s => s.trim()).filter(s => s);
  } else {
    // Just use the whole text as one suggestion
    suggestions = [suggestionText];
  }
  
  // Limit to 3 suggestions
  suggestions = suggestions.slice(0, 3);
  
  // Create the list
  const list = document.createElement('ul');
  list.className = 'custom-input-box-suggestions-list';
  
  // Add each suggestion
  suggestions.forEach(suggestion => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'custom-input-box-suggestion-item';
    button.textContent = suggestion;
    button.addEventListener('click', () => {
      // Get our custom input
      const customInput = document.getElementById('custom-input-box');
      if (!customInput) return;
      
      // Insert the suggestion at the end
      if (customInput.tagName.toLowerCase() === 'input') {
        customInput.value += ' ' + suggestion;
      } else {
        customInput.focus();
        document.execCommand('insertText', false, ' ' + suggestion);
      }
      
      // Trigger input event to sync with the active input
      const inputEvent = new Event('input', { bubbles: true });
      customInput.dispatchEvent(inputEvent);
    });
    
    item.appendChild(button);
    list.appendChild(item);
  });
  
  suggestionArea.appendChild(list);
  suggestionArea.style.display = 'block';
}

// Apply CSS via LLM
function applyCssViaLLM(description) {
  // Show a loading indicator
  const indicator = document.createElement('div');
  indicator.className = 'css-loading-indicator';
  indicator.textContent = 'Generating CSS rules...';
  indicator.style.position = 'fixed';
  indicator.style.top = '10px';
  indicator.style.right = '10px';
  indicator.style.background = 'rgba(74, 144, 226, 0.9)';
  indicator.style.color = 'white';
  indicator.style.padding = '8px 12px';
  indicator.style.borderRadius = '4px';
  indicator.style.zIndex = '9999';
  document.body.appendChild(indicator);
  
  console.log("Requesting CSS rules for description:", description);
  
  // Request CSS rules from the background script
  browser.runtime.sendMessage({
    action: 'generateCssRules',
    prompt: description,
    model: config.llmModel
  }).then(response => {
    // Remove the loading indicator
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
    
    if (response && response.rules && Array.isArray(response.rules)) {
      console.log("Received CSS rules:", response.rules.length);
      
      // Save the rules
      state.cssRules = response.rules;
      
      // Apply the rules
      CssModifier.applyRules(response.rules);
      
      // Save to storage
      browser.storage.sync.set({ cssRules: response.rules });
    } else {
      console.warn("No valid CSS rules received");
    }
  }).catch(error => {
    console.error('Error generating CSS rules:', error);
    
    // Remove the loading indicator
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  });
}

// Handle Enter key action
function handleEnterKeyAction() {
  if (!state.activeInput) {
    console.warn("No active input found");
    return;
  }
  
  console.log("Simulating Enter key press");
  
  try {
    // Ensure any pending input is synchronized first
    const customInput = document.getElementById('custom-input-box');
    if (customInput) {
      // Trigger one last input event to ensure synchronization
      const inputEvent = new Event('input', { bubbles: true });
      customInput.dispatchEvent(inputEvent);
    }
    
    // Create and dispatch an Enter key event on the original input
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    
    // Dispatch the event on the original input
    state.activeInput.dispatchEvent(enterEvent);
    
    // If the input is in a form, try to submit the form
    const form = state.activeInput.closest('form');
    if (form) {
      // Check if the form has a submit button
      const submitButton = form.querySelector('input[type="submit"], button[type="submit"]');
      if (submitButton) {
        submitButton.click();
      } else {
        // Try to submit the form directly
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    }
    
    console.log("Enter key action completed");
  } catch (error) {
    console.error("Error executing Enter key action:", error);
  }
}

// Summarize content (Advanced Mode)
function summarizeContent(inputElement) {
  console.log("Summarizing content...");
  
  // Get the content to summarize
  let content = '';
  
  // Extract content from different types of inputs
  if (inputElement.value !== undefined) {
    content = inputElement.value;
  } else if (inputElement.innerHTML !== undefined) {
    content = inputElement.innerHTML;
  } else if (inputElement.textContent !== undefined) {
    content = inputElement.textContent;
  }
  
  // If the element is a form or container, try to find all text inputs
  if (content.trim() === '' && (inputElement.tagName === 'FORM' || inputElement.children.length > 0)) {
    const textInputs = inputElement.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]');
    const contentParts = [];
    
    textInputs.forEach(input => {
      if (input.value) {
        contentParts.push(input.value);
      } else if (input.innerHTML) {
        contentParts.push(stripHtml(input.innerHTML));
      } else if (input.textContent) {
        contentParts.push(input.textContent);
      }
    });
    
    content = contentParts.join('\n\n');
  }
  
  // Try to find content in parent containers if still empty
  if (content.trim() === '') {
    let parent = inputElement.parentElement;
    let depth = 0;
    
    while (parent && depth < 3 && content.trim() === '') {
      if (parent.textContent && parent.textContent.trim().length > 0) {
        content = parent.textContent;
        break;
      }
      parent = parent.parentElement;
      depth++;
    }
  }
  
  // Sanitize the content
  content = stripHtml(content);
  
  // Only proceed if we have enough content
  if (content.trim().length < 50) {
    console.log("Content too short to summarize:", content.length);
    alert("The content is too short to summarize. Please enter more text (at least 50 characters).");
    return;
  }
  
  // Show a loading indicator
  showSummarizationLoading();
  
  console.log("Sending summarization request for content length:", content.length);
  
  // Send to background script for summarization
  browser.runtime.sendMessage({
    action: 'summarizeContent',
    prompt: content,
    model: config.llmModel
  }).then(response => {
    hideSummarizationLoading();
    
    if (response && response.summary) {
      console.log("Received summary, displaying it");
      // Display the summary
      displaySummary(response.summary);
    } else {
      console.warn("No summary received from background script");
      alert("Could not generate a summary. Please try again.");
    }
  }).catch(error => {
    hideSummarizationLoading();
    console.error('Error summarizing content:', error);
    // Display a generic summary as fallback
    displaySummary("This appears to be a long text. Consider breaking it into smaller sections for better readability.");
  });
}

// Show loading indicator for summarization
function showSummarizationLoading() {
  // Check if we already have a loading indicator
  let loadingIndicator = document.getElementById('custom-input-box-loading');
  
  if (!loadingIndicator) {
    loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'custom-input-box-loading';
    loadingIndicator.className = 'custom-input-box-loading';
    loadingIndicator.innerHTML = '<div class="spinner"></div><span>Summarizing content...</span>';
    
    // Add to the custom input box
    state.customInputBox.appendChild(loadingIndicator);
  }
  
  loadingIndicator.style.display = 'flex';
}

// Hide loading indicator for summarization
function hideSummarizationLoading() {
  const loadingIndicator = document.getElementById('custom-input-box-loading');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'none';
  }
}

// Display summary in the UI
function displaySummary(summary) {
  console.log("Displaying summary:", summary.substring(0, 50) + "...");
  
  // If we already have a summary, update it
  let summaryElem = document.getElementById('custom-input-box-summary');
  
  if (!summaryElem) {
    // Create a new summary element
    summaryElem = document.createElement('div');
    summaryElem.id = 'custom-input-box-summary';
    summaryElem.className = 'custom-input-box-summary';
    
    // Add title
    const title = document.createElement('div');
    title.className = 'custom-input-box-summary-title';
    title.innerHTML = '<span>📝</span> Content Summary:';
    summaryElem.appendChild(title);
    
    // Add content
    const content = document.createElement('div');
    content.className = 'custom-input-box-summary-content';
    summaryElem.appendChild(content);
    
    // Add actions
    const actions = document.createElement('div');
    actions.className = 'custom-input-box-summary-actions';
    
    // Add copy button
    const copyButton = document.createElement('button');
    copyButton.className = 'custom-input-box-summary-copy';
    copyButton.innerHTML = '<span>📋</span> Copy';
    copyButton.title = 'Copy summary to clipboard';
    copyButton.addEventListener('click', () => {
      try {
        navigator.clipboard.writeText(summary).then(() => {
          copyButton.innerHTML = '<span>✓</span> Copied!';
          setTimeout(() => {
            copyButton.innerHTML = '<span>📋</span> Copy';
          }, 2000);
        });
      } catch (error) {
        console.error("Copy failed:", error);
        alert("Failed to copy to clipboard");
      }
    });
    
    // Add close button
    const close = document.createElement('button');
    close.className = 'custom-input-box-summary-close';
    close.textContent = '×';
    close.title = 'Close summary';
    close.addEventListener('click', () => {
      console.log("Closing summary");
      summaryElem.style.display = 'none';
    });
    
    actions.appendChild(copyButton);
    actions.appendChild(close);
    summaryElem.appendChild(actions);
    
    // Add to the custom input box before the input container
    const inputContainer = state.customInputBox.querySelector('.custom-input-box-input-container');
    if (inputContainer) {
      state.customInputBox.insertBefore(summaryElem, inputContainer);
    } else {
      // Fallback - append to the end
      state.customInputBox.appendChild(summaryElem);
    }
  }
  
  // Update the summary content
  const content = summaryElem.querySelector('.custom-input-box-summary-content');
  if (content) {
    content.textContent = summary;
  }
  
  // Show the summary with fade-in animation
  summaryElem.style.display = 'block';
  summaryElem.style.opacity = '0';
  summaryElem.style.animation = 'fade-in 0.3s ease forwards';
}

// Handle messages from background script
function handleMessages(message) {
  console.log("Message received:", message.action);
  
  // Handle extension toggle
  if (message.action === 'toggleExtension') {
    config.enabled = !config.enabled;
    
    if (!config.enabled && state.customInputBox) {
      hideCustomInputBox();
      
      // Reset the original placeholder if we have an active input
      if (state.activeInput && state.activeInput.placeholder !== undefined) {
        state.activeInput.placeholder = state.originalPlaceholder;
      }
    }
    
    return Promise.resolve({ success: true });
  }
  
  // Handle mode toggle
  if (message.action === 'toggleMode') {
    config.mode = config.mode === 'habit' ? 'advanced' : 'habit';
    const modeIndicator = document.getElementById('custom-input-box-mode');
    if (modeIndicator) {
      modeIndicator.textContent = config.mode === 'habit' ? 'Habit Mode' : 'Advanced Mode';
      
      // Update badge
      const existingBadge = modeIndicator.querySelector('.advanced-mode-badge');
      if (config.mode === 'advanced') {
        if (!existingBadge) {
          const advancedBadge = document.createElement('span');
          advancedBadge.className = 'advanced-mode-badge';
          advancedBadge.textContent = '✨';
          advancedBadge.title = 'Advanced features enabled';
          modeIndicator.appendChild(advancedBadge);
        }
      } else if (existingBadge) {
        existingBadge.remove();
      }
    }
    
    // Update suggestion area visibility
    const suggestionArea = document.getElementById('custom-input-box-suggestions');
    if (suggestionArea) {
      suggestionArea.style.display = config.mode === 'advanced' ? 'block' : 'none';
    }
    
    // Toggle advanced feature buttons visibility
    const summarizeButton = document.querySelector('.custom-input-box-summarize');
    if (summarizeButton) {
      summarizeButton.style.display = config.mode === 'advanced' ? 'flex' : 'none';
    }
    
    const cssButton = document.querySelector('.custom-input-box-css-button');
    if (cssButton) {
      cssButton.style.display = config.mode === 'advanced' ? 'flex' : 'none';
    }
    
    // If switching to advanced mode, enable advanced features
    if (config.mode === 'advanced') {
      // Apply CSS modifications if enabled
      if (config.cssModification && state.cssRules.length > 0) {
        console.log("Applying CSS rules in Advanced Mode");
        CssModifier.applyRules(state.cssRules);
      }
      
      // If content summarization is enabled and we have an active input with substantial content
      if (config.summarizeContent && state.activeInput) {
        const content = state.activeInput.value || state.activeInput.innerHTML || '';
        if (content.length > 200) {
          console.log("Summarizing content in Advanced Mode");
          summarizeContent(state.activeInput);
        }
      }
    }
    
    // Save the updated config
    saveConfig();
    
    return Promise.resolve({ success: true });
  }
  
  // Handle config update
  if (message.action === 'updateConfig') {
    config = { ...config, ...message.config };
    
    // Apply changes immediately
    if (state.customInputBox) {
      // Update theme
      state.customInputBox.className = `custom-input-box-theme-${config.theme}`;
      
      // Update position
      applyPositionClass(state.customInputBox);
      
      // Apply custom position if needed
      if (config.position === 'custom' && config.customPosition) {
        Object.keys(config.customPosition).forEach(prop => {
          state.customInputBox.style[prop] = config.customPosition[prop];
        });
      }
      
      // Apply CSS modifications if in advanced mode and enabled
      if (config.mode === 'advanced' && config.cssModification) {
        applyCssModifications();
      } else if (!config.cssModification) {
        CssModifier.removeAllRules();
      }
    }
    
    return Promise.resolve({ success: true });
  }
  
  // Handle template update
  if (message.action === 'updateTemplates') {
    state.activeTemplates = message.templates;
    return Promise.resolve({ success: true });
  }
  
  // Handle CSS rules update
  if (message.action === 'updateCssRules') {
    state.cssRules = message.cssRules;
    
    // Apply the rules if CSS modification is enabled and in advanced mode
    if (config.cssModification && config.mode === 'advanced') {
      applyCssModifications();
    }
    
    return Promise.resolve({ success: true });
  }
  
  // Handle template insertion
  if (message.action === 'insertTemplate') {
    if (state.customInputBox && state.activeInput) {
      // Get our custom input
      const customInput = document.getElementById('custom-input-box');
      if (!customInput) return Promise.resolve({ success: false });
      
      // Insert the template
      if (customInput.tagName.toLowerCase() === 'input') {
        // For plain text inputs
        const currentValue = customInput.value;
        const selStart = customInput.selectionStart;
        const selEnd = customInput.selectionEnd;
        
        // Insert at cursor position
        customInput.value = currentValue.substring(0, selStart) + 
                          message.content + 
                          currentValue.substring(selEnd);
        
        // Set cursor position after the inserted template
        customInput.selectionStart = customInput.selectionEnd = 
          selStart + message.content.length;
      } else {
        // For rich text inputs
        document.execCommand('insertHTML', false, message.content);
      }
      
      // Trigger input event to sync with the active input
      const inputEvent = new Event('input', { bubbles: true });
      customInput.dispatchEvent(inputEvent);
      
      return Promise.resolve({ success: true });
    }
    
    return Promise.resolve({ success: false });
  }
  
  // Handle theme update
  if (message.action === 'updateTheme') {
    config.theme = message.theme;
    
    if (state.customInputBox) {
      // Update theme class
      state.customInputBox.className = `custom-input-box-position-${config.position} custom-input-box-theme-${config.theme}`;
    }
    
    return Promise.resolve({ success: true });
  }
  
  return Promise.resolve({ success: false, error: 'Unknown action' });
}

// Start initialization process
initialize();