#!/usr/bin/env python3
"""
WSGI entry point for model loading
Compatible with both direct uvicorn execution and custom initialization
"""

import sys
import time
from model_api_server import app, create_simple_sentiment_model, create_simple_summarization_model, create_simple_correction_model, set_models

# This module is used both by the direct uvicorn command and for custom initialization scenarios

def initialize_models():
    """Initialize all models and return them as a dictionary"""
    loading_progress = {
        'sentiment': 0,
        'summarization': 0,
        'correction': 0,
        'overall': 0
    }
    
    # Load sentiment model
    print('Loading sentiment model...')
    sys.stdout.flush()
    loading_progress['sentiment'] = 10
    sentiment_model = create_simple_sentiment_model()
    loading_progress['sentiment'] = 100
    print('✓ Sentiment model loaded successfully!')
    sys.stdout.flush()
    
    # Load summarization model
    print('Loading summarization model...')
    sys.stdout.flush()
    loading_progress['summarization'] = 10
    summarization_model = create_simple_summarization_model()
    loading_progress['summarization'] = 100
    print('✓ Summarization model loaded successfully!')
    sys.stdout.flush()
    
    # Load correction model
    print('Loading correction model...')
    sys.stdout.flush()
    loading_progress['correction'] = 10
    correction_model = create_simple_correction_model()
    loading_progress['correction'] = 100
    print('✓ Correction model loaded successfully!')
    sys.stdout.flush()
    
    # Update overall progress
    loading_progress['overall'] = 100
    
    print('All models loaded and ready!')
    print(f'Model status: sentiment={sentiment_model is not None}, ' + 
          f'summarization={summarization_model is not None}, ' + 
          f'correction={correction_model is not None}')
    sys.stdout.flush()
    
    return {
        'sentiment': sentiment_model, 
        'summarization': summarization_model, 
        'correction': correction_model,
        'loading_progress': loading_progress
    }

# Called by uvicorn when loading the application
# This ensures the models are loaded when using a compatible ASGI server
def on_startup():
    """Function to run when the ASGI server starts"""
    print('ASGI server starting - initializing models...')
    sys.stdout.flush()
    models_dict = initialize_models()
    # Set the models in the FastAPI app
    set_models(models_dict)
    time.sleep(1)  # Ensure logs are flushed

# Register the startup handler with FastAPI
app.add_event_handler('startup', on_startup)

# For compatibility with gunicorn
def on_starting(server):
    """Function to run when gunicorn starts"""
    print('Gunicorn starting - initializing models...')
    sys.stdout.flush()
    models_dict = initialize_models()
    # Set the models in the FastAPI app
    set_models(models_dict)
    time.sleep(1)  # Ensure logs are flushed

# The ASGI application object exposed for uvicorn/gunicorn
application = app