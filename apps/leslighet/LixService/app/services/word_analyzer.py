"""
Analyzes words for complexity, frequency, and position in text.
This service provides detailed analysis of individual words, their complexity,
and frequency patterns.
"""
from typing import List, Dict, Any, Optional, Set
import os
import json
from collections import Counter

class WordAnalyzer:
    """
    Analyzes words for complexity, frequency, and position in text.
    """
    
    def __init__(self):
        """Initialize with common words and alternative suggestions."""
        # Set thresholds for word classification
        self.long_word_threshold = 7
        self.very_long_word_threshold = 10
        
        # Load common Norwegian words from JSON file if available
        self.common_words = self._load_common_words()
        
        # Load word alternatives if available
        self.word_alternatives = self._load_word_alternatives()
    
    def _load_common_words(self) -> Set[str]:
        """Load common Norwegian words from a file."""
        common_words = set()
        try:
            # Try to load from app/data directory
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            common_words_path = os.path.join(base_dir, 'data', 'common_norwegian_words.json')
            
            if os.path.exists(common_words_path):
                with open(common_words_path, 'r', encoding='utf-8') as f:
                    common_words = set(json.load(f))
        except Exception:
            # Fall back to a small set of very common words
            common_words = {
                "og", "i", "jeg", "det", "at", "en", "et", "den", "til", "er", "som", "på", 
                "de", "med", "han", "av", "ikke", "ikkje", "der", "så", "var", "meg", "seg", 
                "men", "ett", "har", "om", "vi", "min", "mitt", "ha", "hadde", "hun", "nå",
                "over", "da", "ved", "fra", "du", "ut", "sin", "dem", "oss", "opp", "man",
                "kan", "hans", "hvor", "eller", "hva", "skal", "selv", "sjøl", "her", "alle",
                "vil", "bli", "ble", "blei", "blitt", "kunne", "inn", "når", "være", "kom"
            }
        return common_words
    
    def _load_word_alternatives(self) -> Dict[str, List[str]]:
        """Load alternative simpler words for complex words."""
        alternatives = {}
        try:
            # Try to load from app/data directory
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            alternatives_path = os.path.join(base_dir, 'data', 'word_alternatives.json')
            
            if os.path.exists(alternatives_path):
                with open(alternatives_path, 'r', encoding='utf-8') as f:
                    alternatives = json.load(f)
        except Exception:
            # Fall back to a small set of common replacements
            alternatives = {
                "implementere": ["bruke", "innføre"],
                "demonstrere": ["vise", "bevise"],
                "kommunisere": ["snakke", "si fra"],
                "identifisere": ["finne", "kjenne igjen"],
                "modifisere": ["endre", "tilpasse"],
                "evaluere": ["vurdere", "bedømme"],
                "analysere": ["undersøke", "studere"],
                "optimalisere": ["forbedre", "gjøre bedre"],
                "dokumentere": ["skrive ned", "beskrive"],
                "administrere": ["styre", "lede"],
                "konkludere": ["avslutte", "slutte"],
                "illustrere": ["vise", "tegne"],
                "informasjon": ["opplysning", "data"],
                "funksjonalitet": ["virkning", "bruk"],
                "spesifikasjon": ["krav", "beskrivelse"],
                "konfigurasjon": ["oppsett", "innstilling"],
                "definisjon": ["forklaring", "betydning"],
                "konsekvent": ["fast", "stabil"],
                "tilstrekkelig": ["nok", "god nok"],
                "signifikant": ["viktig", "betydelig"]
            }
        return alternatives
    
    def get_long_words(self, words: List[str], min_length: float = 6.9) -> List[str]:
        """
        Get long words from a list of words.
        
        Args:
            words: List of words to analyze
            min_length: Minimum length for a word to be considered long
                        (default is 6.9, which counts words with 7+ characters)
            
        Returns:
            List of long words
        """
        return [word for word in words if len(word) > min_length]
    
    def analyze_word(self, word: str, index: int, sentence_index: int, position_in_sentence: int, word_frequency: Dict[str, int]) -> Dict[str, Any]:
        """
        Analyze a single word with context.
        
        Args:
            word: The word to analyze
            index: Global word index in the text
            sentence_index: Index of the sentence containing the word
            position_in_sentence: Position of the word in its sentence
            word_frequency: Dictionary mapping words to their frequency in the text
                            (should also contain sentence length info as "__sentence_X_length")
            
        Returns:
            Dictionary with word analysis
        """
        # Skip empty words
        if not word:
            return {
                "word": "",
                "length": 0,
                "is_long": False,
                "frequency": 0,
                "relative_frequency": 0,
                "position": {
                    "global_index": index,
                    "sentence_index": sentence_index,
                    "position_in_sentence": position_in_sentence,
                    "relative_position": 0
                }
            }
        
        # Calculate word metrics
        word_length = len(word)
        is_long = word_length > 6.9  # 7+ characters
        is_very_long = word_length > 9.9  # 10+ characters
        lowercase_word = word.lower()
        
        # Get frequency info
        frequency = word_frequency.get(lowercase_word, 0)
        total_words = sum(1 for w, f in word_frequency.items() if not w.startswith("__"))
        relative_frequency = frequency / total_words if total_words > 0 else 0
        
        # Calculate relative position in sentence
        sentence_length_key = f"__sentence_{sentence_index}_length"
        sentence_length = word_frequency.get(sentence_length_key, 0)
        relative_position = position_in_sentence / sentence_length if sentence_length > 0 else 0
        
        # Determine word significance
        total_unique_words = len([w for w in word_frequency.keys() if not w.startswith("__")])
        frequency_rank = sorted(
            [(w, f) for w, f in word_frequency.items() if not w.startswith("__")],
            key=lambda x: x[1],
            reverse=True
        ).index((lowercase_word, frequency)) + 1 if frequency > 0 else total_unique_words
        
        significance_score = (
            (0.4 * (1 - (frequency_rank / total_unique_words))) +  # Rarity
            (0.3 * (word_length / 12)) +                           # Length (capped at 12 chars)
            (0.3 * (1 if is_long else 0.5))                        # Is long word
        )
        
        # Determine style and complexity
        word_style = "vanlig"
        if word_length <= 3:
            word_style = "kort"
        elif is_very_long:
            word_style = "svært lang"
        elif is_long:
            word_style = "lang"
            
        word_complexity = "enkel"
        if is_very_long and frequency <= 1:
            word_complexity = "kompleks"
        elif is_long and frequency <= 2:
            word_complexity = "moderat"
        
        # Return comprehensive analysis
        return {
            "word": word,
            "length": word_length,
            "is_long": is_long,
            "is_very_long": is_very_long,
            "frequency": frequency,
            "relative_frequency": round(relative_frequency, 4),
            "frequency_rank": frequency_rank,
            "significance_score": round(significance_score, 2),
            "position": {
                "global_index": index,
                "sentence_index": sentence_index,
                "position_in_sentence": position_in_sentence,
                "relative_position": round(relative_position, 2)
            },
            "style": word_style,
            "complexity": word_complexity
        }