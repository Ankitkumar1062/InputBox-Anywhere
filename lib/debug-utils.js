/**
 * Debug Utilities for Custom Input Box Everywhere
 * Helps troubleshoot LLM and other integration issues
 */

const DebugUtils = (function() {
  // Debug levels
  const LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
  };
  
  // Current debug level
  let currentLevel = LEVELS.INFO;
  
  // Debug history
  const logHistory = [];
  const MAX_HISTORY = 100;
  
  // Styled console logging
  function logWithStyle(level, message, data) {
    let style = '';
    let prefix = '';
    
    switch (level) {
      case LEVELS.ERROR:
        style = 'background:#f44336;color:white;padding:2px 5px;border-radius:3px';
        prefix = '❌ ERROR';
        break;
      case LEVELS.WARN:
        style = 'background:#ff9800;color:white;padding:2px 5px;border-radius:3px';
        prefix = '⚠️ WARNING';
        break;
      case LEVELS.INFO:
        style = 'background:#2196f3;color:white;padding:2px 5px;border-radius:3px';
        prefix = 'ℹ️ INFO';
        break;
      case LEVELS.DEBUG:
        style = 'background:#4caf50;color:white;padding:2px 5px;border-radius:3px';
        prefix = '🔍 DEBUG';
        break;
      case LEVELS.TRACE:
        style = 'background:#9c27b0;color:white;padding:2px 5px;border-radius:3px';
        prefix = '🔬 TRACE';
        break;
    }
    
    // Only log if the level is less than or equal to current level
    if (level <= currentLevel) {
      if (data) {
        console.log(`%c ${prefix} ${message}`, style, data);
      } else {
        console.log(`%c ${prefix} ${message}`, style);
      }
    }
    
    // Store in history
    const logEntry = {
      timestamp: new Date(),
      level,
      message,
      data
    };
    
    logHistory.unshift(logEntry);
    
    // Trim history if too large
    if (logHistory.length > MAX_HISTORY) {
      logHistory.pop();
    }
    
    return logEntry;
  }
  
  // Exposed logging methods
  function error(message, data) {
    return logWithStyle(LEVELS.ERROR, message, data);
  }
  
  function warn(message, data) {
    return logWithStyle(LEVELS.WARN, message, data);
  }
  
  function info(message, data) {
    return logWithStyle(LEVELS.INFO, message, data);
  }
  
  function debug(message, data) {
    return logWithStyle(LEVELS.DEBUG, message, data);
  }
  
  function trace(message, data) {
    return logWithStyle(LEVELS.TRACE, message, data);
  }
  
  // Set debug level
  function setLevel(level) {
    if (typeof level === 'string') {
      level = LEVELS[level.toUpperCase()] || LEVELS.INFO;
    }
    
    currentLevel = level;
    info(`Debug level set to: ${Object.keys(LEVELS).find(key => LEVELS[key] === level)}`);
  }
  
  // Get debug history
  function getHistory() {
    return [...logHistory];
  }
  
  // Clear debug history
  function clearHistory() {
    logHistory.length = 0;
    info('Debug history cleared');
  }
  
  // LLM specific debug helpers
  function testLLMConnection(model = 'dummyLLM', apiKey = '') {
    info(`Testing LLM connection for model: ${model}`);
    
    // Define a simple test prompt
    const testPrompt = 'Hello, this is a test prompt. Please respond with a short greeting.';
    
    // Get the appropriate endpoint
    let endpoint = '';
    let headers = {
      'Content-Type': 'application/json'
    };
    
    // Set up basic request info
    if (model === 'mistral') {
      endpoint = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    } else if (model === 'gpt2') {
      endpoint = 'https://api-inference.huggingface.co/models/gpt2';
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    } else if (model === 't5') {
      endpoint = 'https://api-inference.huggingface.co/models/t5-small';
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    } else if (model === 'dummyLLM') {
      info('Using dummy model (local generation)');
      return Promise.resolve({
        success: true,
        response: "This is a test response from the dummy model.",
        latency: 0
      });
    }
    
    // Make the test request
    const startTime = performance.now();
    
    return fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ inputs: testPrompt })
    })
    .then(response => {
      const latency = performance.now() - startTime;
      
      if (!response.ok) {
        error(`LLM connection test failed with status: ${response.status}`, {
          endpoint,
          statusText: response.statusText,
          latency: `${latency.toFixed(2)}ms`
        });
        
        return {
          success: false,
          status: response.status,
          statusText: response.statusText,
          latency
        };
      }
      
      return response.json().then(data => {
        info(`LLM connection test successful`, {
          endpoint,
          latency: `${latency.toFixed(2)}ms`,
          responsePreview: JSON.stringify(data).substring(0, 100) + '...'
        });
        
        return {
          success: true,
          response: data,
          latency
        };
      });
    })
    .catch(err => {
      error(`LLM connection test failed with error:`, err);
      
      return {
        success: false,
        error: err.message,
        latency: performance.now() - startTime
      };
    });
  }
  
  // Create diagnostic report
  function createDiagnosticReport() {
    const report = {
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      logHistory: getHistory(),
      extensionInfo: {}
    };
    
    // Try to get extension info
    try {
      if (browser && browser.runtime) {
        browser.runtime.getManifest().then(manifest => {
          report.extensionInfo.manifest = manifest;
          info('Diagnostic report created', report);
          return report;
        });
      } else {
        info('Diagnostic report created', report);
        return Promise.resolve(report);
      }
    } catch (e) {
      info('Diagnostic report created', report);
      return Promise.resolve(report);
    }
  }
  
  // Public API
  return {
    LEVELS,
    error,
    warn,
    info,
    debug,
    trace,
    setLevel,
    getHistory,
    clearHistory,
    testLLMConnection,
    createDiagnosticReport
  };
})();

// Make it available globally
window.DebugUtils = DebugUtils;