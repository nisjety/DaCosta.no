from collections import Counter
from typing import Dict, List, Any
from app.services.factory import (
    get_text_parser, get_word_analyzer, get_sentence_analyzer,
    get_lix_metric, get_rix_metric
)

class TextAnalysisService:
    """
    Comprehensive service for text analysis with advanced readability metrics.
    
    This service uses composition of specialized components for a SOLID design,
    integrating multiple analysis techniques:
    - Sentence structure analysis
    - Word complexity metrics
    - Readability scoring (LIX and RIX)
    """
    
    @staticmethod
    def analyze_text(text: str, simple_mode: bool = False) -> Dict[str, Any]:
        """
        Perform comprehensive text analysis with improved metrics, readability, and insights.
        
        Args:
            text: The text to analyze
            simple_mode: If True, perform simplified analysis for better performance
            
        Returns:
            Comprehensive analysis results including statistics, readability metrics, 
            sentence and word analysis
        """
        # Get service components
        parser = get_text_parser()
        word_analyzer = get_word_analyzer()
        lix_metric = get_lix_metric()
        rix_metric = get_rix_metric()
        sentence_analyzer = get_sentence_analyzer()
        
        # Skip analysis if text is empty
        if not text.strip():
            return {
                "statistics": {
                    "word_count": 0,
                    "sentence_count": 0,
                    "paragraph_count": 0,
                    "avg_word_length": 0,
                    "avg_sentence_length": 0,
                    "long_words_percentage": 0,
                    "very_long_words_percentage": 0,
                    "readability_score": 0
                },
                "word_analysis": [],
                "sentence_analysis": []
            }
        
        # Split text into components - calculate once and reuse
        words = parser.split_words(text)
        sentences = parser.split_sentences(text)
        paragraphs = parser.split_paragraphs(text)
        
        # Basic statistics
        num_words = len(words)
        num_sentences = len(sentences)
        num_paragraphs = len(paragraphs)
        
        # Word length analysis
        word_lengths = [len(word) for word in words]
        avg_word_length = round(sum(word_lengths) / num_words, 2) if num_words else 0
        
        # Sentence length analysis
        avg_sentence_length = round(num_words / num_sentences, 2) if num_sentences else 0
        
        # Long words analysis - calculate once and reuse
        long_words = word_analyzer.get_long_words(words)
        long_words_count = len(long_words)
        long_words_percentage = round((long_words_count / num_words) * 100, 2) if num_words else 0
        
        # Very long words analysis
        very_long_words = word_analyzer.get_long_words(words, 10)
        very_long_words_count = len(very_long_words)
        very_long_words_percentage = round((very_long_words_count / num_words) * 100, 2) if num_words else 0
        
        # Calculate readability metrics once
        lix_score = lix_metric.compute(words, num_sentences)
        rix_score = rix_metric.compute(words, num_sentences)
        
        # Basic statistics for all modes
        statistics = {
            "word_count": num_words,
            "sentence_count": num_sentences,
            "paragraph_count": num_paragraphs,
            "avg_word_length": avg_word_length,
            "avg_sentence_length": avg_sentence_length,
            "long_words_percentage": long_words_percentage,
            "very_long_words_percentage": very_long_words_percentage,
            "readability_score": lix_score,  # Use LIX as the primary readability score
            "long_words_count": long_words_count
        }
        
        # For simple mode, return only basic statistics
        if simple_mode:
            return {
                "statistics": statistics,
                "word_analysis": [],
                "sentence_analysis": []
            }
            
        # Detailed analysis mode below
        # Word frequency analysis
        word_frequency = Counter(word.lower() for word in words)
        most_common_words = word_frequency.most_common(15)
        
        # Add sentence lengths to word_frequency for relative position calculations
        for i, sentence in enumerate(sentences):
            sent_words = parser.split_words(sentence)
            word_frequency[f"__sentence_{i}_length"] = len(sent_words)
        
        # Sentence analysis - reusing already calculated metrics
        sentence_analysis = []
        for i, sentence in enumerate(sentences):
            sent_words = parser.split_words(sentence)
            sent_result = sentence_analyzer.analyze_sentence(sentence, i, sent_words)
            sentence_analysis.append(sent_result)
        
        # Word analysis with enhanced features
        word_analysis = []
        sentence_index = 0
        word_pos_in_sentence = 0
        
        for i, word in enumerate(words):
            # Track position within sentences
            if i > 0 and word_pos_in_sentence == 0:
                sentence_index += 1
                
            word_analysis.append(
                word_analyzer.analyze_word(
                    word, i, sentence_index, 
                    word_pos_in_sentence, word_frequency
                )
            )
            
            word_pos_in_sentence += 1
            
            # Reset word position counter when at sentence end
            if sentence_index < len(sentences) and word_pos_in_sentence >= len(parser.split_words(sentences[sentence_index])):
                word_pos_in_sentence = 0
        
        # Add advanced statistics for detailed mode
        statistics.update({
            "word_length_distribution": dict(Counter(word_lengths)),
            "sentence_length_distribution": dict(Counter(len(parser.split_words(s)) for s in sentences)),
            "most_common_words": most_common_words,
            "unique_words_count": len(word_frequency),
            "unique_words_percentage": round((len(word_frequency) / num_words) * 100, 2) if num_words else 0
        })
        
        # Combine everything into a comprehensive result
        return {
            "statistics": statistics,
            "sentence_analysis": sentence_analysis,
            "word_analysis": word_analysis[:200]  # Limit to first 200 words for performance
        }

    @staticmethod
    def get_basic_statistics(text: str) -> Dict[str, Any]:
        """
        Get basic text statistics without detailed analysis.
        Optimized for real-time analysis during typing.
        
        Args:
            text: The text to analyze
            
        Returns:
            Dictionary with basic statistics only
        """
        # Get service components
        parser = get_text_parser()
        word_analyzer = get_word_analyzer()
        lix_metric = get_lix_metric()
        
        # Skip analysis if text is empty
        if not text.strip():
            return {
                "statistics": {
                    "word_count": 0,
                    "sentence_count": 0,
                    "paragraph_count": 0,
                    "avg_word_length": 0,
                    "avg_sentence_length": 0,
                    "long_words_percentage": 0,
                    "very_long_words_percentage": 0,
                    "readability_score": 0
                }
            }
        
        # Split text into components
        words = parser.split_words(text)
        sentences = parser.split_sentences(text)
        paragraphs = parser.split_paragraphs(text)
        
        # Basic statistics
        num_words = len(words)
        num_sentences = len(sentences)
        num_paragraphs = len(paragraphs)
        
        # Word length analysis
        avg_word_length = round(sum(len(word) for word in words) / num_words, 2) if num_words else 0
        
        # Sentence length analysis
        avg_sentence_length = round(num_words / num_sentences, 2) if num_sentences else 0
        
        # Long words analysis
        long_words = word_analyzer.get_long_words(words)
        long_words_count = len(long_words)
        long_words_percentage = round((long_words_count / num_words) * 100, 2) if num_words else 0
        
        # Very long words analysis (simplified)
        very_long_words_count = len([w for w in words if len(w) > 10])
        very_long_words_percentage = round((very_long_words_count / num_words) * 100, 2) if num_words else 0
        
        # Calculate basic readability score
        lix_score = lix_metric.compute(words, num_sentences)
        
        # Return only the basic statistics
        return {
            "statistics": {
                "word_count": num_words,
                "sentence_count": num_sentences,
                "paragraph_count": num_paragraphs,
                "avg_word_length": avg_word_length,
                "avg_sentence_length": avg_sentence_length,
                "long_words_percentage": long_words_percentage,
                "very_long_words_percentage": very_long_words_percentage,
                "readability_score": lix_score,
                "long_words_count": long_words_count
            }
        }