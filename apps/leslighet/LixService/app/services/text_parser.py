"""
Parser for breaking text into sentences, words, and paragraphs.
Uses regular expressions for text processing with optimized performance.
"""
import re
from typing import List, Dict, Tuple
from functools import lru_cache

class TextParser:
    """
    Parser for breaking text into sentences, words, and paragraphs.
    Uses regular expressions for text processing with optimized performance.
    """
    
    def __init__(self):
        # Pre-compile regex patterns for better performance
        self._sentence_pattern = re.compile(r'(?<=[.!?])\s+', re.UNICODE)
        self._word_pattern = re.compile(r'\b[a-zA-ZæøåÆØÅ0-9]+\b', re.UNICODE)
        self._paragraph_pattern = re.compile(r'\n\s*\n')
        self._long_word_pattern = re.compile(r'\b\w{6,}\b', re.UNICODE)
        self._very_long_word_pattern = re.compile(r'\b\w{10,}\b', re.UNICODE)
        # Cache for processed texts
        self._cache = {}
        
    @lru_cache(maxsize=256)
    def split_sentences(self, text: str) -> List[str]:
        """Split text into sentences with caching for repeated text."""
        if not text:
            return []
        # Use the pre-compiled pattern for better performance
        sentences = self._sentence_pattern.split(text.strip())
        # Filter out empty sentences
        return [s for s in sentences if s.strip()]
    
    @lru_cache(maxsize=256)
    def split_words(self, text: str) -> List[str]:
        """Split text into words, removing punctuation and special characters."""
        if not text:
            return []
        # Use the pre-compiled pattern for better performance
        words = self._word_pattern.findall(text.lower())
        return [w for w in words if w]
    
    @lru_cache(maxsize=128)
    def split_paragraphs(self, text: str) -> List[str]:
        """Split text into paragraphs."""
        if not text:
            return []
        # Use the pre-compiled pattern for better performance
        paragraphs = self._paragraph_pattern.split(text.strip())
        return [p for p in paragraphs if p.strip()]
    
    def count_long_words(self, text: str, min_length: int = 6) -> int:
        """Count long words in text without generating full list for better performance."""
        if not text:
            return 0
        
        pattern = self._long_word_pattern if min_length == 6 else \
                 self._very_long_word_pattern if min_length == 10 else \
                 re.compile(rf'\b\w{{{min_length},}}\b', re.UNICODE)
                 
        return len(pattern.findall(text.lower()))
        
    def parse_text(self, text: str) -> Dict[str, any]:
        """
        Parse text into sentences, words, and paragraphs in a single operation.
        Uses caching to avoid reprocessing the same text.
        """
        # Create a hash of the text to use as a cache key
        text_hash = hash(text)
        
        # Return cached result if available
        if text_hash in self._cache:
            return self._cache[text_hash]
            
        # Process the text
        sentences = self.split_sentences(text)
        words = self.split_words(text)
        paragraphs = self.split_paragraphs(text)
        
        # Store the result in cache
        result = {
            'sentences': sentences,
            'words': words,
            'paragraphs': paragraphs,
            'long_words_count': self.count_long_words(text),
            'very_long_words_count': self.count_long_words(text, 10)
        }
        self._cache[text_hash] = result
        
        return result
        
    def clear_cache(self):
        """Clear all internal caches to free memory."""
        self._cache.clear()
        self.split_sentences.cache_clear()
        self.split_words.cache_clear()
        self.split_paragraphs.cache_clear()