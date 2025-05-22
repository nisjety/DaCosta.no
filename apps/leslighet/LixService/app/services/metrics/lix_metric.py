"""
Optimized readability metrics implementations for LIX and RIX scores.
"""
from typing import Dict, List, Any
from functools import lru_cache

class LixMetric:
    """
    LIX (Läsbarhetsindex) readability metric.
    
    LIX measures readability based on sentence length and word length.
    Formula: LIX = A / B + (C * 100) / A
    where:
    A = number of words
    B = number of sentences
    C = number of long words (>6 characters)
    """
    
    def __init__(self):
        """Initialize LIX metric with thresholds."""
        self.thresholds = {
            "very_easy": 20,    # <20: Very easy text
            "easy": 30,         # 20-30: Easy text
            "medium": 40,       # 30-40: Medium difficulty
            "difficult": 50,    # 40-50: Difficult text
            "very_difficult": 60 # >50: Very difficult text
        }
        # Cache for classification results
        self._classification_cache = {}
        # Constant for word length threshold
        self.LONG_WORD_THRESHOLD = 6
    
    def compute(self, words: List[str], sentence_count: int) -> float:
        """
        Calculate LIX score for a text.
        
        Args:
            words: List of words in the text
            sentence_count: Number of sentences in the text
            
        Returns:
            LIX score
        """
        if not words or sentence_count == 0:
            return 0
            
        word_count = len(words)
        
        # Fast word length counting using generator expression and sum
        # Avoid creating new lists with list comprehensions
        long_words_count = sum(1 for word in words if len(word) > self.LONG_WORD_THRESHOLD)
        
        # Calculate average sentence length
        avg_sentence_length = word_count / sentence_count
        
        # Calculate percentage of long words
        long_words_percentage = (long_words_count / word_count) * 100
        
        # LIX formula: Average sentence length + percentage of long words
        lix_score = avg_sentence_length + long_words_percentage
        
        return round(lix_score, 1)
    
    def classify(self, score: float) -> Dict[str, Any]:
        """
        Classify a text based on its LIX score.
        
        Args:
            score: LIX score to classify
            
        Returns:
            Classification information
        """
        # Check cache first to avoid recalculating for common scores
        cache_key = round(score, 1)
        if cache_key in self._classification_cache:
            return self._classification_cache[cache_key]
        
        # Simplified classification logic for faster execution
        if score < self.thresholds["very_easy"]:
            category = "svært lett"
            description = "Teksten er svært lettlest og egnet for alle lesere."
            audience = "Alle lesere, inkludert barn og nybegynnere."
            improvement_tips = ["Teksten er allerede svært lettlest."]
        elif score < self.thresholds["easy"]:
            category = "lett"
            description = "Teksten er lettlest og tilgjengelig for de fleste."
            audience = "Generelt publikum, inkludert ungdomsskoleelever."
            improvement_tips = ["Teksten er allerede lettlest.", "Vurder om korte setninger gir god flyt."]
        elif score < self.thresholds["medium"]:
            category = "middels"
            description = "Teksten har middels vanskelighetsgrad."
            audience = "Voksne lesere og videregående skoleelever."
            improvement_tips = ["Vurder å forenkle noen lange ord.", "Se etter setninger som kan deles opp."]
        elif score < self.thresholds["difficult"]:
            category = "vanskelig"
            description = "Teksten er relativt krevende å lese."
            audience = "Lesere med god lesekompetanse, høyere utdanning."
            improvement_tips = [
                "Bruk kortere setninger (under 15-20 ord).",
                "Erstatt noen lange ord med kortere alternativer.",
                "Del opp komplekse avsnitt."
            ]
        else:
            category = "svært vanskelig"
            description = "Teksten er svært krevende og kompleks."
            audience = "Spesialister, akademikere, avanserte lesere."
            improvement_tips = [
                "Del lange setninger i kortere enheter.",
                "Bruk enklere og kortere ord der mulig.",
                "Vurder om fagterminologi kan forklares.",
                "Legg til mellomtitler for å bryte opp teksten."
            ]
        
        # Create result object once and reuse the thresholds dictionary
        thresholds_map = {
            "svært lett": self.thresholds["very_easy"],
            "lett": self.thresholds["easy"],
            "middels": self.thresholds["medium"],
            "vanskelig": self.thresholds["difficult"],
            "svært vanskelig": self.thresholds["very_difficult"]
        }
        
        result = {
            "category": category,
            "description": description,
            "audience": audience,
            "thresholds": thresholds_map,
            "improvement_tips": improvement_tips
        }
        
        # Cache the result
        self._classification_cache[cache_key] = result
        return result


