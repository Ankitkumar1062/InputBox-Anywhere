/**
 * Template Manager
 * Manages text templates for quick insertion
 */

const TemplateManager = (function() {
  // Current templates
  let templates = [];
  
  /**
   * Load templates from storage
   * @returns {Promise<Array>} - The loaded templates
   */
  async function loadTemplates() {
    try {
      const result = await browser.storage.sync.get('inputBoxTemplates');
      if (result.inputBoxTemplates && Array.isArray(result.inputBoxTemplates)) {
        templates = result.inputBoxTemplates;
        console.log("TemplateManager: Loaded", templates.length, "templates");
      } else {
        // Load default templates
        templates = getDefaultTemplates();
        console.log("TemplateManager: Using default templates");
      }
      return templates;
    } catch (error) {
      console.error('TemplateManager: Error loading templates:', error);
      templates = getDefaultTemplates();
      return templates;
    }
  }
  
  /**
   * Get default templates
   * @returns {Array} - The default templates
   */
  function getDefaultTemplates() {
    return [
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
  }
  
  /**
   * Save templates to storage
   * @param {Array} newTemplates - The templates to save
   * @returns {Promise<Boolean>} - Success status
   */
  async function saveTemplates(newTemplates) {
    try {
      if (!Array.isArray(newTemplates)) {
        console.error('TemplateManager: Invalid templates format');
        return false;
      }
      
      // Update local templates
      templates = newTemplates;
      
      // Save to storage
      await browser.storage.sync.set({ inputBoxTemplates: templates });
      console.log("TemplateManager: Saved", templates.length, "templates");
      
      return true;
    } catch (error) {
      console.error('TemplateManager: Error saving templates:', error);
      return false;
    }
  }
  
  /**
   * Get all templates
   * @returns {Array} - All templates
   */
  function getAllTemplates() {
    return [...templates];
  }
  
  /**
   * Get a template by index
   * @param {Number} index - The template index
   * @returns {Object|null} - The template or null if not found
   */
  function getTemplateByIndex(index) {
    return (index >= 0 && index < templates.length) ? templates[index] : null;
  }
  
  /**
   * Get a template by ID
   * @param {String} id - The template ID
   * @returns {Object|null} - The template or null if not found
   */
  function getTemplateById(id) {
    return templates.find(template => template.id === id) || null;
  }
  
  /**
   * Add a new template
   * @param {Object} template - The template to add
   * @returns {Promise<Boolean>} - Success status
   */
  async function addTemplate(template) {
    try {
      if (!template || !template.name || !template.content) {
        console.error('TemplateManager: Invalid template format');
        return false;
      }
      
      // Generate an ID if not provided
      if (!template.id) {
        template.id = 'template-' + Date.now();
      }
      
      // Add to templates
      templates.push(template);
      
      // Save to storage
      return await saveTemplates(templates);
    } catch (error) {
      console.error('TemplateManager: Error adding template:', error);
      return false;
    }
  }
  
  /**
   * Update an existing template
   * @param {String} id - The template ID
   * @param {Object} updatedTemplate - The updated template data
   * @returns {Promise<Boolean>} - Success status
   */
  async function updateTemplate(id, updatedTemplate) {
    try {
      const index = templates.findIndex(template => template.id === id);
      if (index === -1) {
        console.error('TemplateManager: Template not found:', id);
        return false;
      }
      
      // Update the template
      templates[index] = {
        ...templates[index],
        ...updatedTemplate
      };
      
      // Save to storage
      return await saveTemplates(templates);
    } catch (error) {
      console.error('TemplateManager: Error updating template:', error);
      return false;
    }
  }
  
  /**
   * Delete a template
   * @param {String} id - The template ID
   * @returns {Promise<Boolean>} - Success status
   */
  async function deleteTemplate(id) {
    try {
      const index = templates.findIndex(template => template.id === id);
      if (index === -1) {
        console.error('TemplateManager: Template not found:', id);
        return false;
      }
      
      // Remove the template
      templates.splice(index, 1);
      
      // Save to storage
      return await saveTemplates(templates);
    } catch (error) {
      console.error('TemplateManager: Error deleting template:', error);
      return false;
    }
  }
  
  /**
   * Process a template by replacing placeholders
   * @param {String} templateContent - The template content
   * @param {Object} replacements - Key-value pairs for replacements
   * @returns {String} - The processed template
   */
  function processTemplate(templateContent, replacements = {}) {
    if (!templateContent) return '';
    
    let processed = templateContent;
    
    // Replace placeholders
    for (const [key, value] of Object.entries(replacements)) {
      processed = processed.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
    }
    
    // Add common dynamic replacements
    const now = new Date();
    processed = processed.replace(/\[Date\]/g, now.toLocaleDateString());
    processed = processed.replace(/\[Time\]/g, now.toLocaleTimeString());
    processed = processed.replace(/\[DateTime\]/g, now.toLocaleString());
    
    return processed;
  }
  
  // Public API
  return {
    loadTemplates,
    saveTemplates,
    getAllTemplates,
    getTemplateByIndex,
    getTemplateById,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    processTemplate
  };
})();

// Make it available globally
window.TemplateManager = TemplateManager;