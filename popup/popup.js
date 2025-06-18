/**
 * Custom Input Box Everywhere
 * Popup script for configuration
 */

// Default configuration
const defaultConfig = {
  enabled: true,
  mode: 'habit',
  position: 'top',
  theme: 'light',
  llmEndpoint: 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
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

// Global state
const state = {
  config: { ...defaultConfig },
  templates: [],
  cssRules: [],
  editingTemplateId: null,
  saving: false
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
  // Load configuration
  await loadConfig();
  
  // Load templates
  await loadTemplates();
  
  // Load CSS rules
  await loadCssRules();
  
  // Set up event listeners
  setupEventListeners();
  
  // Initialize tabs
  initTabs();
  
  // Update UI based on loaded configuration
  updateUI();
  
  console.log('Popup initialized');
});

// Load configuration from storage
async function loadConfig() {
  try {
    const result = await browser.storage.sync.get('inputBoxConfig');
    if (result.inputBoxConfig) {
      state.config = { ...defaultConfig, ...result.inputBoxConfig };
      console.log('Loaded configuration:', state.config);
    } else {
      state.config = { ...defaultConfig };
      console.log('Using default configuration');
    }
  } catch (error) {
    console.error('Error loading configuration:', error);
    state.config = { ...defaultConfig };
  }
}

// Load templates from storage
async function loadTemplates() {
  try {
    const result = await browser.storage.sync.get('inputBoxTemplates');
    if (result.inputBoxTemplates) {
      state.templates = result.inputBoxTemplates;
      console.log('Loaded templates:', state.templates.length);
    } else {
      state.templates = [];
      console.log('No templates found');
    }
    
    // Update the templates list
    updateTemplatesList();
  } catch (error) {
    console.error('Error loading templates:', error);
    state.templates = [];
  }
}

// Load CSS rules from storage
async function loadCssRules() {
  try {
    const result = await browser.storage.sync.get('cssRules');
    if (result.cssRules) {
      state.cssRules = result.cssRules;
      console.log('Loaded CSS rules:', state.cssRules.length);
    } else {
      state.cssRules = [];
      console.log('No CSS rules found');
    }
    
    // Update the CSS rules list
    updateCssRulesList();
  } catch (error) {
    console.error('Error loading CSS rules:', error);
    state.cssRules = [];
  }
}

// Update the UI based on the current configuration
function updateUI() {
  // Extension toggle
  document.getElementById('extension-toggle').checked = state.config.enabled;
  
  // Mode radios
  document.querySelector(`input[name="mode"][value="${state.config.mode}"]`).checked = true;
  
  // Position radios
  document.querySelector(`input[name="position"][value="${state.config.position}"]`).checked = true;
  
  // Theme radios
  document.querySelector(`input[name="theme"][value="${state.config.theme}"]`).checked = true;
  
  // Advanced settings
  document.getElementById('editor-support-toggle').checked = state.config.editorSupport;
  document.getElementById('css-modification-toggle').checked = state.config.cssModification;
  document.getElementById('summarize-content-toggle').checked = state.config.summarizeContent;
  document.getElementById('drag-enabled-toggle').checked = state.config.dragEnabled;
  
  // LLM settings
  document.getElementById('llm-model').value = state.config.llmModel || 'dummyLLM';
  document.getElementById('api-key').value = state.config.apiKey || '';
}

// Set up event listeners
function setupEventListeners() {
  // Save buttons
  document.getElementById('save-basic').addEventListener('click', saveBasicSettings);
  document.getElementById('save-advanced').addEventListener('click', saveAdvancedSettings);
  
  // Close button
  document.getElementById('close-popup').addEventListener('click', closePopup);
  
  // Template management
  document.getElementById('add-template').addEventListener('click', showTemplateForm);
  document.getElementById('save-template').addEventListener('click', saveTemplate);
  document.getElementById('cancel-template').addEventListener('click', hideTemplateForm);
  
  // Template generation
  document.getElementById('generate-template').addEventListener('click', showGenerateTemplateForm);
  document.getElementById('confirm-generate-template').addEventListener('click', generateTemplate);
  document.getElementById('cancel-generate-template').addEventListener('click', hideGenerateTemplateForm);
  
  // CSS rule generation
  document.getElementById('generate-css-rules').addEventListener('click', showGenerateCssForm);
  document.getElementById('confirm-generate-css').addEventListener('click', generateCssRules);
  document.getElementById('cancel-generate-css').addEventListener('click', hideGenerateCssForm);
  
  // LLM connection test
  document.getElementById('test-llm-connection').addEventListener('click', testLLMConnection);
}

// Initialize tabs
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Get the tab id
      const tabId = button.getAttribute('data-tab');
      
      // Remove active class from all buttons and panes
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));
      
      // Add active class to selected button and pane
      button.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });
}

