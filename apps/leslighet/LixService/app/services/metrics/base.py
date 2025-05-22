from abc import ABC, abstractmethod
from typing import Dict, List, Any

class BaseMetric(ABC):
    """Base abstract class for readability metrics."""
    
    @abstractmethod
    def compute(self, words: List[str], sentence_count: int) -> float:
        """Calculate metric score from words and sentences."""
        pass
    
    @abstractmethod
    def classify(self, score: float) -> Dict[str, Any]:
        """Classify text based on metric score."""
        pass