/**
 * Advanced Mode implementation for Custom Input Box Everywhere
 * Last updated: 2025-06-18 12:54:03
 * Author: Ankitkumar1062
 */

// Show the advanced mode input box
function showAdvancedModeInput(target) {
  if (state.isVisible) {
    hideInputBox();
  }
  
  // Get original input position
  const targetPos = getElementPosition(target);
  
  // Create container for the custom input box
  const container = createAdvancedModeContainer();
  
  // Create the input element (textarea)
  const inputElement = createAdvancedModeInput(target);
  
  // Create advanced toolbar with Groq AI functions
  const toolbar = createAdvancedToolbar(inputElement, target);
  
  // Create footer with instructions
  const footer = createAdvancedFooter();
  
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

// Create advanced mode container
function createAdvancedModeContainer() {
  // Load settings
  const opacity = browser.storage.local.get('settings').then(result => result.settings?.opacity || 0.9);
  const fontSize = browser.storage.local.get('settings').then(result => result.settings?.fontSize || 16);
  const theme = browser.storage.local.get('settings').then(result => result.settings?.theme || 'light');
  
  // Create container
  const container = createElement('div', {
    classList: ['custom-input-box-container', 'advanced-mode', `theme-${theme || 'light'}`],
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

// Create advanced mode input element
function createAdvancedModeInput(target) {
  const inputValue = target.value || target.textContent || '';
  
  const inputElement = createElement('textarea', {
    classList: ['custom-input-box'],
    value: inputValue,
    style: {
      width: '100%',
      height: state.position === 'float' ? 'calc(100% - 120px)' : '180px',
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

// Create advanced toolbar with Groq AI functions
function createAdvancedToolbar(inputElement, originalTarget) {
  const toolbar = createElement('div', {
    classList: ['formatting-toolbar', 'advanced-toolbar'],
    style: {
      display: 'flex',
      flexWrap: 'wrap',
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
  
  // Separator
  const separator = createElement('div', {
    style: {
      height: '20px',
      borderLeft: '1px solid rgba(0, 0, 0, 0.2)'
    }
  });
  toolbar.appendChild(separator);
  
  // AI actions - Summarize
  toolbar.appendChild(createToolbarButton('Summarize', 'Summarize with Groq AI', () => {
    summarizeText(inputElement);
  }));
  
  // AI actions - Enhance
  toolbar.appendChild(createToolbarButton('Enhance', 'Enhance with Groq AI', () => {
    enhanceText(inputElement);
  }));
  
  // AI actions - Get suggestion
  toolbar.appendChild(createToolbarButton('Suggest', 'Get suggestion from Groq AI', () => {
    getSuggestion(inputElement);
  }));
  
  // AI actions - Modify CSS
  toolbar.appendChild(createToolbarButton('CSS', 'Modify page CSS with Groq AI', () => {
    showCssModDialog();
  }));
  
  // Clear button
  const clearButton = createToolbarButton('Clear', 'Clear text', () => {
    inputElement.value = '';
    syncInputWithOriginal({ target: inputElement }, originalTarget);
  });
  clearButton.style.marginLeft = 'auto';
  toolbar.appendChild(clearButton);
  
  return toolbar;
}

// Create advanced footer with status display
function createAdvancedFooter() {
  const footer = createElement('div', {
    classList: ['input-box-footer'],
    style: {
      padding: '6px 12px',
      fontSize: '12px',
      color: 'rgba(0, 0, 0, 0.6)',
      borderTop: '1px solid rgba(0, 0, 0, 0.1)',
      display: 'flex',
      justifyContent: 'space-between'
    }
  });
  
  // Left side - keyboard shortcuts
  footer.appendChild(createElement('span', {}, ['Ctrl+Shift+Q to close']));
  
  // Right side - status
  const statusElement = createElement('span', {
    classList: ['ai-status']
  }, [`Advanced Mode`]);
  footer.appendChild(statusElement);
  
  return footer;
}

// Summarize text using Groq AI
function summarizeText(inputElement) {
  const text = inputElement.value;
  
  if (!text) {
    showAdvancedStatusMessage('Error: No text to summarize', 'error');
    return;
  }
  
  if (!state.grokApiKey) {
    showAdvancedStatusMessage('Error: Groq API key not set', 'error');
    return;
  }
  
  showAdvancedStatusMessage('Summarizing...', 'info');
  
  grokApiSummarize(text, state.grokApiKey)
    .then(summary => {
      inputElement.value = summary;
      syncInputWithOriginal({ target: inputElement }, state.activeElement);
      showAdvancedStatusMessage('Summary generated', 'success');
    })
    .catch(error => {
      console.error('Error summarizing text:', error);
      showAdvancedStatusMessage(`Error: ${error.message}`, 'error');
    });
}

// Enhance text using Groq AI
function enhanceText(inputElement) {
  const text = inputElement.value;
  
  if (!text) {
    showAdvancedStatusMessage('Error: No text to enhance', 'error');
    return;
  }
  
  if (!state.grokApiKey) {
    showAdvancedStatusMessage('Error: Groq API key not set', 'error');
    return;
  }
  
  showAdvancedStatusMessage('Enhancing...', 'info');
  
  grokApiEnhance(text, state.grokApiKey)
    .then(enhancedText => {
      inputElement.value = enhancedText;
      syncInputWithOriginal({ target: inputElement }, state.activeElement);
      showAdvancedStatusMessage('Text enhanced', 'success');
    })
    .catch(error => {
      console.error('Error enhancing text:', error);
      showAdvancedStatusMessage(`Error: ${error.message}`, 'error');
    });
}

// Get suggestion using Groq AI
function getSuggestion(inputElement) {
  const text = inputElement.value;
  
  if (!text) {
    showAdvancedStatusMessage('Error: No text to get suggestion for', 'error');
    return;
  }
  
  if (!state.grokApiKey) {
    showAdvancedStatusMessage('Error: Groq API key not set', 'error');
    return;
  }
  
  showAdvancedStatusMessage('Getting suggestion...', 'info');
  
  grokApiGetSuggestion(text, state.grokApiKey)
    .then(suggestion => {
      inputElement.value += ' ' + suggestion;
      syncInputWithOriginal({ target: inputElement }, state.activeElement);
      showAdvancedStatusMessage('Suggestion added', 'success');
    })
    .catch(error => {
      console.error('Error getting suggestion:', error);
      showAdvancedStatusMessage(`Error: ${error.message}`, 'error');
    });
}

// Show CSS modification dialog
function showCssModDialog() {
  // Check if API key is set
  if (!state.grokApiKey) {
    showAdvancedStatusMessage('Error: Groq API key not set', 'error');
    return;
  }
  
  // Create dialog overlay
  const overlay = createElement('div', {
    classList: ['css-mod-overlay'],
    style: {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: '10000'
    }
  });
  
  // Create dialog container
  const dialog = createElement('div', {
    classList: ['css-mod-dialog'],
    style: {
      backgroundColor: '#fff',
      borderRadius: '8px',
      width: '600px',
      maxWidth: '90%',
      maxHeight: '90%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
    }
  });
  
  // Create dialog header
  const header = createElement('div', {
    style: {
      padding: '12px 16px',
      borderBottom: '1px solid #eee',
      fontWeight: 'bold',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, ['Modify Page CSS']);
  
  // Create close button
  const closeButton = createElement('button', {
    style: {
      background: 'none',
      border: 'none',
      fontSize: '18px',
      cursor: 'pointer'
    },
    onclick: () => {
      document.body.removeChild(overlay);
    }
  }, ['×']);
  header.appendChild(closeButton);
  
  // Create dialog content
  const content = createElement('div', {
    style: {
      padding: '16px',
      overflow: 'auto',
      flex: '1 1 auto'
    }
  });
  
  // Create dialog input
  const input = createElement('textarea', {
    placeholder: 'Describe CSS changes (e.g., "Make the background blue" or "Increase font size of all paragraphs")',
    style: {
      width: '100%',
      height: '100px',
      resize: 'vertical',
      marginBottom: '16px',
      padding: '8px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontFamily: 'inherit',
      fontSize: '14px'
    }
  });
  content.appendChild(input);
  
  // Create dialog buttons
  const buttons = createElement('div', {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '8px',
      marginTop: '16px'
    }
  });
  
  // Cancel button
  const cancelButton = createElement('button', {
    style: {
      padding: '8px 16px',
      background: '#f1f1f1',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer'
    },
    onclick: () => {
      document.body.removeChild(overlay);
    }
  }, ['Cancel']);
  buttons.appendChild(cancelButton);
  
  // Generate button
  const generateButton = createElement('button', {
    style: {
      padding: '8px 16px',
      background: '#4285f4',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer'
    },
    onclick: () => {
      const cssInstructions = input.value.trim();
      
      if (!cssInstructions) {
        alert('Please enter CSS modification instructions');
        return;
      }
      
      // Disable button while generating
      generateButton.disabled = true;
      generateButton.textContent = 'Generating...';
      
      // Get page structure
      const pageStructure = getPageStructure();
      
      // Generate CSS
      grokApiGenerateCSS(cssInstructions, pageStructure, state.grokApiKey)
        .then(css => {
          // Show preview container
          previewContainer.style.display = 'block';
          
          // Update preview
          previewTextarea.value = css;
          
          // Hide generate button
          generateButton.style.display = 'none';
          
          // Show apply button
          applyButton.style.display = 'block';
          
          // Clear message
          messageElement.textContent = '';
        })
        .catch(error => {
          console.error('Error generating CSS:', error);
          messageElement.textContent = `Error: ${error.message}`;
          messageElement.style.color = 'red';
          
          // Re-enable button
          generateButton.disabled = false;
          generateButton.textContent = 'Generate CSS';
        });
    }
  }, ['Generate CSS']);
  buttons.appendChild(generateButton);
  
  // Add message element for errors
  const messageElement = createElement('div', {
    style: {
      marginTop: '16px',
      color: 'red',
      fontSize: '14px'
    }
  });
  content.appendChild(messageElement);
  
  // Create preview container (hidden initially)
  const previewContainer = createElement('div', {
    style: {
      marginTop: '16px',
      display: 'none'
    }
  });
  
  // Preview header
  previewContainer.appendChild(createElement('h4', {
    style: {
      margin: '0 0 8px 0',
      fontSize: '14px'
    }
  }, ['Generated CSS:']));
  
  // Preview textarea
  const previewTextarea = createElement('textarea', {
    style: {
      width: '100%',
      height: '150px',
      resize: 'vertical',
      marginBottom: '16px',
      padding: '8px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontFamily: 'monospace',
      fontSize: '14px'
    }
  });
  previewContainer.appendChild(previewTextarea);
  
  // Apply button (hidden initially)
  const applyButton = createElement('button', {
    style: {
      padding: '8px 16px',
      background: '#0f9d58',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      display: 'none'
    },
    onclick: () => {
      const css = previewTextarea.value;
      
      // Apply the CSS
      try {
        if (applyCustomCSS(css)) {
          // Close the dialog
          document.body.removeChild(overlay);
          
          // Show success message
          showAdvancedStatusMessage('Custom CSS applied', 'success');
        } else {
          throw new Error('Failed to apply CSS');
        }
      } catch (error) {
        console.error('Error applying CSS:', error);
        messageElement.textContent = `Error applying CSS: ${error.message}`;
        messageElement.style.color = 'red';
      }
    }
  }, ['Apply CSS']);
  previewContainer.appendChild(applyButton);
  
  content.appendChild(previewContainer);
  content.appendChild(buttons);
  
  // Assemble dialog
  dialog.appendChild(header);
  dialog.appendChild(content);
  
  // Add dialog to overlay
  overlay.appendChild(dialog);
  
  // Add overlay to document
  document.body.appendChild(overlay);
  
  // Focus input
  setTimeout(() => {
    input.focus();
  }, 50);
}

// Show advanced status message
function showAdvancedStatusMessage(message, type) {
  if (!state.inputBox) return;
  
  const statusElement = state.inputBox.querySelector('.ai-status');
  
  if (!statusElement) return;
  
  statusElement.textContent = message;
  
  // Remove previous classes
  statusElement.classList.remove('info', 'error', 'success');
  
  // Add current type class
  if (type) {
    statusElement.classList.add(type);
  }
  
  // Auto-clear success messages after a few seconds
  if (type === 'success') {
    setTimeout(() => {
      if (statusElement && statusElement.textContent === message) {
        statusElement.textContent = 'Advanced Mode';
        statusElement.classList.remove('success');
      }
    }, 3000);
  }
}