// Save basic settings
async function saveBasicSettings() {
  if (state.saving) return;
  state.saving = true;
  
  try {
    // Update config from UI
    state.config.enabled = document.getElementById('extension-toggle').checked;
    state.config.mode = document.querySelector('input[name="mode"]:checked').value;
    state.config.position = document.querySelector('input[name="position"]:checked').value;
    state.config.theme = document.querySelector('input[name="theme"]:checked').value;
    
    // Save to storage
    await browser.storage.sync.set({ inputBoxConfig: state.config });
    
    // Notify the background script
    await browser.runtime.sendMessage({
      action: 'updateConfig',
      config: state.config
    });
    
    showSaveSuccess('save-basic');
    console.log('Basic settings saved');
  } catch (error) {
    console.error('Error saving basic settings:', error);
    alert('Error saving settings. Please try again.');
  } finally {
    state.saving = false;
  }
}

// Save advanced settings
async function saveAdvancedSettings() {
  if (state.saving) return;
  state.saving = true;
  
  try {
    // Update config from UI
    state.config.editorSupport = document.getElementById('editor-support-toggle').checked;
    state.config.cssModification = document.getElementById('css-modification-toggle').checked;
    state.config.summarizeContent = document.getElementById('summarize-content-toggle').checked;
    state.config.dragEnabled = document.getElementById('drag-enabled-toggle').checked;
    state.config.llmModel = document.getElementById('llm-model').value;
    state.config.apiKey = document.getElementById('api-key').value;
    
    // Update endpoint based on model
    if (state.config.llmModel === 'mistral') {
      state.config.llmEndpoint = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';
    } else if (state.config.llmModel === 'phi3') {
      state.config.llmEndpoint = 'https://api-inference.huggingface.co/models/microsoft/Phi-3-mini-4k-instruct';
    }
    
    // Save to storage
    await browser.storage.sync.set({ inputBoxConfig: state.config });
    
    // Notify the background script
    await browser.runtime.sendMessage({
      action: 'updateConfig',
      config: state.config
    });
    
    showSaveSuccess('save-advanced');
    console.log('Advanced settings saved');
  } catch (error) {
    console.error('Error saving advanced settings:', error);
    alert('Error saving settings. Please try again.');
  } finally {
    state.saving = false;
  }
}

// Show save success feedback
function showSaveSuccess(buttonId) {
  const button = document.getElementById(buttonId);
  const originalText = button.textContent;
  
  button.textContent = 'Saved!';
  button.classList.add('success');
  
  setTimeout(() => {
    button.textContent = originalText;
    button.classList.remove('success');
  }, 1500);
}

// Close popup
function closePopup() {
  window.close();
}

// Update the templates list in the UI
function updateTemplatesList() {
  const templatesList = document.getElementById('templates-list');
  templatesList.innerHTML = '';
  
  if (state.templates.length === 0) {
    templatesList.innerHTML = '<div class="template-item"><span colspan="3">No templates available. Add your first template!</span></div>';
    return;
  }
  
  state.templates.forEach((template, index) => {
    const templateItem = document.createElement('div');
    templateItem.className = 'template-item';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'template-name';
    nameSpan.textContent = template.name;
    
    const contentSpan = document.createElement('span');
    contentSpan.className = 'template-content';
    contentSpan.textContent = template.content;
    contentSpan.title = template.content;
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'template-actions';
    
    const editButton = document.createElement('button');
    editButton.className = 'template-edit';
    editButton.textContent = '✎';
    editButton.title = 'Edit template';
    editButton.addEventListener('click', () => editTemplate(template.id));
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'template-delete';
    deleteButton.textContent = '×';
    deleteButton.title = 'Delete template';
    deleteButton.addEventListener('click', () => deleteTemplate(template.id));
    
    actionsDiv.appendChild(editButton);
    actionsDiv.appendChild(deleteButton);
    
    templateItem.appendChild(nameSpan);
    templateItem.appendChild(contentSpan);
    templateItem.appendChild(actionsDiv);
    
    templatesList.appendChild(templateItem);
  });
}

