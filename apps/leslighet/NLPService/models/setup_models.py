#!/usr/bin/env python3
import os
import sys
import subprocess
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline

def print_section(title):
    print(f"\n{'=' * 50}")
    print(f" {title}")
    print(f"{'=' * 50}\n")

def check_gpu():
    if torch.cuda.is_available():
        device_count = torch.cuda.device_count()
        device_names = [torch.cuda.get_device_name(i) for i in range(device_count)]
        print(f"✓ GPU available: {device_count} device(s)")
        for i, name in enumerate(device_names):
            print(f"  - Device {i}: {name}")
        return True
    else:
        print("⚠ No GPU detected. Models will run on CPU.")
        return False

def download_spacy_model():
    print_section("Setting up SpaCy Norwegian Model")
    
    try:
        import spacy
        print(f"✓ SpaCy version: {spacy.__version__}")
        
        # Check if Norwegian model is installed
        try:
            nlp = spacy.load("nb_core_news_lg")
            print("✓ Norwegian SpaCy model (nb_core_news_lg) already installed")
        except OSError:
            print("Downloading Norwegian SpaCy model (nb_core_news_lg)...")
            # Use system Python to install the model to ensure it goes to the right environment
            subprocess.check_call([
                sys.executable, "-m", "pip", "install", 
                "https://github.com/explosion/spacy-models/releases/download/nb_core_news_lg-3.6.0/nb_core_news_lg-3.6.0-py3-none-any.whl"
            ])
            print("✓ Norwegian SpaCy model (nb_core_news_lg) installed")
            
    except ImportError:
        print("⚠ SpaCy not installed. Run pip install -r requirements.txt first")
        return False
    
    return True

def download_nb_bert():
    print_section("Setting up NB-BERT Model for Sentiment Analysis")
    
    try:
        # Test loading the model to ensure it's downloaded
        print("Downloading/Loading NbAiLab/nb-bert-base...")
        sentiment_analyzer = pipeline(
            "text-classification", 
            model="NbAiLab/nb-bert-base",
            return_all_scores=True
        )
        print("✓ NB-BERT model installed successfully")
        
        # Test the model with a simple sentence
        test_text = "Dette er en veldig god test."
        print(f"\nTesting sentiment analysis with: '{test_text}'")
        result = sentiment_analyzer(test_text)
        print(f"Result: {result}")
        
        return True
        
    except Exception as e:
        print(f"⚠ Error setting up NB-BERT model: {str(e)}")
        return False

def download_mbart():
    print_section("Setting up mBART Model for Summarization")
    
    try:
        # Test loading the model to ensure it's downloaded
        print("Downloading/Loading facebook/mbart-large-cc25...")
        summarizer = pipeline("summarization", model="facebook/mbart-large-cc25")
        print("✓ mBART model installed successfully")
        
        # Test the model with a simple paragraph
        test_text = "Dette er en test paragraf. Den inneholder flere setninger. Vi tester om mBART kan oppsummere norsk tekst."
        print(f"\nTesting summarization with sample text...")
        result = summarizer(test_text, max_length=50, min_length=10, do_sample=False)
        print(f"Summary: {result[0]['summary_text']}")
        
        return True
        
    except Exception as e:
        print(f"⚠ Error setting up mBART model: {str(e)}")
        return False

def download_nb_t5():
    print_section("Setting up NbAiLab T5 Model for Text Correction")
    
    try:
        # Test loading the model to ensure it's downloaded
        print("Downloading/Loading NbAiLab/nb-t5-base...")
        tokenizer = AutoTokenizer.from_pretrained("NbAiLab/nb-t5-base")
        model = AutoModelForSeq2SeqLM.from_pretrained("NbAiLab/nb-t5-base")
        print("✓ NbAiLab T5 model installed successfully")
        
        # Test the model with a simple sentence
        test_text = "Dette er en dårlig seting med feil grammatikk."
        print(f"\nTesting text correction with: '{test_text}'")
        inputs = tokenizer.encode("correct: " + test_text, return_tensors="pt", max_length=512, truncation=True)
        outputs = model.generate(inputs, max_length=512, num_beams=5, early_stopping=True)
        corrected_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        print(f"Corrected: {corrected_text}")
        
        return True
        
    except Exception as e:
        print(f"⚠ Error setting up NbAiLab T5 model: {str(e)}")
        return False

def main():
    print_section("AI Model Setup Script")
    print("This script will download and prepare all required models for the AI Service.")
    
    # Create a model cache directory if it doesn't exist
    os.makedirs(os.path.join(os.path.dirname(__file__), "cache"), exist_ok=True)
    
    # Set the transformers cache to a local directory
    os.environ["TRANSFORMERS_CACHE"] = os.path.join(os.path.dirname(__file__), "cache")
    
    # Check for GPU
    has_gpu = check_gpu()
    
    # Download and test each model
    success_spacy = download_spacy_model()
    success_bert = download_nb_bert()
    success_mbart = download_mbart()
    success_t5 = download_nb_t5()
    
    # Summary
    print_section("Setup Summary")
    print(f"SpaCy Norwegian Model: {'✓ Success' if success_spacy else '⚠ Failed'}")
    print(f"NB-BERT Model: {'✓ Success' if success_bert else '⚠ Failed'}")
    print(f"mBART Model: {'✓ Success' if success_mbart else '⚠ Failed'}")
    print(f"NbAiLab T5 Model: {'✓ Success' if success_t5 else '⚠ Failed'}")
    print(f"GPU Support: {'✓ Available' if has_gpu else '⚠ Not available'}")
    
    if all([success_spacy, success_bert, success_mbart, success_t5]):
        print("\n✓ All models setup successfully! The AI Service is ready to use.")
    else:
        print("\n⚠ Some models failed to install. Check the logs above.")

if __name__ == "__main__":
    main()