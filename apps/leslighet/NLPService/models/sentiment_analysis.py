#!/usr/bin/env python3
import sys
import json
import os
import re
import logging
import traceback
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('sentiment_analysis')

# Global model variables
sentiment_analyzer = None
model_name = None

# Define model options with fallbacks if the main model fails
MODEL_OPTIONS = [
    "NbAiLab/nb-bert-base",      # Primary Norwegian model
    "distilbert-base-uncased-finetuned-sst-2-english",  # English fallback
    "nlptown/bert-base-multilingual-uncased-sentiment"  # Multilingual fallback
]

def load_model(model_option=0, retry_count=0, max_retries=2):
    """Load the sentiment analysis model with fallback options"""
    global sentiment_analyzer, model_name
    
    if model_option >= len(MODEL_OPTIONS):
        logger.error(f"No more model options left. Failed to load any sentiment model after trying {model_option} options")
        return False
    
    current_model = MODEL_OPTIONS[model_option]
    logger.info(f"Loading sentiment model {current_model} (attempt {retry_count + 1})")
    
    try:
        # Import here to allow for easier error handling
        from transformers import pipeline
        
        # Try to load the model
        sentiment_analyzer = pipeline(
            "text-classification", 
            model=current_model,
            return_all_scores=True,
            device=-1  # Force CPU for better compatibility
        )
        model_name = current_model
        
        logger.info(f"✓ Successfully loaded sentiment model: {current_model}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to load sentiment model {current_model}: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Retry logic
        if retry_count < max_retries:
            logger.info(f"Retrying the same model in 2 seconds...")
            time.sleep(2)
            return load_model(model_option, retry_count + 1, max_retries)
        
        # Try next model option
        logger.info(f"Trying next model option...")
        return load_model(model_option + 1, 0, max_retries)

def analyze_sentiment_with_fallback(text):
    """Simple rule-based sentiment analysis as fallback"""
    # Basic positive and negative word lists (simplified)
    positive_words = ['good', 'great', 'excellent', 'bra', 'fin', 'flott', 'utmerket', 'fantastisk']
    negative_words = ['bad', 'terrible', 'awful', 'poor', 'dårlig', 'forferdelig', 'elendig', 'trist']
    
    text_lower = text.lower()
    pos_count = sum(1 for word in positive_words if word in text_lower)
    neg_count = sum(1 for word in negative_words if word in text_lower)
    
    if pos_count > neg_count:
        return "positiv", 0.6, pos_count/(pos_count + neg_count + 0.1)
    elif neg_count > pos_count:
        return "negativ", -0.6, neg_count/(pos_count + neg_count + 0.1)
    else:
        return "nøytral", 0, 0.5

def analyze_sentiment(text):
    """Analyze sentiment using the loaded model or fallback method"""
    global sentiment_analyzer, model_name
    
    # Check if model needs to be loaded
    if sentiment_analyzer is None and not load_model():
        # Failed to load any model, use basic rule-based fallback
        sentiment, score, confidence = analyze_sentiment_with_fallback(text)
        
        return {
            "sentiment": sentiment,
            "score": abs(score),
            "analysisType": "rule-based-fallback",
            "model": "basic-fallback-no-model",
            "confidence": confidence,
            "error": "Could not load any sentiment model"
        }
    
    try:
        # Split text into sentences for more accurate analysis
        sentences = re.split(r'(?<=[.!?])\s+', text)
        if not sentences or all(len(s.strip()) < 3 for s in sentences):
            sentences = [text]
        
        sentence_sentiments = []
        overall_score = 0
        
        for sentence in sentences:
            if len(sentence.strip()) < 3:
                continue
            
            results = sentiment_analyzer(sentence)
            scores = results[0]
            
            # Different models have different label schemes
            pos_score = neg_score = neut_score = 0
            
            # Handle different labeling schemes from different models
            for score in scores:
                label = score["label"].lower()
                if any(pos_term in label for pos_term in ["positive", "pos", "5", "4"]):
                    pos_score = score["score"]
                elif any(neg_term in label for neg_term in ["negative", "neg", "1", "2"]):
                    neg_score = score["score"]
                elif any(neut_term in label for neut_term in ["neutral", "3"]):
                    neut_score = score["score"]
            
            # Determine sentiment based on scores
            if pos_score > neg_score and pos_score > neut_score:
                sentiment = "positiv"
                sentence_score = pos_score
            elif neg_score > pos_score and neg_score > neut_score:
                sentiment = "negativ"
                sentence_score = -neg_score
            else:
                sentiment = "nøytral"
                sentence_score = 0
            
            overall_score += sentence_score
            sentence_sentiments.append({
                "sentence": sentence,
                "sentiment": sentiment,
                "score": sentence_score
            })
        
        # Calculate overall sentiment
        if sentence_sentiments:
            overall_score = overall_score / len(sentence_sentiments)
            if overall_score > 0.2:
                overall_sentiment = "positiv"
            elif overall_score < -0.2:
                overall_sentiment = "negativ"
            else:
                overall_sentiment = "nøytral"
            overall_confidence = min(0.99, 0.5 + abs(overall_score))
        else:
            overall_sentiment = "nøytral"
            overall_confidence = 0.5
        
        return {
            "sentiment": overall_sentiment,
            "score": float(abs(overall_score)),
            "analysisType": "AI",
            "model": model_name or "unknown",
            "confidence": float(overall_confidence),
            "sentence_analysis": sentence_sentiments
        }
        
    except Exception as e:
        logger.error(f"Sentiment analysis error: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Fall back to simple rule-based analysis
        sentiment, score, confidence = analyze_sentiment_with_fallback(text)
        
        return {
            "sentiment": sentiment,
            "score": abs(score),
            "analysisType": "rule-based-fallback",
            "model": "basic-fallback",
            "confidence": confidence,
            "error": str(e)
        }

def main():
    """Main entry point for standalone usage"""
    # Get input text from command-line argument or file
    if len(sys.argv) < 2:
        text = ""
    else:
        arg = sys.argv[1]
        if arg.startswith('@'):
            file_path = arg[1:]
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    text = f.read()
            else:
                text = ""
        else:
            text = arg
    
    # Run the sentiment analysis
    result = analyze_sentiment(text)
    print(json.dumps(result))

if __name__ == "__main__":
    main()