// Update the CSS rules list in the UI
function updateCssRulesList() {
  const cssRulesList = document.getElementById('css-rules-list');
  cssRulesList.innerHTML = '';
  
  if (state.cssRules.length === 0) {
    cssRulesList.innerHTML = '<div class="css-rule-item"><span colspan="3">No CSS rules available. Generate rules to customize page appearance.</span></div>';
    return;
  }
  
  state.cssRules.forEach((rule, index) => {
    const ruleItem = document.createElement('div');
    ruleItem.className = 'css-rule-item';
    
    const selectorSpan = document.createElement('span');
    selectorSpan.className = 'css-selector';
    selectorSpan.textContent = rule.selector;
    selectorSpan.title = rule.selector;
    
    const propertiesSpan = document.createElement('span');
    propertiesSpan.className = 'css-properties';
    const propertiesText = Object.entries(rule.styles)
      .map(([prop, value]) => `${prop}: ${value}`)
      .join('; ');
    propertiesSpan.textContent = propertiesText;
    propertiesSpan.title = propertiesText;
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'css-rule-actions';
    
    const deleteButton = document.createElement('button');
    deleteButton.textContent = '×';
    deleteButton.title = 'Delete rule';
    deleteButton.addEventListener('click', () => deleteCssRule(index));
    
    actionsDiv.appendChild(deleteButton);
    
    ruleItem.appendChild(selectorSpan);
    ruleItem.appendChild(propertiesSpan);
    ruleItem.appendChild(actionsDiv);
    
    cssRulesList.appendChild(ruleItem);
  });
}

// Show the template form for adding/editing
function showTemplateForm() {
  // Reset form
  document.getElementById('template-id').value = '';
  document.getElementById('template-name').value = '';
  document.getElementById('template-content').value = '';
  state.editingTemplateId = null;
  
  // Show form
  document.getElementById('template-form').style.display = 'block';
  document.getElementById('template-name').focus();
}

// Hide the template form
function hideTemplateForm() {
  document.getElementById('template-form').style.display = 'none';
}

// Save a template
async function saveTemplate() {
  const nameInput = document.getElementById('template-name');
  const contentInput = document.getElementById('template-content');
  const idInput = document.getElementById('template-id');
  
  const name = nameInput.value.trim();
  const content = contentInput.value;
  const id = idInput.value || `template-${Date.now()}`;
  
  if (!name) {
    alert('Please enter a template name');
    nameInput.focus();
    return;
  }
  
  if (!content) {
    alert('Please enter template content');
    contentInput.focus();
    return;
  }
  
  try {
    // Check if we're editing or adding
    if (state.editingTemplateId) {
      // Update existing template
      const index = state.templates.findIndex(t => t.id === state.editingTemplateId);
      if (index !== -1) {
        state.templates[index] = { id, name, content };
      }
    } else {
      // Add new template
      state.templates.push({ id, name, content });
    }
    
    // Save to storage
    await browser.storage.sync.set({ inputBoxTemplates: state.templates });
    
    // Notify background script
    await browser.runtime.sendMessage({
      action: 'saveTemplates',
      templates: state.templates
    });
    
    // Update UI
    updateTemplatesList();
    hideTemplateForm();
    
    console.log('Template saved:', name);
  } catch (error) {
    console.error('Error saving template:', error);
    alert('Error saving template. Please try again.');
  }
}

// Edit a template
function editTemplate(id) {
  const template = state.templates.find(t => t.id === id);
  if (!template) {
    console.error('Template not found:', id);
    return;
  }
  
  // Set form values
  document.getElementById('template-id').value = template.id;
  document.getElementById('template-name').value = template.name;
  document.getElementById('template-content').value = template.content;
  
  // Set editing state
  state.editingTemplateId = template.id;
  
  // Show form
  document.getElementById('template-form').style.display = 'block';
  document.getElementById('template-name').focus();
}

// Delete a template
async function deleteTemplate(id) {
  if (!confirm('Are you sure you want to delete this template?')) {
    return;
  }
  
  try {
    // Remove template
    state.templates = state.templates.filter(t => t.id !== id);
    
    // Save to storage
    await browser.storage.sync.set({ inputBoxTemplates: state.templates });
    
    // Notify background script
    await browser.runtime.sendMessage({
      action: 'saveTemplates',
      templates: state.templates
    });
    
    // Update UI
    updateTemplatesList();
    
    console.log('Template deleted:', id);
  } catch (error) {
    console.error('Error deleting template:', error);
    alert('Error deleting template. Please try again.');
  }
}

// Show the generate template form
function showGenerateTemplateForm() {
  document.getElementById('template-description').value = '';
  document.getElementById('generate-template-form').style.display = 'block';
  document.getElementById('template-description').focus();
}

// Hide the generate template form
function hideGenerateTemplateForm() {
  document.getElementById('generate-template-form').style.display = 'none';
}

