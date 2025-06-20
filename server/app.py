from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
import re
from typing import Optional
from llama_cpp import Llama

app = FastAPI(title="Floating Input Box LLM Server")

# Configure CORS for extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load TinyLlama model
try:
    model = Llama(
        model_path="tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
        n_ctx=2048,  # Maximum context window
        n_threads=4
    )
    logger.info("Model loaded successfully")
except Exception as e:
    logger.error(f"Failed to load model: {e}")
    model = None

# Constants
MAX_TEXT_LENGTH = 800  # Be very conservative with input text
RESERVED_TOKENS = 500  # Reserve tokens for system prompts and generation

class TextRequest(BaseModel):
    text: str
    action: str = "summarize"  # summarize or suggest_css

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return {
        "status": "ok",
        "model_loaded": model is not None
    }

@app.post("/process")
async def process_text(request: TextRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # Log the original text length
        logger.info(f"Original text length: {len(request.text)} characters")
        
        # Process text to fit in context window
        processed_text = smart_truncate_text(request.text, MAX_TEXT_LENGTH)
        logger.info(f"Processed text length: {len(processed_text)} characters")
        
        if request.action == "summarize":
            return await summarize_text(processed_text)
        elif request.action == "suggest_css":
            return await suggest_css(processed_text)
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
    except Exception as e:
        logger.error(f"Error processing request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def smart_truncate_text(text: str, max_length: int) -> str:
    """
    Intelligently truncate text to fit within context window.
    This function extracts important parts and removes less important content.
    """
    if len(text) <= max_length:
        return text
    
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    if len(text) <= max_length:
        return text
    
    # Extract important sentences (first sentences, sentences with keywords)
    sentences = re.split(r'(?<=[.!?])\s+', text)
    
    # Keywords that might indicate important content
    keywords = ['important', 'key', 'main', 'crucial', 'significant', 'essential']
    
    # Score sentences by position and keywords
    scored_sentences = []
    for i, sentence in enumerate(sentences):
        # Position score - beginning and end sentences are more important
        position_score = 1.0
        if i < len(sentences) // 10:  # First 10%
            position_score = 2.0
        elif i >= len(sentences) * 0.9:  # Last 10%
            position_score = 1.5
            
        # Keyword score
        keyword_score = 1.0
        if any(keyword in sentence.lower() for keyword in keywords):
            keyword_score = 2.0
            
        # Length penalty - prefer shorter sentences when truncating
        length_penalty = min(1.0, 20.0 / len(sentence)) if len(sentence) > 0 else 0
        
        total_score = position_score * keyword_score * length_penalty
        scored_sentences.append((sentence, total_score))
    
    # Sort sentences by score (descending)
    scored_sentences.sort(key=lambda x: x[1], reverse=True)
    
    # Take top sentences until we reach the max length
    important_text = ""
    for sentence, _ in scored_sentences:
        if len(important_text) + len(sentence) + 1 <= max_length:
            important_text += sentence + " "
        else:
            break
    
    # If we still have space, add some of the beginning and end of original text
    if len(important_text) < max_length:
        remaining = max_length - len(important_text)
        beginning = text[:remaining//2]
        ending = text[-remaining//2:] if remaining//2 > 0 else ""
        
        # Only add if they're not already in important_text
        if beginning and beginning not in important_text:
            important_text = beginning + "... " + important_text
        if ending and ending not in important_text:
            important_text = important_text + "... " + ending
    
    return important_text.strip()

async def summarize_text(text: str):
    # Extremely concise prompt to save tokens
    prompt = f"""<|im_start|>system
Summarize briefly.
<|im_end|>

<|im_start|>user
{text}
<|im_end|>

<|im_start|>assistant
"""
    
    try:
        # First check token count
        token_count = count_tokens(prompt)
        logger.info(f"Token count for prompt: {token_count}")
        
        if token_count > 2048 - RESERVED_TOKENS:
            # Further truncate text if needed
            text_length = len(text)
            new_length = int(text_length * 0.6)  # Reduce by 40%
            text = text[:new_length] + "..."
            
            # Recreate prompt with shortened text
            prompt = f"""<|im_start|>system
Summarize briefly.
<|im_end|>

<|im_start|>user
{text}
<|im_end|>

<|im_start|>assistant
"""
            token_count = count_tokens(prompt)
            logger.info(f"Reduced token count: {token_count}")
        
        response = model.create_completion(
            prompt,
            max_tokens=150,  # Reduced from 200
            temperature=0.7,
            top_p=0.95,
            stop=["<|im_end|>"]
        )
        
        summary = response['choices'][0]['text'].strip()
        
        return {
            "summary": summary,
            "css_suggestions": None
        }
    except Exception as e:
        logger.error(f"Error in summarize_text: {e}")
        return {
            "summary": "Error generating summary. The text might be too long or complex.",
            "css_suggestions": None
        }

async def suggest_css(text: str):
    # Minimal prompt
    prompt = f"""<|im_start|>system
Suggest CSS improvements.
<|im_end|>

<|im_start|>user
{text}
<|im_end|>

<|im_start|>assistant
```css
"""
    
    try:
        # Check token count
        token_count = count_tokens(prompt)
        logger.info(f"Token count for CSS prompt: {token_count}")
        
        if token_count > 2048 - RESERVED_TOKENS:
            # Further truncate text if needed
            text_length = len(text)
            new_length = int(text_length * 0.5)  # Reduce by 50%
            text = text[:new_length] + "..."
            
            # Recreate prompt with shortened text
            prompt = f"""<|im_start|>system
Suggest CSS improvements.
<|im_end|>

<|im_start|>user
{text}
<|im_end|>

<|im_start|>assistant
```css
"""
            token_count = count_tokens(prompt)
            logger.info(f"Reduced CSS token count: {token_count}")
        
        response = model.create_completion(
            prompt,
            max_tokens=200,
            temperature=0.7,
            top_p=0.95,
            stop=["```", "<|im_end|>"]
        )
        
        css_suggestions = response['choices'][0]['text'].strip()
        
        return {
            "summary": None,
            "css_suggestions": css_suggestions
        }
    except Exception as e:
        logger.error(f"Error in suggest_css: {e}")
        return {
            "summary": None,
            "css_suggestions": "/* Error generating CSS suggestions. */"
        }

def count_tokens(text: str) -> int:
    """
    Count tokens in text using the model's tokenizer.
    This is more accurate than character-based approximations.
    """
    if model is None:
        # Fallback to rough approximation
        return len(text) // 3
    
    try:
        # Use the model's tokenizer if available
        token_count = model.tokenize(text.encode())
        return len(token_count)
    except:
        # Fallback to rough approximation if tokenize fails
        return len(text) // 3

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)