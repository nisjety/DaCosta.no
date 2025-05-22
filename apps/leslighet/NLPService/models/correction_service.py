#!/usr/bin/env python3
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import sys
import os
import json

# Use a publicly available T5 model instead of the restricted NbAiLab model
MODEL_NAME = os.getenv('CORRECTION_MODEL', 't5-small')

try:
    print(f"Loading model {MODEL_NAME}...", file=sys.stderr)
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
    print(f"Model {MODEL_NAME} loaded successfully.", file=sys.stderr)
except Exception as e:
    print(f"Error loading model: {str(e)}", file=sys.stderr)
    sys.exit(1)

def generate_correction(text):
    try:
        # Prefix the input for grammar correction task
        prefix = "grammar: "
        
        # Handle different model expectations
        if "t5" in MODEL_NAME.lower():
            inputs = tokenizer.encode(prefix + text, return_tensors="pt", max_length=512, truncation=True)
        else:
            inputs = tokenizer(prefix + text, return_tensors="pt", max_length=512, truncation=True)
            
        # Generate the corrected text
        outputs = model.generate(
            inputs["input_ids"] if isinstance(inputs, dict) else inputs,
            max_length=512,
            num_beams=5,
            early_stopping=True
        )
        
        # Decode the output
        corrected_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        return corrected_text
    except Exception as e:
        print(f"Error in correction generation: {str(e)}", file=sys.stderr)
        return text  # Return the original text if correction fails

def main():
    try:
        # Read input text from command line arguments
        text = sys.argv[1] if len(sys.argv) > 1 else "Dette er en dårlig seting med feil grammatikk"
        
        # Generate correction
        corrected_text = generate_correction(text)
        
        # Print JSON response to stdout for the Node.js controller
        result = {"original": text, "corrected": corrected_text}
        print(json.dumps(result))
    except Exception as e:
        # Print error as JSON to maintain consistent output format
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
