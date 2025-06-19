/**
 * Groq API integration for Custom Input Box Everywhere
 * Last updated: 2025-06-18 12:47:57
 * Author: Ankitkumar1062
 */

// Test the API connection
async function testGrokApiConnection(apiKey) {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    console.log('Testing connection to Groq API');
    
    // Call through background script
    const response = await browser.runtime.sendMessage({
      type: 'DIRECT_GROQ_TEST',
      apiKey
    });
    
    if (!response || !response.success) {
      throw new Error(response?.error || 'Unknown connection error');
    }
    
    return true;
  } catch (error) {
    console.error('Groq API connection test failed:', error);
    throw error;
  }
}

// Summarize text using Groq API
async function grokApiSummarize(text, apiKey) {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    console.log('Sending summarization request to Groq API');
    
    const response = await browser.runtime.sendMessage({
      type: 'DIRECT_GROQ_REQUEST',
      apiKey,
      body: {
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: "Summarize the following text in a concise way."
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 300
      }
    });
    
    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to summarize text');
    }
    
    return response.data.choices[0]?.message?.content || "Summary not available";
  } catch (error) {
    console.error('Groq API summarization error:', error);
    throw new Error(`Summarization failed: ${error.message}`);
  }
}

// Enhance text using Groq API
async function grokApiEnhance(text, apiKey) {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    console.log('Sending enhancement request to Groq API');
    
    const response = await browser.runtime.sendMessage({
      type: 'DIRECT_GROQ_REQUEST',
      apiKey,
      body: {
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: "You are an expert editor. Improve the grammar, clarity, and tone of the user's text while preserving their meaning."
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.7
      }
    });
    
    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to enhance text');
    }
    
    return response.data.choices[0]?.message?.content || "Enhancement not available";
  } catch (error) {
    console.error('Groq API enhancement error:', error);
    throw new Error(`Enhancement failed: ${error.message}`);
  }
}

// Get text suggestion using Groq API
async function grokApiGetSuggestion(text, apiKey) {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    console.log('Sending suggestion request to Groq API');
    
    const response = await browser.runtime.sendMessage({
      type: 'DIRECT_GROQ_REQUEST',
      apiKey,
      body: {
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: "Continue the user's text with a relevant suggestion."
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 50,
        temperature: 0.7,
      }
    });
    
    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to get suggestion');
    }
    
    return response.data.choices[0]?.message?.content || "Suggestion not available";
  } catch (error) {
    console.error('Groq API suggestion error:', error);
    throw new Error(`Getting suggestion failed: ${error.message}`);
  }
}

// Generate CSS using Groq API
async function grokApiGenerateCSS(instructions, pageStructure, apiKey) {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    console.log('Sending CSS generation request to Groq API');
    
    // Create a prompt for CSS generation
    const prompt = `
      I need CSS modifications for a webpage with the following structure:
      
      URL: ${pageStructure.url}
      Title: ${pageStructure.title}
      
      Main elements:
      ${JSON.stringify(pageStructure.elements, null, 2)}
      
      User wants to: "${instructions}"
      
      Please provide ONLY valid CSS code (no explanations) that would implement these changes. 
      The CSS should be safe, not break the page layout, and focus on the user's request.
    `;
    
    const response = await browser.runtime.sendMessage({
      type: 'DIRECT_GROQ_REQUEST',
      apiKey,
      body: {
        model: "llama3-8b-8192",
        messages: [
          {
            role: 'system',
            content: 'You are a CSS expert assistant. Respond only with valid CSS code.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2
      }
    });
    
    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to generate CSS');
    }
    
    // Extract CSS from the response
    let cssCode = response.data.choices[0]?.message?.content || "";
    
    // If the response includes markdown code blocks, extract just the CSS
    if (cssCode.includes('```css')) {
      cssCode = cssCode.split('```css')[1].split('```')[0].trim();
    } else if (cssCode.includes('```')) {
      cssCode = cssCode.split('```')[1].split('```')[0].trim();
    }
    
    // Add a comment to identify this CSS
    cssCode = `/* Custom Input Box Extension - Generated CSS */\n/* Instructions: ${instructions} */\n\n${cssCode}`;
    
    return cssCode;
  } catch (error) {
    console.error('Groq API CSS generation error:', error);
    throw new Error(`CSS generation failed: ${error.message}`);
  }
}