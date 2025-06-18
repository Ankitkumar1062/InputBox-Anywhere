/**
 * Editor Detector
 * Detects and provides appropriate handling for various rich text and code editors
 */

const EditorDetector = (function() {
  // Known rich text editor classes and identifiers
  const richTextEditors = {
    // TinyMCE
    'tinymce': {
      classPatterns: ['mce-content-body', 'tox-edit-area'],
      idPatterns: ['tinymce_', 'mce_'],
      attributes: [{ name: 'data-id', valuePattern: 'tinymce' }]
    },
    // CKEditor
    'ckeditor': {
      classPatterns: ['cke_editable', 'cke_contents'],
      idPatterns: ['cke_'],
      attributes: [{ name: 'contenteditable', value: 'true' }]
    },
    // Quill
    'quill': {
      classPatterns: ['ql-editor', 'ql-container'],
      attributes: [{ name: 'data-quill', valuePattern: '' }]
    },
    // Froala
    'froala': {
      classPatterns: ['fr-element', 'fr-view'],
      attributes: [{ name: 'data-gramm', value: 'false' }]
    },
    // Summernote
    'summernote': {
      classPatterns: ['note-editable', 'note-editor'],
      attributes: [{ name: 'data-note', valuePattern: '' }]
    },
    // TrixEditor
    'trix': {
      classPatterns: ['trix-editor', 'trix-content'],
      attributes: [{ name: 'data-trix', valuePattern: '' }]
    }
  };
  
  // Known code editor classes and identifiers
  const codeEditors = {
    // CodeMirror
    'codemirror': {
      classPatterns: ['CodeMirror', 'cm-editor', 'cm-content'],
      attributes: [{ name: 'data-cm-editor', valuePattern: '' }]
    },
    // Ace Editor
    'ace': {
      classPatterns: ['ace_editor', 'ace_content', 'ace_text-input'],
      idPatterns: ['ace-'],
      attributes: [{ name: 'data-ace', valuePattern: '' }]
    },
    // Monaco (VS Code online)
    'monaco': {
      classPatterns: ['monaco-editor', 'mtk', 'monaco-scrollable-element'],
      attributes: [{ name: 'data-uri', valuePattern: '' }]
    }
  };
  
  // Combined editors object for easier iteration
  const allEditors = {
    ...richTextEditors,
    ...codeEditors
  };
  
  /**
   * Check if an element is part of a known editor
   * @param {HTMLElement} element - The element to check
   * @returns {Boolean} - True if the element is part of a known editor
   */
  function isEditor(element) {
    if (!element) return false;
    
    const editorType = detectEditor(element);
    return editorType !== null;
  }
  
  /**
   * Detect which editor the element belongs to
   * @param {HTMLElement} element - The element to check
   * @returns {String|null} - The name of the detected editor, or null if not found
   */
  function detectEditor(element) {
    if (!element) return null;
    
    // Check the element itself and its parents up to 3 levels
    let currentElement = element;
    for (let i = 0; i < 4; i++) {
      if (!currentElement) break;
      
      // Check all known editors
      for (const [editorName, editorData] of Object.entries(allEditors)) {
        // Check class patterns
        if (editorData.classPatterns) {
          for (const pattern of editorData.classPatterns) {
            if (currentElement.classList && currentElement.classList.contains(pattern)) {
              return editorName;
            }
            
            // Also check if the pattern is contained in the className (for dynamically generated classes)
            if (currentElement.className && typeof currentElement.className === 'string' && currentElement.className.includes(pattern)) {
              return editorName;
            }
          }
        }
        
        // Check ID patterns
        if (editorData.idPatterns) {
          for (const pattern of editorData.idPatterns) {
            if (currentElement.id && currentElement.id.startsWith(pattern)) {
              return editorName;
            }
          }
        }
        
        // Check attributes
        if (editorData.attributes) {
          for (const attr of editorData.attributes) {
            if (currentElement.hasAttribute(attr.name)) {
              const value = currentElement.getAttribute(attr.name);
              if (attr.value && value === attr.value) {
                return editorName;
              }
              if (attr.valuePattern && value && value.includes(attr.valuePattern)) {
                return editorName;
              }
              if (!attr.value && !attr.valuePattern) {
                return editorName;
              }
            }
          }
        }
      }
      
      // Move up to the parent
      currentElement = currentElement.parentElement;
    }
    
    return null;
  }
  
  /**
   * Get special handling instructions for a detected editor
   * @param {String} editorType - The type of the detected editor
   * @returns {Object} - Editor handling instructions
   */
  function getEditorHandling(editorType) {
    if (!editorType) return null;
    
    // Common handling for rich text editors
    if (richTextEditors[editorType]) {
      return {
        type: 'richtext',
        useHtml: true,
        supportsBold: true,
        supportsItalic: true,
        supportsUnderline: true,
        supportsList: true
      };
    }
    
    // Specific handling for code editors
    if (codeEditors[editorType]) {
      return {
        type: 'code',
        useHtml: false,
        supportsIndentation: true,
        supportsLineNumbers: true,
        supportsHighlighting: true
      };
    }
    
    return null;
  }
  
  // Public API
  return {
    isEditor,
    detectEditor,
    getEditorHandling,
    editors: {
      richText: Object.keys(richTextEditors),
      code: Object.keys(codeEditors)
    }
  };
})();

// Make it available globally
window.EditorDetector = EditorDetector;