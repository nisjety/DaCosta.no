"""
Optimized Readability Service for fast text analysis.
Calculates LIX and RIX readability scores with performance optimizations.
"""
import re
from typing import Dict, Any, List, Optional, Tuple
from functools import lru_cache

from app.services.metrics import LixMetric, RixMetric

class ReadabilityService:
    """
    Service for analyzing text readability using LIX and RIX metrics.
    Optimized for fast calculation and real-time usage.
    """
    
    # Pre-compile regex patterns for better performance
    _SENTENCE_PATTERN = re.compile(r'[.!?]+["»]?|\n\n')
    _WORD_PATTERN = re.compile(r'\w+')
    
    # Initialize metrics once as class variables
    _lix_metric = LixMetric()
    _rix_metric = RixMetric()
    
    # Result cache (limited to 1000 entries to manage memory)
    _result_cache = {}
    _MAX_CACHE_SIZE = 1000
    
    # Define readability categories for consistent reference
    _CATEGORIES = ['svært lett', 'lett', 'middels', 'vanskelig', 'svært vanskelig']
    
    @classmethod
    @lru_cache(maxsize=256)  # Cache small, common texts
    def _extract_words(cls, text: str) -> List[str]:
        """
        Extract words from text using regex for better performance.
        
        Args:
            text: Text to extract words from
            
        Returns:
            List of words
        """
        return cls._WORD_PATTERN.findall(text)
    
    @classmethod
    @lru_cache(maxsize=256)  # Cache sentence count for small texts
    def _get_sentence_count(cls, text: str) -> int:
        """
        Count sentences in text using optimized regex.
        
        Args:
            text: Text to count sentences in
            
        Returns:
            Number of sentences
        """
        # Handle empty text
        if not text or text.isspace():
            return 0
            
        # Split by sentence-ending punctuation
        sentences = cls._SENTENCE_PATTERN.split(text)
        
        # Filter out empty strings
        sentences = [s for s in sentences if s and not s.isspace()]
        
        # Ensure we have at least one sentence
        return max(1, len(sentences))
    
    @classmethod
    def _get_cache_key(cls, text: str) -> str:
        """
        Generate a compact cache key for a text.
        
        Args:
            text: The text to generate a key for
            
        Returns:
            A cache key string
        """
        # Use first 100 chars + length as a simple but effective cache key
        text_preview = text[:100].strip()
        return f"{text_preview}_{len(text)}"
    
    @classmethod
    def get_readability(cls, text: str) -> Dict[str, Any]:
        """
        Get readability metrics for a text.
        
        Args:
            text: Text to analyze
            
        Returns:
            Dictionary with LIX and RIX scores and classifications
        """
        # Check cache first
        cache_key = cls._get_cache_key(text)
        if cache_key in cls._result_cache:
            return cls._result_cache[cache_key]
            
        # Handle empty text
        if not text or text.isspace():
            return {
                "lix": {
                    "score": 0,
                    "category": "ikke tilgjengelig",
                    "description": "Teksten er tom eller inneholder ikke setninger.",
                },
                "rix": {
                    "score": 0,
                    "category": "ikke tilgjengelig",
                    "description": "Teksten er tom eller inneholder ikke setninger.",
                },
                "combined_description": "Teksten er for kort for analyse."
            }
            
        # Extract words and count sentences in one pass when possible
        words = cls._extract_words(text)
        sentence_count = cls._get_sentence_count(text)
        
        # Calculate LIX score
        lix_score = cls._lix_metric.compute(words, sentence_count)
        lix_classification = cls._lix_metric.classify(lix_score)
        
        # Calculate RIX score
        rix_score = cls._rix_metric.compute(words, sentence_count)
        rix_classification = cls._rix_metric.classify(rix_score)
        
        # Create text statistics for both metrics to use
        word_count = len(words)
        long_words = [word for word in words if len(word) > 6]
        long_words_count = len(long_words)
        
        text_statistics = {
            "word_count": word_count,
            "sentence_count": sentence_count,
            "avg_sentence_length": round(word_count / max(1, sentence_count), 1),
            "long_words_count": long_words_count,
            "long_words_percentage": round((long_words_count / max(1, word_count)) * 100, 1)
        }
        
        # Build combined description based on both metrics
        combined_description = cls._generate_combined_description(
            lix_score, rix_score, lix_classification, rix_classification
        )
        
        # Build complete result
        result = {
            "lix": {
                "score": lix_score,
                "category": lix_classification["category"],
                "description": lix_classification["description"],
                "audience": lix_classification["audience"],
                "improvement_tips": lix_classification["improvement_tips"]
            },
            "rix": {
                "score": rix_score,
                "category": rix_classification["category"],
                "description": rix_classification["description"],
                "audience": rix_classification["audience"],
                "improvement_tips": rix_classification["improvement_tips"]
            },
            "combined_description": combined_description,
            "text_statistics": text_statistics
        }
        
        # Cache result
        if len(cls._result_cache) >= cls._MAX_CACHE_SIZE:
            # Simple cache eviction: clear oldest 25% of entries when full
            keys = list(cls._result_cache.keys())
            for key in keys[:cls._MAX_CACHE_SIZE // 4]:
                cls._result_cache.pop(key, None)
        
        cls._result_cache[cache_key] = result
        return result
    
    @staticmethod
    def _generate_combined_description(
        lix_score: float, 
        rix_score: float,
        lix_classification: Dict[str, Any],
        rix_classification: Dict[str, Any]
    ) -> str:
        """
        Generate a combined description based on LIX and RIX scores.
        
        Args:
            lix_score: LIX score
            rix_score: RIX score
            lix_classification: LIX classification data
            rix_classification: RIX classification data
            
        Returns:
            Combined description
        """
        # Use a simplified approach for combined descriptions
        # Map category combinations to predetermined descriptions
        lix_category = lix_classification['category']
        rix_category = rix_classification['category']
        
        # Fast lookup for common combinations
        if lix_category == rix_category:
            if lix_category == 'svært lett':
                return 'Teksten er konsistent svært lettlest og tilgjengelig for alle lesere.'
            elif lix_category == 'lett':
                return 'Teksten er konsistent lettlest med god balanse mellom korte og lange ord.'
            elif lix_category == 'middels':
                return 'Teksten har middels vanskelighetsgrad, med en del lange ord og setninger.'
            elif lix_category == 'vanskelig':
                return 'Teksten er konsistent krevende med mange lange ord og komplekse setninger.'
            else:  # svært vanskelig
                return 'Teksten er konsistent svært krevende med høy andel lange ord og komplekse setninger.'
        
        # Mixed categories - simplified version for performance
        categories = ReadabilityService._CATEGORIES  # Use the class-level constant
        
        try:
            lix_level = categories.index(lix_category)
            rix_level = categories.index(rix_category)
            
            diff = abs(lix_level - rix_level)
            
            if diff <= 1:
                return f'Teksten er i hovedsak {lix_category} til {rix_category}, med en balansert vanskelighetsgrad.'
            else:
                # Only calculate this for significant differences
                if lix_score > 40 and rix_score < 2.5:
                    return 'Teksten har mange korte setninger, men med en del lange ord. Setningsoppbyggingen er enkel, men ordvalget kan gjøre teksten utfordrende.'
                elif lix_score < 30 and rix_score > 3.5:
                    return 'Teksten har relativt korte ord, men setningene er lange. Vurder å dele opp setninger for bedre lesbarhet.'
                else:
                    return f'Teksten har blandede resultater: LIX-analysen viser {lix_category}, mens RIX-analysen viser {rix_category}.'
        except ValueError:
            # Fallback in case any category isn't in the expected list
            return f'Teksten har varierende lesbarhet: LIX-nivå {lix_category}, RIX-nivå {rix_category}.'