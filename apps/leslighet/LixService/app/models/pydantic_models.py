"""
Pydantic models for LixService.
Defines request and response models for API endpoints.
"""
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional

class TextRequest(BaseModel):
    """Request model for text analysis."""
    text: str
    include_word_analysis: Optional[bool] = Field(
        default=False, 
        description="Whether to include detailed word analysis in the response"
    )
    include_sentence_analysis: Optional[bool] = Field(
        default=True,
        description="Whether to include detailed sentence analysis in the response"
    )
    user_context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional context about the user or text purpose"
    )

class BatchTextRequest(BaseModel):
    """Request model for batch text analysis."""
    texts: List[Dict[str, str]] = Field(..., 
        description="List of texts to analyze", 
        example=[{"id": "doc1", "content": "This is the first text."}, {"id": "doc2", "content": "This is the second text."}])
    priority: Optional[int] = Field(1, description="Priority of the batch job (1-10)")
    include_word_analysis: Optional[bool] = Field(
        default=False, 
        description="Whether to include detailed word analysis in the response"
    )
    include_sentence_analysis: Optional[bool] = Field(
        default=True,
        description="Whether to include detailed sentence analysis in the response"
    )

class ReadabilityMetric(BaseModel):
    """Model for readability metrics like LIX and RIX."""
    score: float
    category: str
    description: str
    audience: Optional[str] = None
    thresholds: Optional[Dict[str, float]] = None
    improvement_tips: Optional[List[str]] = None

class ReadabilityResponse(BaseModel):
    """Response model for readability analysis."""
    lix: Dict[str, Any]
    rix: Dict[str, Any]
    combined_description: str
    recommendations: Optional[List[Dict[str, Any]]] = None
    text_statistics: Optional[Dict[str, Any]] = None

class SentenceAnalysis(BaseModel):
    """Model for sentence analysis data."""
    sentence_index: int
    sentence: str
    word_count: int
    avg_word_length: float
    lix_score: Optional[float] = None
    complexity_level: Optional[str] = None
    issues: List[Dict[str, Any]] = []
    improvement_tips: List[str] = []

class WordAnalysis(BaseModel):
    """Model for word analysis data."""
    word: str
    length: int
    is_long: bool
    is_very_long: Optional[bool] = None
    frequency: int
    position: Dict[str, Any]
    style: Optional[str] = None
    complexity: Optional[str] = None

class TextAnalysisResponse(BaseModel):
    """Response model for text analysis."""
    statistics: Dict[str, Any]
    sentence_analysis: Optional[List[SentenceAnalysis]] = None
    word_analysis: Optional[List[WordAnalysis]] = None

class FullAnalysisResponse(BaseModel):
    """Full response model combining readability and text analysis."""
    readability: Dict[str, Any]
    text_analysis: Dict[str, Any]
    processing_time_ms: float
    cached: Optional[bool] = False