// Generate a template using LLM
async function generateTemplate() {
  const description = document.getElementById('template-description').value.trim();
  
  if (!description) {
    alert('Please enter a description of the template you need');
    document.getElementById('template-description').focus();
    return;
  }
  
  try {
    // Show loading state
    const button = document.getElementById('confirm-generate-template');
    const originalText = button.textContent;
    button.textContent = 'Generating...';
    button.disabled = true;
    
    // Request template from background script
    const response = await browser.runtime.sendMessage({
      action: 'generateTemplate',
      prompt: `Create a template for: ${description}. Make it concise but useful.`,
      model: state.config.llmModel
    });
    
    // Reset button
    button.textContent = originalText;
    button.disabled = false;
    
    if (response && response.template) {
      // Fill the template form with generated content
      document.getElementById('template-id').value = '';
      document.getElementById('template-name').value = description.substring(0, 30);
      document.getElementById('template-content').value = response.template;
      
      // Hide generate form and show template form
      hideGenerateTemplateForm();
      document.getElementById('template-form').style.display = 'block';
    } else {
      alert('Could not generate template. Please try again or use a different description.');
    }
  } catch (error) {
    console.error('Error generating template:', error);
    alert('Error generating template. Please try again.');
    
    // Reset button
    const button = document.getElementById('confirm-generate-template');
    button.textContent = 'Generate';
    button.disabled = false;
  }
}

// Show the generate CSS form
function showGenerateCssForm() {
  document.getElementById('css-description').value = '';
  document.getElementById('generate-css-form').style.display = 'block';
  document.getElementById('css-description').focus();
}

// Hide the generate CSS form
function hideGenerateCssForm() {
  document.getElementById('generate-css-form').style.display = 'none';
}

// Generate CSS rules using LLM
async function generateCssRules() {
  const description = document.getElementById('css-description').value.trim();
  
  if (!description) {
    alert('Please enter a description of the CSS changes you need');
    document.getElementById('css-description').focus();
    return;
  }
  
  try {
    // Show loading state
    const button = document.getElementById('confirm-generate-css');
    const originalText = button.textContent;
    button.textContent = 'Generating...';
    button.disabled = true;
    
    // Request CSS rules from background script
    const response = await browser.runtime.sendMessage({
      action: 'generateCssRules',
      prompt: `Generate CSS rules based on this description: "${description}"`,
      model: state.config.llmModel
    });
    
    // Reset button
    button.textContent = originalText;
    button.disabled = false;
    
    if (response && response.rules && Array.isArray(response.rules)) {
      // Save the generated rules
      state.cssRules = [...state.cssRules, ...response.rules];
      
      // Save to storage
      await browser.storage.sync.set({ cssRules: state.cssRules });
      
      // Notify background script
      await browser.runtime.sendMessage({
        action: 'saveCssRules',
        rules: state.cssRules
      });
      
      // Update UI
      updateCssRulesList();
      hideGenerateCssForm();
      
      // Show success message
      alert(`${response.rules.length} CSS rules generated and saved.`);
    } else {
      alert('Could not generate CSS rules. Please try again or use a different description.');
    }
  } catch (error) {
    console.error('Error generating CSS rules:', error);
    alert('Error generating CSS rules. Please try again.');
    
    // Reset button
    const button = document.getElementById('confirm-generate-css');
    button.textContent = 'Generate';
    button.disabled = false;
  }
}

// Delete a CSS rule
async function deleteCssRule(index) {
  if (!confirm('Are you sure you want to delete this CSS rule?')) {
    return;
  }
  
  try {
    // Remove rule
    state.cssRules.splice(index, 1);
    
    // Save to storage
    await browser.storage.sync.set({ cssRules: state.cssRules });
    
    // Notify background script
    await browser.runtime.sendMessage({
      action: 'saveCssRules',
      rules: state.cssRules
    });
    
    // Update UI
    updateCssRulesList();
    
    console.log('CSS rule deleted at index:', index);
  } catch (error) {
    console.error('Error deleting CSS rule:', error);
    alert('Error deleting CSS rule. Please try again.');
  }
}

// Test LLM connection
function testLLMConnection() {
  const resultElement = document.getElementById('llm-test-result');
  const apiKey = document.getElementById('api-key').value;
  const model = document.getElementById('llm-model').value;
  
  // Show loading state
  resultElement.innerHTML = '<div class="loading-spinner"></div> Testing connection...';
  resultElement.className = 'test-result';
  
  // Send test request to background script
  browser.runtime.sendMessage({
    action: 'testLLMConnection',
    model: model,
    apiKey: apiKey
  }).then(result => {
    if (result.success) {
      resultElement.innerHTML = `<span class="success-icon">✓</span> Connection successful!`;
      resultElement.className = 'test-result success';
    } else {
      resultElement.innerHTML = `<span class="error-icon">✗</span> Connection failed: ${result.error || result.statusText || 'Unknown error'}`;
      resultElement.className = 'test-result error';
    }
  }).catch(error => {
    resultElement.innerHTML = `<span class="error-icon">✗</span> Test error: ${error.message}`;
    resultElement.className = 'test-result error';
  });
}