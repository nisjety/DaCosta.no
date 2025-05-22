"""
Enhanced readability service that provides multiple metrics for text analysis.
Calculates LIX, SMOG, CLI, Flesch, and other readability metrics.
"""
import re
import math
import logging
from typing import Dict, Any, List, Tuple, Optional

class EnhancedReadabilityService:
    """
    Service for analyzing text readability using multiple algorithms.
    Provides comprehensive metrics for evaluating text complexity.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the readability service.
        
        Args:
            config: Optional configuration parameters
        """
        self._config = config or {}
        self._logger = logging.getLogger('readability_service')
        
        # Default language is Norwegian, but can be configured
        self._language = self._config.get('language', 'nb')
        
    async def analyze_text(self, text: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Analyze text and return comprehensive readability metrics.
        
        Args:
            text: The text to analyze
            options: Optional analysis configuration
            
        Returns:
            Dictionary containing various readability metrics
        """
        # Default options
        opts = options or {}
        
        # Basic text statistics
        stats = self._get_text_statistics(text)
        
        # Calculate all metrics
        metrics = {
            'lix': self.calculate_lix(stats),
            'smog': self.calculate_smog(stats),
            'coleman_liau': self.calculate_coleman_liau(stats),
            'flesch': self.calculate_flesch(stats),
            'flesch_kincaid': self.calculate_flesch_kincaid(stats),
            'fog': self.calculate_fog(stats),
            'ari': self.calculate_ari(stats),
            'stats': stats
        }
        
        # Add interpretation and recommendations
        metrics['difficulty_level'] = self._interpret_difficulty(metrics)
        metrics['recommendations'] = self._generate_recommendations(metrics)
        
        return metrics
        
    def _get_text_statistics(self, text: str) -> Dict[str, Any]:
        """
        Extract basic statistics from text.
        
        Args:
            text: Text to analyze
            
        Returns:
            Dictionary of text statistics
        """
        # Clean and normalize text
        text = text.strip()
        if not text:
            return {
                'char_count': 0,
                'word_count': 0,
                'sentence_count': 0,
                'long_word_count': 0,
                'avg_word_length': 0,
                'avg_sentence_length': 0,
                'syllable_count': 0,
                'avg_syllables_per_word': 0,
                'complex_word_count': 0
            }
        
        # Basic counts
        char_count = len(text)
        
        # Split into sentences
        # This is a simplified approach; more sophisticated NLP techniques 
        # could be used for better accuracy
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        sentence_count = len(sentences)
        
        # Split into words and count
        words = re.findall(r'\b\w+\b', text.lower())
        word_count = len(words)
        
        # Count long words (>6 characters)
        long_word_count = sum(1 for w in words if len(w) > 6)
        
        # Calculate average word length
        avg_word_length = sum(len(w) for w in words) / max(1, word_count)
        
        # Calculate average sentence length in words
        avg_sentence_length = word_count / max(1, sentence_count)
        
        # Count syllables (language dependent)
        syllable_count, complex_word_count = self._count_syllables(words)
        avg_syllables_per_word = syllable_count / max(1, word_count)
        
        return {
            'char_count': char_count,
            'word_count': word_count,
            'sentence_count': sentence_count,
            'long_word_count': long_word_count,
            'avg_word_length': avg_word_length,
            'avg_sentence_length': avg_sentence_length,
            'syllable_count': syllable_count,
            'avg_syllables_per_word': avg_syllables_per_word,
            'complex_word_count': complex_word_count
        }
    
    def _count_syllables(self, words: List[str]) -> Tuple[int, int]:
        """
        Count syllables in a list of words.
        
        Args:
            words: List of words to count syllables for
            
        Returns:
            Tuple of (total syllable count, complex word count)
        """
        total_syllables = 0
        complex_words = 0
        
        for word in words:
            # Count vowel groups as an approximation of syllables
            count = 0
            
            # Norwegian-specific syllable counting logic
            if self._language == 'nb':
                # Count vowel groups: a, e, i, o, u, y, æ, ø, å
                vowels = 'aeiouyæøå'
                prev_char = None
                
                for char in word:
                    if char.lower() in vowels and prev_char not in vowels:
                        count += 1
                    prev_char = char.lower()
            else:
                # Default English syllable counting
                word = word.lower()
                if word.endswith('e'):
                    word = word[:-1]
                
                vowels = 'aeiouy'
                prev_char = None
                
                for char in word:
                    if char in vowels and prev_char not in vowels:
                        count += 1
                    prev_char = char
            
            # Ensure each word has at least one syllable
            count = max(1, count)
            total_syllables += count
            
            # Words with 3+ syllables are considered complex
            if count >= 3:
                complex_words += 1
                
        return total_syllables, complex_words
        
    def calculate_lix(self, stats: Dict[str, Any]) -> float:
        """
        Calculate LIX (Läsbarhetsindex/Readability Index).
        LIX = A / B + (C * 100) / A
        where:
        A = number of words
        B = number of sentences
        C = number of long words (>6 characters)
        
        Args:
            stats: Text statistics dictionary
            
        Returns:
            LIX score
        """
        if stats['word_count'] == 0:
            return 0
            
        return (stats['word_count'] / max(1, stats['sentence_count'])) + \
               ((stats['long_word_count'] * 100) / stats['word_count'])
    
    def calculate_smog(self, stats: Dict[str, Any]) -> float:
        """
        Calculate SMOG (Simple Measure of Gobbledygook).
        SMOG = 1.043 * sqrt(complex_words * (30 / sentences)) + 3.1291
        
        Args:
            stats: Text statistics dictionary
            
        Returns:
            SMOG score
        """
        if stats['sentence_count'] == 0:
            return 0
            
        return 1.043 * math.sqrt(stats['complex_word_count'] * 
                                 (30 / max(1, stats['sentence_count']))) + 3.1291
    
    def calculate_coleman_liau(self, stats: Dict[str, Any]) -> float:
        """
        Calculate Coleman-Liau Index (CLI).
        CLI = 0.0588 * L - 0.296 * S - 15.8
        where:
        L = average number of letters per 100 words
        S = average number of sentences per 100 words
        
        Args:
            stats: Text statistics dictionary
            
        Returns:
            Coleman-Liau score
        """
        if stats['word_count'] == 0:
            return 0
            
        L = stats['avg_word_length'] * 100
        S = (stats['sentence_count'] / stats['word_count']) * 100
        return 0.0588 * L - 0.296 * S - 15.8
    
    def calculate_flesch(self, stats: Dict[str, Any]) -> float:
        """
        Calculate Flesch Reading Ease score.
        Flesch = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
        
        Args:
            stats: Text statistics dictionary
            
        Returns:
            Flesch Reading Ease score
        """
        if stats['word_count'] == 0 or stats['sentence_count'] == 0:
            return 0
            
        return 206.835 - 1.015 * stats['avg_sentence_length'] - \
               84.6 * stats['avg_syllables_per_word']
    
    def calculate_flesch_kincaid(self, stats: Dict[str, Any]) -> float:
        """
        Calculate Flesch-Kincaid Grade Level.
        FK = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
        
        Args:
            stats: Text statistics dictionary
            
        Returns:
            Flesch-Kincaid Grade Level score
        """
        if stats['word_count'] == 0 or stats['sentence_count'] == 0:
            return 0
            
        return 0.39 * stats['avg_sentence_length'] + \
               11.8 * stats['avg_syllables_per_word'] - 15.59
    
    def calculate_fog(self, stats: Dict[str, Any]) -> float:
        """
        Calculate Gunning Fog Index.
        Fog = 0.4 * ((words / sentences) + 100 * (complex_words / words))
        
        Args:
            stats: Text statistics dictionary
            
        Returns:
            Gunning Fog Index score
        """
        if stats['word_count'] == 0 or stats['sentence_count'] == 0:
            return 0
            
        return 0.4 * (stats['avg_sentence_length'] + 
                     100 * (stats['complex_word_count'] / stats['word_count']))
    
    def calculate_ari(self, stats: Dict[str, Any]) -> float:
        """
        Calculate Automated Readability Index (ARI).
        ARI = 4.71 * (characters / words) + 0.5 * (words / sentences) - 21.43
        
        Args:
            stats: Text statistics dictionary
            
        Returns:
            ARI score
        """
        if stats['word_count'] == 0 or stats['sentence_count'] == 0:
            return 0
            
        return 4.71 * (stats['char_count'] / stats['word_count']) + \
               0.5 * stats['avg_sentence_length'] - 21.43
    
    def _interpret_difficulty(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """
        Interpret the difficulty level based on multiple metrics.
        
        Args:
            metrics: Dictionary of calculated metrics
            
        Returns:
            Dictionary with difficulty interpretations
        """
        # LIX interpretation
        lix_score = metrics['lix']
        if lix_score < 25:
            lix_level = 'very_easy'
        elif lix_score < 35:
            lix_level = 'easy'
        elif lix_score < 45:
            lix_level = 'medium'
        elif lix_score < 55:
            lix_level = 'difficult'
        else:
            lix_level = 'very_difficult'
            
        # Flesch interpretation
        flesch_score = metrics['flesch']
        if flesch_score > 90:
            flesch_level = 'very_easy'
        elif flesch_score > 80:
            flesch_level = 'easy'
        elif flesch_score > 70:
            flesch_level = 'fairly_easy'
        elif flesch_score > 60:
            flesch_level = 'medium'
        elif flesch_score > 50:
            flesch_level = 'fairly_difficult'
        elif flesch_score > 30:
            flesch_level = 'difficult'
        else:
            flesch_level = 'very_difficult'
            
        # Determine target audience by educational level
        if metrics['flesch_kincaid'] < 6:
            education_level = 'elementary'
        elif metrics['flesch_kincaid'] < 10:
            education_level = 'middle_school'
        elif metrics['flesch_kincaid'] < 13:
            education_level = 'high_school'
        elif metrics['flesch_kincaid'] < 16:
            education_level = 'college'
        else:
            education_level = 'graduate'
            
        return {
            'lix_level': lix_level,
            'flesch_level': flesch_level,
            'education_level': education_level,
            'age_group': self._map_education_to_age(education_level),
            'complexity': self._calculate_overall_complexity(metrics)
        }
    
    def _map_education_to_age(self, education_level: str) -> str:
        """Map education level to approximate age group."""
        mapping = {
            'elementary': '6-11',
            'middle_school': '11-14',
            'high_school': '14-18',
            'college': '18-22',
            'graduate': '22+'
        }
        return mapping.get(education_level, 'adult')
    
    def _calculate_overall_complexity(self, metrics: Dict[str, Any]) -> float:
        """
        Calculate an overall complexity score based on multiple metrics.
        
        Args:
            metrics: Dictionary of calculated metrics
            
        Returns:
            Normalized complexity score between 0 and 10
        """
        # Normalize LIX (0-100 scale)
        norm_lix = min(100, max(0, metrics['lix'])) / 10
        
        # Normalize Flesch (0-100 scale, but inverted)
        norm_flesch = (100 - min(100, max(0, metrics['flesch']))) / 10
        
        # Normalize Flesch-Kincaid (0-20 scale)
        norm_fk = min(20, max(0, metrics['flesch_kincaid'])) / 2
        
        # Combine metrics (weighted average)
        return (0.4 * norm_lix + 0.3 * norm_flesch + 0.3 * norm_fk)
    
    def _generate_recommendations(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate recommendations based on readability analysis.
        
        Args:
            metrics: Dictionary of calculated metrics
            
        Returns:
            Dictionary of recommendations
        """
        stats = metrics['stats']
        recommendations = {}
        
        # Check sentence length
        avg_sentence_length = stats['avg_sentence_length']
        if avg_sentence_length > 25:
            recommendations['sentence_length'] = {
                'issue': 'long_sentences',
                'severity': 'high' if avg_sentence_length > 35 else 'medium',
                'suggestion': 'Consider breaking longer sentences into smaller ones.'
            }
        
        # Check word complexity
        complex_ratio = stats['complex_word_count'] / max(1, stats['word_count'])
        if complex_ratio > 0.2:
            recommendations['word_complexity'] = {
                'issue': 'complex_vocabulary',
                'severity': 'high' if complex_ratio > 0.3 else 'medium',
                'suggestion': 'Try using simpler words where possible.'
            }
        
        # Check overall readability
        if metrics['lix'] > 50 or metrics['flesch'] < 50:
            recommendations['overall_readability'] = {
                'issue': 'difficult_text',
                'severity': 'high' if metrics['lix'] > 60 else 'medium',
                'suggestion': 'The text may be too difficult for general audiences.'
            }
            
        return recommendations

# Export singleton instance
enhanced_readability_service = EnhancedReadabilityService()