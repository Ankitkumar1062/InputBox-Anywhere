/**
 * Habit Mode implementation for Custom Input Box Everywhere
 * Last updated: 2025-06-18 12:47:57
 * Author: Ankitkumar1062
 */

// Show the habit mode input box
function showHabitModeInput(target) {
  if (state.isVisible) {
    hideInputBox();
  }
  
  // Get original input position
  const targetPos = getElementPosition(target);
  
  // Create container for the custom input box
  const container = createHabitModeContainer();
  
  // Create the input element (textarea)
  const inputElement = createHabitModeInput(target);
  
  // Create formatting toolbar
  const toolbar = createFormattingToolbar(inputElement);
  
  // Create footer with instructions
  const footer = createFooter();
  
  // Add elements to container
  container.appendChild(toolbar);
  container.appendChild(inputElement);
  container.appendChild(footer);
  
  // Add the container to the document
  document.body.appendChild(container);
  
  // Set global state
  state.inputBox = container;
  state.isVisible = true;
  
  // Position based on setting
  positionInputBox(container, targetPos);
  
  // Focus the input element
  setTimeout(() => {
    inputElement.focus();
    
    // Set the same selection if any
    if (target.selectionStart !== undefined && target.selectionEnd !== undefined) {
      inputElement.selectionStart = target.selectionStart;
      inputElement.selectionEnd = target.selectionEnd;
    }
    
    // Make container fully visible
    container.classList.add('cib-visible');
  }, 50);
}

// Create habit mode container
function createHabitModeContainer() {
  // Load settings
  const opacity = browser.storage.local.get('settings').then(result => result.settings?.opacity || 0.9);
  const fontSize = browser.storage.local.get('settings').then(result => result.settings?.fontSize || 16);
  const theme = browser.storage.local.get('settings').then(result => result.settings?.theme || 'light');
  
  // Create container
  const container = createElement('div', {
    classList: ['custom-input-box-container', 'habit-mode', `theme-${theme || 'light'}`],
    style: {
      opacity: opacity || 0.9,
      fontSize: `${fontSize || 16}px`,
      width: state.position === 'float' ? state.lastDimensions.width : '80%',
      height: state.position === 'float' ? state.lastDimensions.height : 'auto'
    }
  });
  
  if (state.position === 'float') {
    Object.assign(container.style, {
      position: 'fixed',
      top: state.lastPosition.top,
      left: state.lastPosition.left,
      zIndex: '9999',
      resize: 'both',
      overflow: 'hidden'
    });
    
    // Make draggable
    makeDraggable(container);
  }
  
  return container;
}

// Create habit mode input element
function createHabitModeInput(target) {
  const inputValue = target.value || target.textContent || '';
  
  const inputElement = createElement('textarea', {
    classList: ['custom-input-box'],
    value: inputValue,
    style: {
      width: '100%',
      height: state.position === 'float' ? 'calc(100% - 80px)' : '180px',
      resize: 'none',
      padding: '12px',
      fontSize: 'inherit',
      borderRadius: '0',
      border: 'none',
      outline: 'none',
      boxSizing: 'border-box',
      backgroundColor: 'inherit',
      color: 'inherit'
    },
    onkeyup: (e) => syncInputWithOriginal(e, target)
  });
  
  return inputElement;
}

// Sync the custom input with the original input
function syncInputWithOriginal(event, target) {
  if (state.isSyncing) return;
  state.isSyncing = true;
  
  try {
    // Update the original input
    if (target.isContentEditable) {
      target.textContent = event.target.value;
      
      // Dispatch input event
      const inputEvent = new Event('input', { bubbles: true });
      target.dispatchEvent(inputEvent);
      
      // Dispatch change event
      const changeEvent = new Event('change', { bubbles: true });
      target.dispatchEvent(changeEvent);
    } else {
      target.value = event.target.value;
      
      // Dispatch input event
      const inputEvent = new Event('input', { bubbles: true });
      target.dispatchEvent(inputEvent);
      
      // Dispatch change event
      const changeEvent = new Event('change', { bubbles: true });
      target.dispatchEvent(changeEvent);
    }
  } catch (error) {
    console.error('Error syncing input:', error);
  } finally {
    state.isSyncing = false;
  }
}

