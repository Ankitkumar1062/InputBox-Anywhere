"""
Advanced fallback processor for handling extremely long texts
This can be integrated into app.py or used as a separate module.
"""

from typing import List, Dict
import re

class TextChunker:
    def __init__(self, max_chunk_size: int = 400):
        self.max_chunk_size = max_chunk_size
    
    def split_into_chunks(self, text: str) -> List[str]:
        """Split text into manageable chunks for processing"""
        # First try to split by natural paragraph breaks
        paragraphs = re.split(r'\n\s*\n', text)
        
        chunks = []
        current_chunk = ""
        
        for paragraph in paragraphs:
            # If this paragraph would make the chunk too large
            if len(current_chunk) + len(paragraph) > self.max_chunk_size:
                # If current chunk is not empty, add it to chunks
                if current_chunk:
                    chunks.append(current_chunk)
                
                # If paragraph itself is too large, split it into sentences
                if len(paragraph) > self.max_chunk_size:
                    sentences = re.split(r'(?<=[.!?])\s+', paragraph)
                    current_chunk = ""
                    
                    for sentence in sentences:
                        if len(current_chunk) + len(sentence) > self.max_chunk_size:
                            if current_chunk:
                                chunks.append(current_chunk)
                            
                            # If sentence itself is too large, just truncate it
                            if len(sentence) > self.max_chunk_size:
                                chunks.append(sentence[:self.max_chunk_size])
                            else:
                                current_chunk = sentence
                        else:
                            if current_chunk:
                                current_chunk += " "
                            current_chunk += sentence
                else:
                    current_chunk = paragraph
            else:
                if current_chunk:
                    current_chunk += "\n\n"
                current_chunk += paragraph
        
        # Add the last chunk if not empty
        if current_chunk:
            chunks.append(current_chunk)
        
        return chunks
    
    async def process_chunks(self, chunks: List[str], process_func) -> str:
        """Process each chunk and combine results"""
        results = []
        
        for chunk in chunks:
            chunk_result = await process_func(chunk)
            results.append(chunk_result)
        
        # Combine results
        combined = "\n\n".join(results)
        
        # If combined result is still too long, summarize it again
        if len(combined) > self.max_chunk_size * 2:
            return await process_func(combined[:self.max_chunk_size * 2])
        
        return combined