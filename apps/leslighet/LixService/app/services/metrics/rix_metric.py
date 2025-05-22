from typing import Dict, List, Any
from app.services.metrics.base import BaseMetric

class RIXMetric(BaseMetric):
    """
    Implementation of RIX (Readability Index) readability metric.
    
    RIX is a Swedish readability measure that focuses on:
    - Number of long words (7+ characters) per sentence
    
    Formula: RIX = number of long words / number of sentences
    
    RIX is complementary to LIX and gives additional insights into text complexity.
    """
    
    def __init__(self):
        # Define thresholds for easier reference
        self.thresholds = {
            "very_easy": 1.5,  # Changed from 1.3 to match response thresholds
            "easy": 3.0,
            "medium": 4.5,
            "difficult": 6.0,
            "very_difficult": 7.5
        }
    
    def get_long_words(self, words: List[str], min_length: float = 6.9) -> List[str]:
        """
        Get long words from a list of words.
        
        Args:
            words: List of words to analyze
            min_length: Minimum length for a word to be considered long
                        (using 6.9 as the standard for RIX which counts words with 7+ chars)
            
        Returns:
            List of long words
        """
        return [word for word in words if len(word) > min_length]
    
    def compute(self, words: List[str], sentence_count: int) -> float:
        """
        Calculate RIX score from words and sentence count.
        
        Args:
            words: List of words in the text
            sentence_count: Number of sentences
            
        Returns:
            RIX score (float)
        """
        if sentence_count == 0:
            return 0.0
        
        # Count long words (7+ characters)
        long_words = self.get_long_words(words)
        
        # Calculate RIX
        rix_score = len(long_words) / sentence_count
        
        return round(rix_score, 2)
    
    def classify(self, score: float) -> Dict[str, Any]:
        """
        Classify text based on RIX score with detailed information.
        
        Args:
            score: RIX score to classify
            
        Returns:
            Dictionary with classification details
        """
        # Return thresholds for all classifications
        thresholds = {
            "svært lett": self.thresholds["very_easy"],
            "lett": self.thresholds["easy"],
            "middels": self.thresholds["medium"],
            "vanskelig": self.thresholds["difficult"],
            "svært vanskelig": self.thresholds["very_difficult"]
        }
        
        # Determine improvement tips based on score
        improvement_tips = []
        if score >= self.thresholds["medium"]:
            improvement_tips.append("Reduser antall lange ord per setning")
            improvement_tips.append("Varier mellom korte og lange ord")
        
        if score >= self.thresholds["difficult"]:
            improvement_tips.append("Del opp setninger med mange lange ord")
            improvement_tips.append("Bruk enklere synonymer for faglige termer når mulig")
        
        # Classify based on thresholds
        if score < self.thresholds["very_easy"]:
            return {
                "score": score,
                "category": "Svært lett",
                "description": "Teksten inneholder svært få lange ord per setning, ideell for nybegynnere.",
                "audience": "Passer for tidlige lesere og lettlest litteratur.",
                "educational_level": "Barneskole (tidlige trinn)",
                "thresholds": thresholds,
                "improvement_tips": []
            }
        elif score < self.thresholds["easy"]:
            return {
                "score": score,
                "category": "Lett",
                "description": "Teksten har få lange ord per setning, meget lettlest.",
                "audience": "Tilgjengelig for de fleste lesere, også de med begrenset leseferdighet.",
                "educational_level": "Barneskole (senere trinn)",
                "thresholds": thresholds,
                "improvement_tips": []
            }
        elif score < self.thresholds["medium"]:
            return {
                "score": score,
                "category": "Middels",
                "description": "Teksten har en balansert fordeling av lange ord, er tilgjengelig for de fleste.",
                "audience": "Passer for generelt publikum med gjennomsnittlige leseferdigheter.",
                "educational_level": "Ungdomsskole",
                "thresholds": thresholds,
                "improvement_tips": []
            }
        elif score < self.thresholds["difficult"]:
            return {
                "score": score,
                "category": "Vanskelig",
                "description": "Teksten har noe høyere antall lange ord per setning, krever god leseforståelse.",
                "audience": "Krever gode leseferdigheter, passer for fagstoff og akademiske tekster.",
                "educational_level": "Videregående skole",
                "thresholds": thresholds,
                "improvement_tips": improvement_tips[:2]
            }
        else:
            return {
                "score": score,
                "category": "Svært vanskelig",
                "description": "Teksten har mange lange ord per setning, krever meget god leseforståelse.",
                "audience": "Beregnet på lesere med sterke leseferdigheter og fagkunnskap.",
                "educational_level": "Høyere utdanning",
                "thresholds": thresholds,
                "improvement_tips": improvement_tips
            }