// Create formatting toolbar
function createFormattingToolbar(inputElement) {
  const toolbar = createElement('div', {
    classList: ['formatting-toolbar'],
    style: {
      display: 'flex',
      gap: '8px',
      padding: '8px 12px',
      borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
    }
  });
  
  // Bold button
  toolbar.appendChild(createToolbarButton('B', 'Bold', () => {
    insertFormattingTag(inputElement, '**', '**');
  }));
  
  // Italic button
  toolbar.appendChild(createToolbarButton('I', 'Italic', () => {
    insertFormattingTag(inputElement, '_', '_');
  }));
  
  // Add list item button
  toolbar.appendChild(createToolbarButton('•', 'List item', () => {
    insertAtCursor(inputElement, '\n- ');
  }));
  
  // Add numbered list item button
  toolbar.appendChild(createToolbarButton('1.', 'Numbered item', () => {
    insertAtCursor(inputElement, '\n1. ');
  }));
  
  // Clear button
  const clearButton = createToolbarButton('Clear', 'Clear text', () => {
    inputElement.value = '';
    syncInputWithOriginal({ target: inputElement }, state.activeElement);
  });
  clearButton.style.marginLeft = 'auto';
  toolbar.appendChild(clearButton);
  
  return toolbar;
}

// Create a toolbar button
function createToolbarButton(text, tooltip, onClick) {
  return createElement('button', {
    classList: ['toolbar-btn'],
    title: tooltip,
    style: {
      padding: '4px 8px',
      background: 'transparent',
      border: '1px solid rgba(0, 0, 0, 0.2)',
      borderRadius: '4px',
      cursor: 'pointer',
      fontWeight: text === 'B' ? 'bold' : 'normal',
      fontStyle: text === 'I' ? 'italic' : 'normal'
    },
    onclick: onClick
  }, [text]);
}

// Insert formatting tags around selected text or at cursor
function insertFormattingTag(inputElement, startTag, endTag) {
  const start = inputElement.selectionStart;
  const end = inputElement.selectionEnd;
  const selectedText = inputElement.value.substring(start, end);
  const replacement = startTag + selectedText + endTag;
  
  inputElement.value = inputElement.value.substring(0, start) + replacement + inputElement.value.substring(end);
  
  // Adjust the selection after the insertion
  inputElement.selectionStart = start + startTag.length;
  inputElement.selectionEnd = start + startTag.length + selectedText.length;
  
  // Trigger the sync with the original input
  syncInputWithOriginal({ target: inputElement }, state.activeElement);
  
  // Keep focus on the input element
  inputElement.focus();
}

// Insert text at cursor position
function insertAtCursor(inputElement, text) {
  const start = inputElement.selectionStart;
  
  inputElement.value = inputElement.value.substring(0, start) + text + inputElement.value.substring(start);
  
  // Adjust the selection after the insertion
  inputElement.selectionStart = inputElement.selectionEnd = start + text.length;
  
  // Trigger the sync with the original input
  syncInputWithOriginal({ target: inputElement }, state.activeElement);
  
  // Keep focus on the input element
  inputElement.focus();
}

// Create footer with keyboard shortcuts
function createFooter() {
  return createElement('div', {
    classList: ['input-box-footer'],
    style: {
      padding: '6px 12px',
      fontSize: '12px',
      color: 'rgba(0, 0, 0, 0.6)',
      borderTop: '1px solid rgba(0, 0, 0, 0.1)',
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, [
    createElement('span', {}, ['Ctrl+Shift+Q to close']),
    createElement('span', {}, [`Mode: ${state.mode}`])
  ]);
}

// Position the input box based on the setting
function positionInputBox(container, targetPos) {
  if (state.position === 'top') {
    Object.assign(container.style, {
      position: 'fixed',
      top: '0',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '9999',
      borderTop: 'none'
    });
  } else if (state.position === 'center') {
    Object.assign(container.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: '9999'
    });
  }
  // For 'float' position, the styles are already set in createHabitModeContainer
}

// Make an element draggable
function makeDraggable(element) {
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  
  // Create drag handle
  const dragHandle = createElement('div', {
    classList: ['drag-handle'],
    style: {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '28px',
      cursor: 'move',
      backgroundColor: 'rgba(0, 0, 0, 0.05)'
    }
  });
  
  // Add drag handle to element
  element.appendChild(dragHandle);
  
  // Mouse down event
  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseInt(element.style.left) || 0;
    startTop = parseInt(element.style.top) || 0;
    
    e.preventDefault();
  });
  
  // Mouse move event
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    element.style.left = `${startLeft + deltaX}px`;
    element.style.top = `${startTop + deltaY}px`;
    
    e.preventDefault();
  });
  
  // Mouse up event
  document.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    
    isDragging = false;
    
    // Save the position
    savePosition();
    
    e.preventDefault();
  });
  
  // Handle resize end
  let resizeObserver = new ResizeObserver(() => {
    // Save the dimensions
    saveDimensions();
  });
  
  resizeObserver.observe(element);
}