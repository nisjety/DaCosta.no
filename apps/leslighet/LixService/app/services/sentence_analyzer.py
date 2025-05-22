"""
Advanced sentence analyzer with detailed metrics and improvement suggestions.
"""
import re
from typing import Dict, List, Any, Optional

class SentenceAnalyzer:
    """
    Advanced sentence analyzer with detailed metrics and improvement suggestions.
    
    This service analyzes sentences for complexity, readability issues,
    and provides targeted improvement recommendations.
    """
    
    def __init__(self):
        # Define thresholds for sentence complexity
        self.thresholds = {
            "word_count": {
                "short": 8,       # Below this is short
                "medium": 20,     # Below this is medium
                "long": 30        # Below this is long, above is very long
            },
            "long_words_percentage": {
                "low": 20,        # Below this is low
                "medium": 35,     # Below this is medium
                "high": 50        # Below this is high, above is very high
            },
            "lix_score": {
                "simple": 30,
                "medium": 45,
                "complex": 55
            }
        }
    
    def _split_words(self, text: str) -> List[str]:
        """Split text into words using regex."""
        return re.findall(r'\b\w+\b', text)
    
    def _compute_lix_score(self, words: List[str], sentence_count: int) -> float:
        """Calculate LIX score for a single sentence."""
        if not words:
            return 0
            
        # Calculate percentage of long words
        long_words = [word for word in words if len(word) > 6.9]
        long_words_percentage = (len(long_words) / len(words)) * 100
        
        # For single sentences, we compute a simplified LIX
        lix_score = len(words) + long_words_percentage
        
        return round(lix_score, 2)
    
    def analyze_sentence(self, sentence: str, sentence_index: int, words: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Analyze a single sentence for complexity and issues.
        
        Args:
            sentence: The sentence to analyze
            sentence_index: The index of the sentence in the text
            words: Optional pre-split words (for efficiency)
            
        Returns:
            Dictionary with analysis results
        """
        # Get words if not provided
        if words is None:
            words = self._split_words(sentence)
        
        # Basic metrics
        word_count = len(words)
        
        # Skip empty sentences
        if word_count == 0:
            return {
                "sentence_index": sentence_index,
                "sentence": sentence,
                "word_count": 0,
                "long_words_count": 0,
                "very_long_words_count": 0,
                "avg_word_length": 0,
                "lix_score": 0,
                "complexity_level": "N/A",
                "issues": [],
                "improvement_tips": []
            }
        
        # Get long words
        long_words = [word for word in words if len(word) > 6.9]  # 7+ characters
        long_words_count = len(long_words)
        long_words_percentage = (long_words_count / word_count) * 100 if word_count > 0 else 0
        
        # Get very long words
        very_long_words = [word for word in words if len(word) > 9.9]  # 10+ characters
        very_long_words_count = len(very_long_words)
        
        # Calculate average word length
        word_lengths = [len(word) for word in words]
        avg_word_length = sum(word_lengths) / word_count if word_count > 0 else 0
        
        # Calculate LIX score for this sentence
        lix_score = self._compute_lix_score(words, 1)  # 1 sentence
        
        # Determine complexity level
        complexity_level = "enkel"
        if lix_score > self.thresholds["lix_score"]["complex"]:
            complexity_level = "svært kompleks"
        elif lix_score > self.thresholds["lix_score"]["medium"]:
            complexity_level = "kompleks"
        elif lix_score > self.thresholds["lix_score"]["simple"]:
            complexity_level = "moderat"
        
        # Check for issues
        issues = []
        
        # Check sentence length
        if word_count > self.thresholds["word_count"]["long"]:
            issues.append({
                "type": "long_sentence",
                "description": f"Setningen er svært lang ({word_count} ord)",
                "severity": "high"
            })
        elif word_count > self.thresholds["word_count"]["medium"]:
            issues.append({
                "type": "medium_sentence",
                "description": f"Setningen er lang ({word_count} ord)",
                "severity": "medium"
            })
        
        # Check for too many long words
        if long_words_percentage > self.thresholds["long_words_percentage"]["high"]:
            issues.append({
                "type": "long_words",
                "description": f"Setningen har svært mange lange ord ({round(long_words_percentage)}%)",
                "severity": "high"
            })
        elif long_words_percentage > self.thresholds["long_words_percentage"]["medium"]:
            issues.append({
                "type": "long_words",
                "description": f"Setningen har mange lange ord ({round(long_words_percentage)}%)",
                "severity": "medium"
            })
        
        # Generate improvement tips
        improvement_tips = []
        
        if word_count > self.thresholds["word_count"]["medium"]:
            improvement_tips.append("Del setningen i to eller flere kortere setninger")
        
        if long_words_percentage > self.thresholds["long_words_percentage"]["medium"]:
            improvement_tips.append("Erstatt lange ord med kortere synonymer")
            
            # Suggest replacements for very long words if any
            if very_long_words:
                improvement_tips.append(f"Vurder å erstatte: {', '.join(very_long_words[:3])}")
        
        # Return complete analysis
        return {
            "sentence_index": sentence_index,
            "sentence": sentence,
            "word_count": word_count,
            "long_words_count": long_words_count,
            "very_long_words_count": very_long_words_count,
            "avg_word_length": round(avg_word_length, 2),
            "lix_score": lix_score,
            "complexity_level": complexity_level,
            "issues": issues,
            "improvement_tips": improvement_tips
        }