#!/usr/bin/env python3
"""
Simple model initialization script that loads models at startup
and provides them as global variables to the Flask application.
"""
import sys
import time
import threading

# Global model variables that will be shared with the Flask app
sentiment_model = None
summarization_model = None
correction_model = None

# Track loading progress
loading_progress = {
    'sentiment': 0,
    'summarization': 0,
    'correction': 0,
    'overall': 0
}

def create_simple_sentiment_model():
    """Create a simple sentiment analysis model"""
    print("Creating simple sentiment model...")
    sys.stdout.flush()
    
    # Simple function instead of complex model for testing
    def simple_sentiment(text):
        # Very basic sentiment check for testing
        positive = sum(1 for word in ['good', 'great', 'excellent', 'bra', 'fin'] if word in text.lower())
        negative = sum(1 for word in ['bad', 'terrible', 'awful', 'dårlig'] if word in text.lower())
        
        if positive > negative:
            return [{'label': 'POSITIVE', 'score': 0.8}]
        else:
            return [{'label': 'NEGATIVE', 'score': 0.7}]
    
    return lambda text: [simple_sentiment(text)]

def create_simple_summarization_model():
    """Create a simple summarization model"""
    print("Creating simple summarization model...")
    sys.stdout.flush()
    
    # Simple function instead of complex model for testing
    def simple_summarization(text, **kwargs):
        sentences = text.replace('!', '.').replace('?', '.').split('.')
        sentences = [s.strip() for s in sentences if s.strip()]
        
        if not sentences:
            return [{'summary_text': text}]
            
        if len(sentences) <= 3:
            return [{'summary_text': '. '.join(sentences) + '.'}]
            
        summary = f"{sentences[0]}. "
        if len(sentences) > 3:
            summary += f"{sentences[len(sentences) // 2]}. "
        summary += f"{sentences[-1]}."
        
        return [{'summary_text': summary}]
    
    return simple_summarization

def create_simple_correction_model():
    """Create a simple text correction model"""
    print("Creating simple correction model...")
    sys.stdout.flush()
    
    # Simple function instead of complex model for testing
    def simple_correction(text, **kwargs):
        corrections = {
            'idag': 'i dag',
            'og så': 'og så',
            'ihvertfall': 'i hvert fall',
            'forøvrig': 'for øvrig',
        }
        
        corrected = text
        for incorrect, correct in corrections.items():
            corrected = corrected.replace(incorrect, correct)
            
        # Fix multiple spaces
        corrected = ' '.join(corrected.split())
        
        return [{'generated_text': corrected}]
    
    return simple_correction

def initialize_models():
    """Initialize all models and update loading progress"""
    global sentiment_model, summarization_model, correction_model, loading_progress
    
    print("Starting model initialization...")
    sys.stdout.flush()
    
    # Load sentiment model
    loading_progress['sentiment'] = 10
    time.sleep(1)  # simulate loading time
    sentiment_model = create_simple_sentiment_model()
    loading_progress['sentiment'] = 100
    print("✓ Sentiment model loaded successfully")
    sys.stdout.flush()
    
    # Load summarization model
    loading_progress['summarization'] = 10
    time.sleep(1)  # simulate loading time
    summarization_model = create_simple_summarization_model()
    loading_progress['summarization'] = 100
    print("✓ Summarization model loaded successfully")
    sys.stdout.flush()
    
    # Load correction model
    loading_progress['correction'] = 10
    time.sleep(1)  # simulate loading time
    correction_model = create_simple_correction_model()
    loading_progress['correction'] = 100
    print("✓ Correction model loaded successfully")
    sys.stdout.flush()
    
    # Update overall progress
    loading_progress['overall'] = 100
    
    print("All models initialized successfully!")
    print(f"Model status: sentiment={sentiment_model is not None}, " + 
          f"summarization={summarization_model is not None}, " + 
          f"correction={correction_model is not None}")
    sys.stdout.flush()
    
    return True

# Initialize models in background thread
def background_initialize():
    threading.Thread(target=initialize_models, daemon=True).start()