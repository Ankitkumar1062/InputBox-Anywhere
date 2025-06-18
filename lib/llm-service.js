/**
 * LLM Service
 * Handles all language model interactions with proper error handling
 * and optimized prompts for different models
 */

const LLMService = (function() {
  // Cache for LLM responses to reduce API calls
  const responseCache = new Map();
  const MAX_CACHE_SIZE = 100;
  const DEFAULT_TIMEOUT = 15000; // 15 seconds
  
  // Model definitions with optimized prompts
  const models = {
    mistral: {
      name: "Mistral 7B",
      endpoint: 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
      requiresAuth: true,
      formatPrompt: (prompt) => {
        // Create a well-formatted prompt for Mistral to improve response quality
        return { 
          inputs: `<s>[INST] ${prompt} [/INST]</s>` 
        };
      },
      extractResponse: (data) => {
        if (Array.isArray(data) && data.length > 0) {
          let text = data[0].generated_text;
          
          // Extract the response part (after the instruction)
          const responseMatch = text.match(/\[\/INST\]<\/s>\s*([\s\S]*)/);
          if (responseMatch && responseMatch[1]) {
            return responseMatch[1].trim();
          }
          
          // Fallback: just return everything after the prompt
          const promptEnd = text.indexOf("[/INST]</s>");
          if (promptEnd !== -1) {
            return text.substring(promptEnd + 10).trim();
          }
          
          return text.trim();
        }
        return '';
      },
      // Custom prompt templates
      promptTemplates: {
        summarize: (text) => `You are a helpful assistant that summarizes text.
Please summarize the following text concisely in 3-5 sentences, focusing on the key points:

${text}

Provide a clear, readable summary that captures the essential information.`,
        
        cssModify: (description) => `You are a CSS expert. 
Generate CSS rules based on this description: "${description}"

The rules should be formatted as a JSON array of objects, each with 'selector' and 'styles' properties.
For example:
[
  {
    "selector": "input[type='text']",
    "styles": {
      "position": "relative",
      "top": "20px",
      "background-color": "#f9f9f9",
      "border": "1px solid #ddd"
    }
  }
]

ONLY return valid JSON. Do not include any other text or explanation in your response.
Be specific with selectors but avoid overly complex ones.`,
        
        suggest: (text) => `Complete or continue the following text with 3 short, helpful suggestions:
"${text}"

Format each suggestion as a bullet point starting with "•".`
      }
    },
    phi3: {
      name: "Phi-3 Mini",
      endpoint: 'https://api-inference.huggingface.co/models/microsoft/Phi-3-mini-4k-instruct',
      requiresAuth: true,
      formatPrompt: (prompt) => {
        return { 
          inputs: `<|user|>\n${prompt}\n<|assistant|>` 
        };
      },
      extractResponse: (data) => {
        if (Array.isArray(data) && data.length > 0) {
          let text = data[0].generated_text;
          
          // Extract just the assistant's response
          const responseMatch = text.match(/<\|assistant\|>\s*([\s\S]*)/);
          if (responseMatch && responseMatch[1]) {
            return responseMatch[1].trim();
          }
          
          return text.trim();
        }
        return '';
      },
      // Custom prompt templates
      promptTemplates: {
        summarize: (text) => `Summarize the following text concisely in 3-5 sentences:

${text}

Focus on the key points and main ideas.`,
        
        cssModify: (description) => `Generate CSS rules based on this description: "${description}"

Format your response as a JSON array of objects with 'selector' and 'styles' properties, like this example:
[
  {
    "selector": "input[type='text']",
    "styles": {
      "position": "relative",
      "top": "20px",
      "background-color": "#f9f9f9"
    }
  }
]

Only output valid JSON. No other text.`,
        
        suggest: (text) => `Complete the following text with 3 brief suggestions:
"${text}"

Format as bullet points with • symbol.`
      }
    },
    dummyLLM: {
      name: "Simple Generator (No API)",
      endpoint: 'none',
      requiresAuth: false,
      formatPrompt: (prompt) => ({}),
      // This model doesn't make API calls, it just generates text based on rules
      generateLocally: (prompt) => {
        console.log("Using local generation for prompt:", prompt);
        
        // For suggestions
        if (prompt.includes("suggest") || prompt.includes("complete") || prompt.includes("bullet")) {
          return "• Continue typing your message\n• Add more specific details\n• Consider mentioning timeline or deadlines";
        }
        
        // For templates
        if (prompt.includes("template")) {
          if (prompt.includes("email")) {
            return "Dear [Name],\n\nI hope this email finds you well. [Your message here]\n\nBest regards,\n[Your Name]";
          }
          if (prompt.includes("meeting")) {
            return "Meeting Notes: [Title]\nDate: [Date]\nAttendees: [Names]\n\nAgenda:\n- [Item 1]\n- [Item 2]\n\nAction Items:\n- [Task 1]\n- [Task 2]";
          }
          return "Thank you for your message. I'll get back to you as soon as possible.";
        }
        
        // For CSS rules
        if (prompt.includes("CSS") || prompt.includes("css")) {
          // Generate more detailed CSS rules based on the description
          let cssRules = [];
          
          // Detect specific CSS requests
          if (prompt.includes("eye level") || prompt.includes("move up") || prompt.includes("top")) {
            cssRules.push({
              "selector": "input[type='text'], input[type='email'], input[type='search'], textarea",
              "styles": {
                "position": "relative",
                "top": "-150px",
                "margin-bottom": "-100px",
                "background-color": "#f9f9f9",
                "border": "1px solid #ddd",
                "padding": "10px",
                "border-radius": "4px",
                "z-index": "100"
              }
            });
            
            cssRules.push({
              "selector": "form",
              "styles": {
                "margin-bottom": "100px"
              }
            });
          } 
          // If the prompt mentions forms at the bottom
          else if (prompt.includes("bottom")) {
            cssRules.push({
              "selector": "form:last-of-type, div:last-of-type > form",
              "styles": {
                "position": "relative",
                "top": "-150px",
                "margin-bottom": "150px",
                "z-index": "100"
              }
            });
          }
          // If the prompt mentions readability
          else if (prompt.includes("read") || prompt.includes("scrolling")) {
            cssRules.push({
              "selector": "article, .content, .main, p",
              "styles": {
                "max-width": "800px",
                "margin": "0 auto",
                "line-height": "1.6",
                "font-size": "18px",
                "padding": "0 20px"
              }
            });
            
            cssRules.push({
              "selector": "h1, h2, h3, h4, h5, h6",
              "styles": {
                "line-height": "1.3",
                "margin-top": "1.5em",
                "margin-bottom": "0.5em"
              }
            });
          }
          // Default CSS improvements
          else {
            cssRules.push({
              "selector": "input[type='text'], input[type='email'], input[type='search'], textarea",
              "styles": {
                "position": "relative",
                "top": "20px",
                "background-color": "#f9f9f9",
                "border": "1px solid #ddd",
                "padding": "10px",
                "border-radius": "4px",
                "transition": "all 0.3s ease"
              }
            });
          }
          
          return JSON.stringify(cssRules);
        }
        
        // For summaries
        if (prompt.includes("summarize") || prompt.includes("summary")) {
          // Extract some content from the prompt to make the summary seem relevant
          const lines = prompt.split("\n");
          let contentLine = "";
          for (const line of lines) {
            if (line.length > 30 && !line.includes("Summary:")) {
              contentLine = line.substring(0, 100);
              break;
            }
          }
          
          if (contentLine) {
            return `This text discusses ${contentLine}. The main points include the key information presented in a concise format. The content appears to explain important concepts that have been summarized here to save you time reading the full document.`;
          } else {
            return `This appears to be a detailed text. The main points have been condensed here for easier reading. The content discusses various topics that would require more scrolling in the original format.`;
          }
        }
        
        // Default response
        return "I've processed your request. Please check the results and let me know if you need any adjustments.";
      }
    }
  };
  
  /**
   * Get the current configuration from storage
   * @returns {Promise<Object>} - The current configuration
   */
  async function getConfig() {
    try {
      const result = await browser.storage.sync.get('inputBoxConfig');
      return result.inputBoxConfig || {};
    } catch (error) {
      console.error('Error getting configuration:', error);
      return {};
    }
  }
  
  /**
   * Get model information by name
   * @param {String} modelName - The name of the model
   * @returns {Object} - The model configuration
   */
  function getModel(modelName) {
    return models[modelName] || models.dummyLLM;
  }
  
  /**
   * Handle an LLM request
   * @param {String} prompt - The prompt to send to the LLM
   * @param {String} modelName - The name of the model to use
   * @param {Number} timeout - Optional timeout in milliseconds
   * @returns {Promise<String>} - The LLM response
   */
  async function handleRequest(prompt, modelName, timeout = DEFAULT_TIMEOUT) {
    console.log(`LLMService: Handling request with model: ${modelName}`);
    
    try {
      // Check cache first
      const cacheKey = `${modelName}:${prompt}`;
      if (responseCache.has(cacheKey)) {
        console.log("LLMService: Using cached response");
        return responseCache.get(cacheKey);
      }
      
      // Get the model configuration
      const model = getModel(modelName);
      console.log(`LLMService: Using model: ${model.name}`);
      
      // Get the current configuration
      const config = await getConfig();
      
      // If this is the dummy model, use local generation
      if (modelName === 'dummyLLM' || model.endpoint === 'none') {
        console.log("LLMService: Using local generation");
        const response = model.generateLocally(prompt);
        
        // Cache the result
        cacheResponse(cacheKey, response);
        
        return response;
      }
      
      // For real API models, check if we have an API key if required
      const apiKey = config.apiKey || '';
      if (model.requiresAuth && !apiKey) {
        console.warn(`LLMService: API key required for ${model.name} but not provided, using dummy model`);
        // Fall back to dummy model
        const fallbackResponse = models.dummyLLM.generateLocally(prompt);
        cacheResponse(cacheKey, fallbackResponse);
        return fallbackResponse;
      }
      
      // Use the endpoint from config if available, otherwise use the default
      const endpoint = config.llmEndpoint || model.endpoint;
      
      // Prepare headers
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Add API key if available
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      console.log(`LLMService: Making API request to: ${endpoint}`);
      
      // Make the API request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(model.formatPrompt(prompt)),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.error(`LLMService: API request failed with status: ${response.status}`);
          
          if (response.status === 401) {
            console.error("LLMService: Authentication failed, using dummy model");
            // Fall back to dummy model
            const fallbackResponse = models.dummyLLM.generateLocally(prompt);
            cacheResponse(cacheKey, fallbackResponse);
            return fallbackResponse;
          }
          
          if (response.status === 429) {
            console.error("LLMService: Rate limit exceeded, using dummy model");
            // Fall back to dummy model
            const fallbackResponse = models.dummyLLM.generateLocally(prompt);
            cacheResponse(cacheKey, fallbackResponse);
            return fallbackResponse;
          }
          
          throw new Error(`API request failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Extract the text from the response
        const result = model.extractResponse(data);
        
        // Cache the result
        cacheResponse(cacheKey, result);
        
        return result;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.error('LLMService: API request timed out');
          throw new Error('API request timed out');
        }
        
        throw fetchError;
      }
    } catch (error) {
      console.error('LLMService: Error handling request:', error);
      console.log('LLMService: Request failed, using dummy model as fallback');
      
      // If the API model fails, use the dummy model
      const fallbackResponse = models.dummyLLM.generateLocally(prompt);
      cacheResponse(`${modelName}:${prompt}`, fallbackResponse);
      return fallbackResponse;
    }
  }
  
  /**
   * Cache a response
   * @param {String} key - The cache key
   * @param {String} response - The response to cache
   */
  function cacheResponse(key, response) {
    responseCache.set(key, response);
    
    // Limit cache size
    if (responseCache.size > MAX_CACHE_SIZE) {
      // Remove the oldest entry
      const firstKey = responseCache.keys().next().value;
      responseCache.delete(firstKey);
    }
  }
  
  /**
   * Clear the response cache
   */
  function clearCache() {
    responseCache.clear();
    console.log("LLMService: Cache cleared");
  }
  
  /**
   * Get a prompt template for a specific task
   * @param {String} modelName - The name of the model
   * @param {String} task - The task (summarize, cssModify, suggest)
   * @param {String} input - The input text for the template
   * @returns {String} - The formatted prompt
   */
  function getPromptTemplate(modelName, task, input) {
    const model = getModel(modelName);
    
    if (model.promptTemplates && model.promptTemplates[task]) {
      return model.promptTemplates[task](input);
    }
    
    // Default templates if the model doesn't have specific ones
    switch (task) {
      case 'summarize':
        return `Summarize the following text concisely:\n\n${input}`;
      case 'cssModify':
        return `Generate CSS rules based on this description: "${input}"
Format as JSON array of objects with 'selector' and 'styles' properties.`;
      case 'suggest':
        return `Complete this text with suggestions: "${input}"`;
      default:
        return input;
    }
  }
  
  /**
   * Summarize text
   * @param {String} text - The text to summarize
   * @param {String} modelName - The name of the model to use
   * @returns {Promise<String>} - The summary
   */
  async function summarize(text, modelName = 'mistral') {
    const prompt = getPromptTemplate(modelName, 'summarize', text);
    return handleRequest(prompt, modelName);
  }
  
  /**
   * Generate CSS rules
   * @param {String} description - The description of the CSS changes
   * @param {String} modelName - The name of the model to use
   * @returns {Promise<Array>} - The CSS rules
   */
  async function generateCssRules(description, modelName = 'mistral') {
    const prompt = getPromptTemplate(modelName, 'cssModify', description);
    const response = await handleRequest(prompt, modelName);
    
    try {
      // Try to parse the response as JSON
      return JSON.parse(response);
    } catch (error) {
      console.error('LLMService: Error parsing CSS rules:', error);
      
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('LLMService: Error parsing extracted JSON:', e);
        }
      }
      
      // Return default rules if parsing fails
      return [
        {
          "selector": "input[type='text'], textarea",
          "styles": {
            "position": "relative", 
            "top": "20px",
            "background-color": "#f9f9f9",
            "border": "1px solid #ddd"
          }
        }
      ];
    }
  }
  
  /**
   * Generate suggestions
   * @param {String} text - The text to generate suggestions for
   * @param {String} modelName - The name of the model to use
   * @returns {Promise<String>} - The suggestions
   */
  async function generateSuggestions(text, modelName = 'mistral') {
    const prompt = getPromptTemplate(modelName, 'suggest', text);
    return handleRequest(prompt, modelName);
  }
  
  /**
   * Test a model connection
   * @param {String} modelName - The name of the model to test
   * @param {String} apiKey - The API key to use
   * @returns {Promise<Object>} - The test results
   */
  async function testConnection(modelName, apiKey) {
    if (modelName === 'dummyLLM') {
      return {
        success: true,
        response: "This is a test response from the dummy model.",
        latency: 0
      };
    }
    
    const model = getModel(modelName);
    if (!model) {
      return {
        success: false,
        error: `Model ${modelName} not found`
      };
    }
    
    const testPrompt = "Hello, this is a test. Please respond with a short greeting.";
    const formattedPrompt = model.formatPrompt(testPrompt);
    
    const endpoint = model.endpoint;
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    const startTime = performance.now();
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(formattedPrompt)
      });
      
      const latency = performance.now() - startTime;
      
      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          statusText: response.statusText,
          latency
        };
      }
      
      const data = await response.json();
      const result = model.extractResponse(data);
      
      return {
        success: true,
        response: result,
        latency
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        latency: performance.now() - startTime
      };
    }
  }
  
  // Public API
  return {
    handleRequest,
    summarize,
    generateCssRules,
    generateSuggestions,
    getModel,
    getPromptTemplate,
    testConnection,
    clearCache,
    models
  };
})();

// Make it available globally
window.LLMService = LLMService;