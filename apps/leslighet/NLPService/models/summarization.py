#!/usr/bin/env python3
import sys
import json
import os
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
logger = logging.getLogger('summarization')

# Global model variables
summarizer = None
model_name = None

# Define lighter model options if the main model fails
MODEL_OPTIONS = [
    "facebook/mbart-large-cc25",  # Main model, multilingual
    "facebook/mbart-large-50",    # Alternative multilingual model
    "sshleifer/distilbart-cnn-12-6",  # English fallback, but lighter
    "facebook/bart-large-cnn"     # Another English fallback
]

def load_model(model_option=0, retry_count=0, max_retries=2):
    """Load the summarization model with fallback options"""
    global summarizer, model_name
    
    if model_option >= len(MODEL_OPTIONS):
        logger.error(f"No more model options left. Failed to load any summarization model after trying {model_option} options")
        return False
    
    current_model = MODEL_OPTIONS[model_option]
    logger.info(f"Loading summarization model {current_model} (attempt {retry_count + 1})")
    
    try:
        # Import here to allow for easier error handling
        from transformers import pipeline
        
        # Define a specific shorter timeout for model loading
        start_time = time.time()
        timeout = 30  # seconds
        
        # Try to load the model
        summarizer = pipeline("summarization", model=current_model, device=-1)  # Force CPU with device=-1
        model_name = current_model
        
        logger.info(f"✓ Successfully loaded summarization model: {current_model}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to load summarization model {current_model}: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Retry logic
        if retry_count < max_retries:
            logger.info(f"Retrying the same model in 2 seconds...")
            time.sleep(2)
            return load_model(model_option, retry_count + 1, max_retries)
        
        # Try next model option
        logger.info(f"Trying next model option...")
        return load_model(model_option + 1, 0, max_retries)

def create_extractive_summary(text):
    """Create a simple extractive summary as a fallback"""
    sentences = text.replace('!', '.').replace('?', '.').split('.')
    sentences = [s.strip() for s in sentences if s.strip()]
    
    selected = []
    if sentences:
        selected.append(sentences[0])
        if len(sentences) > 2:
            selected.append(sentences[len(sentences) // 2])
        if len(sentences) > 1:
            selected.append(sentences[-1])
    
    fallback_summary = '. '.join(selected)
    if not fallback_summary.endswith('.') and fallback_summary:
        fallback_summary += '.'
        
    return fallback_summary

def summarize_text(text):
    """Summarize the given text using the loaded model or fallback methods"""
    global summarizer, model_name
    
    # Check if model needs to be loaded
    if summarizer is None and not load_model():
        # Failed to load any model, use basic extractive summary
        fallback_summary = create_extractive_summary(text)
        
        return {
            "summary": fallback_summary,
            "originalLength": len(text),
            "summaryLength": len(fallback_summary),
            "compressionRatio": round(len(fallback_summary) / max(1, len(text)), 2),
            "analysisType": "fallback-extractive",
            "model": "basic-fallback-no-model",
            "error": "Could not load any summarization model"
        }
    
    try:
        # Check if the text is too short for summarization
        if len(text.strip()) < 50:
            return {
                "summary": text,
                "originalLength": len(text),
                "summaryLength": len(text),
                "compressionRatio": 1.0,
                "analysisType": "no-summary-needed",
                "model": model_name or "unknown"
            }
        
        # Calculate target summary length (about 30% of original)
        max_length = min(150, max(30, int(len(text) * 0.3)))
        min_length = max(20, int(max_length * 0.5))
        
        # Generate summary
        output = summarizer(text, max_length=max_length, min_length=min_length, do_sample=False)
        summary = output[0]['summary_text']
        
        return {
            "summary": summary,
            "originalLength": len(text),
            "summaryLength": len(summary),
            "compressionRatio": round(len(summary) / max(1, len(text)), 2),
            "analysisType": "extractive",
            "model": model_name or "unknown"
        }
    except Exception as e:
        logger.error(f"Summarization error: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Fall back to a simple extractive summary
        fallback_summary = create_extractive_summary(text)
            
        return {
            "summary": fallback_summary,
            "originalLength": len(text),
            "summaryLength": len(fallback_summary),
            "compressionRatio": round(len(fallback_summary) / max(1, len(text)), 2),
            "analysisType": "fallback-extractive",
            "model": "basic-fallback",
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
    
    # Run the summarization
    result = summarize_text(text)
    print(json.dumps(result))

if __name__ == "__main__":
    main()
