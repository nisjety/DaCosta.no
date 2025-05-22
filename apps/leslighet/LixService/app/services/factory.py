"""
Factory service for creating text processing components.
Provides a centralized way to instantiate and configure various text processors.
"""
from typing import Dict, Any, Optional
import logging

from app.services.text_parser import TextParser
from app.services.word_analyzer import WordAnalyzer
from app.services.sentence_analyzer import SentenceAnalyzer
from app.services.readability import ReadabilityService
from app.services.enhanced_readability import EnhancedReadabilityService
from app.services.recommendations import ReadabilityRecommender
from app.services.metrics import LixMetric, RixMetric

# Singleton cache for service instances
_service_instances: Dict[str, Any] = {}

def get_text_parser(config: Optional[Dict[str, Any]] = None) -> TextParser:
    """
    Get or create a TextParser instance.
    
    Args:
        config: Optional configuration parameters for the parser
        
    Returns:
        Configured TextParser instance
    """
    if 'text_parser' not in _service_instances:
        _service_instances['text_parser'] = TextParser()
    return _service_instances['text_parser']

def get_word_analyzer(config: Optional[Dict[str, Any]] = None) -> WordAnalyzer:
    """
    Get or create a WordAnalyzer instance.
    
    Args:
        config: Optional configuration parameters
        
    Returns:
        Configured WordAnalyzer instance
    """
    if 'word_analyzer' not in _service_instances:
        _service_instances['word_analyzer'] = WordAnalyzer()
    return _service_instances['word_analyzer']

def get_sentence_analyzer(config: Optional[Dict[str, Any]] = None) -> SentenceAnalyzer:
    """
    Get or create a SentenceAnalyzer instance.
    
    Args:
        config: Optional configuration parameters
        
    Returns:
        Configured SentenceAnalyzer instance
    """
    if 'sentence_analyzer' not in _service_instances:
        _service_instances['sentence_analyzer'] = SentenceAnalyzer()
    return _service_instances['sentence_analyzer']

def get_readability_service(config: Optional[Dict[str, Any]] = None) -> ReadabilityService:
    """
    Get or create a ReadabilityService instance.
    
    Args:
        config: Optional configuration parameters
        
    Returns:
        Configured ReadabilityService instance
    """
    if 'readability_service' not in _service_instances:
        _service_instances['readability_service'] = ReadabilityService(config or {})
    return _service_instances['readability_service']

def get_recommender(config: Optional[Dict[str, Any]] = None) -> ReadabilityRecommender:
    """
    Get or create a ReadabilityRecommender instance.
    
    Args:
        config: Optional configuration parameters
        
    Returns:
        Configured ReadabilityRecommender instance
    """
    if 'text_recommender' not in _service_instances:
        _service_instances['text_recommender'] = ReadabilityRecommender()
    return _service_instances['text_recommender']

def get_lix_metric(config: Optional[Dict[str, Any]] = None) -> LixMetric:
    """
    Get or create a LIX metric instance.
    
    Args:
        config: Optional configuration parameters
        
    Returns:
        Configured LixMetric instance
    """
    if 'lix_metric' not in _service_instances:
        _service_instances['lix_metric'] = LixMetric()
    return _service_instances['lix_metric']

def get_rix_metric(config: Optional[Dict[str, Any]] = None) -> RixMetric:
    """
    Get or create a RIX metric instance.
    
    Args:
        config: Optional configuration parameters
        
    Returns:
        Configured RixMetric instance
    """
    if 'rix_metric' not in _service_instances:
        _service_instances['rix_metric'] = RixMetric()
    return _service_instances['rix_metric']

def reset_instances() -> None:
    """Clear all cached service instances. Useful for testing."""
    global _service_instances
    _service_instances = {}
    
def get_enhanced_readability_service(config: Optional[Dict[str, Any]] = None) -> EnhancedReadabilityService:
    """
    Get or create an EnhancedReadabilityService instance.
    
    Args:
        config: Optional configuration parameters
        
    Returns:
        Configured EnhancedReadabilityService instance
    """
    from app.services.enhanced_readability import EnhancedReadabilityService, enhanced_readability_service
    
    # Use the singleton instance from the module
    return enhanced_readability_service