class RixMetric:
    """
    RIX (Reading Index) readability metric.
    
    RIX is a simplified alternative to LIX, focusing on the ratio of long words.
    Formula: RIX = number of long words / number of sentences
    """
    
    def __init__(self):
        """Initialize RIX metric with thresholds."""
        self.thresholds = {
            "very_easy": 1.8,    # <1.8: Very easy text
            "easy": 2.8,         # 1.8-2.8: Easy text
            "medium": 3.7,       # 2.8-3.7: Medium difficulty
            "difficult": 4.8,    # 3.7-4.8: Difficult text
            "very_difficult": 5.5 # >4.8: Very difficult text
        }
        # Cache for classification results
        self._classification_cache = {}
        # Constant for word length threshold
        self.LONG_WORD_THRESHOLD = 6
    
    def compute(self, words: List[str], sentence_count: int) -> float:
        """
        Calculate RIX score for a text.
        
        Args:
            words: List of words in the text
            sentence_count: Number of sentences in the text
            
        Returns:
            RIX score
        """
        if not words or sentence_count == 0:
            return 0
            
        # Optimized long word counting - avoid list creation
        long_words_count = sum(1 for word in words if len(word) > self.LONG_WORD_THRESHOLD)
        
        # RIX formula: Number of long words / number of sentences
        rix_score = long_words_count / sentence_count
        
        return round(rix_score, 2)
    
    def classify(self, score: float) -> Dict[str, Any]:
        """
        Classify a text based on its RIX score.
        
        Args:
            score: RIX score to classify
            
        Returns:
            Classification information
        """
        # Check cache first to avoid recalculating for common scores
        cache_key = round(score, 2)
        if cache_key in self._classification_cache:
            return self._classification_cache[cache_key]
        
        # Simplified classification logic with fewer branches when possible
        if score < self.thresholds["very_easy"]:
            category = "svært lett"
            description = "Teksten har få lange ord per setning, noe som gjør den svært lettlest."
            audience = "Alle lesere, inkludert barn og nybegynnere."
            improvement_tips = ["Teksten er allerede svært lettlest."]
        elif score < self.thresholds["easy"]:
            category = "lett"
            description = "Teksten har en god balanse av korte og lange ord."
            audience = "Generelt publikum, inkludert ungdomsskoleelever."
            improvement_tips = ["Teksten er allerede lettlest."]
        elif score < self.thresholds["medium"]:
            category = "middels"
            description = "Teksten har en del lange ord, men er fortsatt lesbar for de fleste."
            audience = "Voksne lesere og videregående skoleelever."
            improvement_tips = ["Vurder å erstatte noen lange ord med kortere alternativer."]
        elif score < self.thresholds["difficult"]:
            category = "vanskelig"
            description = "Teksten har mange lange ord, noe som gjør den krevende å lese."
            audience = "Lesere med god lesekompetanse, høyere utdanning."
            improvement_tips = [
                "Erstatt noen lange ord med kortere alternativer.",
                "Sørg for at vanskelige begreper forklares.",
                "Varier mellom korte og lange ord for bedre flyt."
            ]
        else:
            category = "svært vanskelig"
            description = "Teksten har svært mange lange ord per setning, noe som gjør den kompleks."
            audience = "Spesialister, akademikere, avanserte lesere."
            improvement_tips = [
                "Bruk flere korte ord for å balansere teksten.",
                "Del setninger med mange lange ord.",
                "Forklar eller definer vanskelige begreper."
            ]
        
        # Create thresholds map only once
        thresholds_map = {
            "svært lett": self.thresholds["very_easy"],
            "lett": self.thresholds["easy"],
            "middels": self.thresholds["medium"],
            "vanskelig": self.thresholds["difficult"],
            "svært vanskelig": self.thresholds["very_difficult"]
        }
        
        result = {
            "category": category,
            "description": description,
            "audience": audience,
            "thresholds": thresholds_map,
            "improvement_tips": improvement_tips
        }
        
        # Cache the result
        self._classification_cache[cache_key] = result
        return result