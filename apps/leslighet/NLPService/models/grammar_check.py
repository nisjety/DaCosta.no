#!/usr/bin/env python3
import sys
import json
import os
import logging
import traceback
import re
from typing import List, Dict, Any, Tuple, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('grammar_check')

# Global model variables
nlp = None
transformer_model = None
transformer_tokenizer = None

def load_model():
    """Load the grammar models with better error handling"""
    global nlp, transformer_model, transformer_tokenizer
    try:
        logger.info("Loading SpaCy model for grammar checking...")
        import spacy
        
        # Try to load the Norwegian large model
        try:
            nlp = spacy.load("nb_core_news_lg")
            logger.info("✓ Loaded full Norwegian language model (nb_core_news_lg)")
        except Exception as e:
            logger.warning(f"Could not load large Norwegian model: {str(e)}")
            logger.warning("Falling back to medium Norwegian model...")
            
            try:
                nlp = spacy.load("nb_core_news_md")
                logger.info("✓ Loaded medium Norwegian language model (nb_core_news_md)")
            except Exception as e:
                logger.warning(f"Could not load medium Norwegian model: {str(e)}")
                logger.warning("Falling back to small Norwegian model...")
                
                try:
                    nlp = spacy.load("nb_core_news_sm")
                    logger.info("✓ Loaded small Norwegian language model (nb_core_news_sm)")
                except Exception as e:
                    logger.warning(f"Could not load small Norwegian model: {str(e)}")
                    logger.warning("Falling back to English model...")
                    
                    nlp = spacy.load("en_core_web_sm")
                    logger.info("✓ Loaded English language model (en_core_web_sm)")
        
        # Load transformer model for more advanced grammar checking
        try:
            logger.info("Loading transformer model for advanced grammar checking...")
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
            
            # If Norwegian model exists use that, otherwise fallback to English model
            try:
                model_name = "NbAiLab/nb-bart-large"  # Try to use Norwegian BART model
                transformer_tokenizer = AutoTokenizer.from_pretrained(model_name)
                transformer_model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
                logger.info(f"✓ Loaded transformer model: {model_name}")
            except Exception as e:
                logger.warning(f"Could not load Norwegian transformer model: {str(e)}")
                logger.warning("Falling back to English transformer model...")
                
                model_name = "facebook/bart-large"  # English fallback
                transformer_tokenizer = AutoTokenizer.from_pretrained(model_name)
                transformer_model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
                logger.info(f"✓ Loaded transformer model: {model_name}")
        except Exception as e:
            logger.warning(f"Could not load transformer model: {str(e)}")
            logger.warning("Will continue with SpaCy model only")
            transformer_model = None
            transformer_tokenizer = None
        
        return True
    except Exception as e:
        logger.error(f"Failed to load any SpaCy model: {str(e)}")
        logger.error(traceback.format_exc())
        return False

# Norwegian compound word patterns
COMPOUND_WORD_PATTERNS = [
    (r'(\w+) (\w+hus)', r'\1\2'),  # e.g., "skole hus" -> "skolehus"
    (r'(\w+) (\w+skap)', r'\1\2'),  # e.g., "venn skap" -> "vennskap" 
    (r'(\w+) (\w+tid)', r'\1\2'),   # e.g., "sommer tid" -> "sommertid"
    # Add more common Norwegian compound patterns
]

# Common wrong preposition patterns: (wrong pattern, correct suggestion, explanation)
PREPOSITION_PATTERNS = [
    (r'på (\d+)-tallet', r'i \1-tallet', 'Use "i" with decades/centuries'),
    (r'i (mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)', r'på \1', 'Use "på" with days of the week'),
    (r'i sommer', r'til sommeren', 'Consider "til sommeren" for future references'),
    # Add more preposition patterns
]

# Subject-verb agreement patterns
SUBJECT_VERB_PATTERNS = [
    # Examples for Norwegian (would need extensive patterns for real usage)
    (r'vi er', r'vi er', 'Correct subject-verb agreement'),
    (r'vi (har|er) ikke', r'vi \1 ikke', 'Correct negation placement'),
    # Add more patterns
]

def check_compound_words(text: str, doc) -> List[Dict[str, Any]]:
    """Check for incorrectly split compound words"""
    issues = []
    
    for pattern, correction in COMPOUND_WORD_PATTERNS:
        for match in re.finditer(pattern, text):
            wrong_form = match.group(0)
            corrected_form = re.sub(pattern, correction, wrong_form)
            
            # Check if the corrected form exists in the vocabulary
            if nlp.vocab.has_vector(corrected_form.lower()):
                issues.append({
                    'type': 'compound_word',
                    'position': match.start(),
                    'issue': wrong_form,
                    'suggestion': corrected_form,
                    'explanation': f'Dette ser ut til å være et sammensatt ord: "{corrected_form}"',
                    'severity': 'medium',
                    'source': 'compound-rules'
                })
    
    return issues

def check_prepositions(text: str) -> List[Dict[str, Any]]:
    """Check for incorrect preposition usage"""
    issues = []
    
    for pattern, correction, explanation in PREPOSITION_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            wrong_form = match.group(0)
            corrected_form = re.sub(pattern, correction, wrong_form, flags=re.IGNORECASE)
            
            issues.append({
                'type': 'preposition_usage',
                'position': match.start(),
                'issue': wrong_form,
                'suggestion': corrected_form,
                'explanation': explanation,
                'severity': 'medium',
                'source': 'preposition-rules'
            })
    
    return issues

def check_subject_verb_agreement(doc) -> List[Dict[str, Any]]:
    """Check for subject-verb agreement issues"""
    issues = []
    
    for sent in doc.sents:
        subjects = [token for token in sent if token.dep_ in ('nsubj', 'nsubjpass')]
        
        for subject in subjects:
            verb = None
            # Find the verb for this subject
            if subject.head.pos_ == 'VERB':
                verb = subject.head
            
            if verb and subject:
                # Convert to singular/plural - this is a simplification
                # Would need more sophisticated logic for a real grammar checker
                if subject.tag_.startswith('PRON_PERS') and verb.tag_.startswith('VERB'):
                    # Check for common pronoun-verb agreement issues
                    pronoun_verb_pair = f"{subject.text.lower()} {verb.text.lower()}"
                    
                    # Example check - would need extensive patterns for real usage
                    if subject.text.lower() == 'de' and verb.text.lower() == 'er':
                        # This is correct in Norwegian
                        continue
                    
                    # Check potential mismatch
                    if subject.morph.get('Number') and verb.morph.get('Number'):
                        if subject.morph.get('Number')[0] != verb.morph.get('Number')[0]:
                            issues.append({
                                'type': 'subject_verb_agreement',
                                'position': subject.idx,
                                'issue': f"{subject.text} {verb.text}",
                                'suggestion': f"{subject.text} [corrected verb form]", # Would need better suggestion
                                'explanation': f'Subjekt-verb samsvar: "{subject.text}" bør ha riktig verbform',
                                'severity': 'medium',
                                'source': 'spacy-rules'
                            })
    
    return issues

def check_word_order(doc) -> List[Dict[str, Any]]:
    """Check for word order issues in Norwegian"""
    issues = []
    
    for sent in doc.sents:
        tokens = [token for token in sent]
        
        # Check for V2 rule in main clauses (verb should be in second position)
        # This is a simplified check and would need more context
        if len(tokens) >= 3:
            has_subject = any(token.dep_ == 'nsubj' for token in tokens[:2])
            verb_pos = next((i for i, token in enumerate(tokens) if token.pos_ == 'VERB'), -1)
            
            # Simple check if verb is not in second position in a main clause
            if has_subject and verb_pos > 2:
                # This is an oversimplification - would need better contextual analysis
                issues.append({
                    'type': 'word_order',
                    'position': tokens[0].idx,
                    'issue': ' '.join([token.text for token in tokens[:4]]),
                    'suggestion': '[Verb should be in second position]', # Would need better suggestion
                    'explanation': 'I norsk kommer verbet vanligvis på andre plass i hovedsetninger (V2-regelen)',
                    'severity': 'medium',
                    'source': 'grammar-rules'
                })
    
    return issues

def check_punctuation_advanced(doc) -> List[Dict[str, Any]]:
    """Advanced punctuation checks"""
    issues = []
    
    # Check for missing comma before conjunctions that introduce subordinate clauses
    for i, token in enumerate(doc):
        if i > 0 and token.text.lower() in ('som', 'fordi', 'hvis', 'når', 'dersom', 'mens'):
            prev_token = doc[i-1]
            if prev_token.text != ',' and prev_token.pos_ != 'PUNCT':
                issues.append({
                    'type': 'missing_punctuation',
                    'position': prev_token.idx + len(prev_token.text),
                    'issue': f"{prev_token.text} {token.text}",
                    'suggestion': f"{prev_token.text}, {token.text}",
                    'explanation': f'Vurder å bruke komma før "{token.text}" når det innleder en leddsetning',
                    'severity': 'low',
                    'source': 'punctuation-rules'
                })
    
    # Check for space before punctuation (which is incorrect in Norwegian)
    text = doc.text
    for match in re.finditer(r'\s+([,.!?:;])', text):
        issues.append({
            'type': 'punctuation_spacing',
            'position': match.start(),
            'issue': match.group(0),
            'suggestion': match.group(1),
            'explanation': 'Ikke ha mellomrom før tegnsetting',
            'severity': 'low',
            'source': 'punctuation-rules'
        })
    
    return issues

def check_tense_consistency(doc) -> List[Dict[str, Any]]:
    """Check for tense consistency within a sentence or paragraph"""
    issues = []
    
    for sent in doc.sents:
        verbs = [token for token in sent if token.pos_ == 'VERB']
        if len(verbs) >= 2:
            # Get tense information when available
            verb_tenses = [token.morph.get('Tense') for token in verbs]
            verb_tenses = [tense[0] if tense else None for tense in verb_tenses]
            
            # Filter out None values
            valid_tenses = [tense for tense in verb_tenses if tense]
            
            # Check for inconsistency if we have enough valid tenses
            if len(valid_tenses) >= 2 and len(set(valid_tenses)) > 1:
                # There's a mix of tenses
                issues.append({
                    'type': 'tense_consistency',
                    'position': verbs[0].idx,
                    'issue': ' '.join([verb.text for verb in verbs]),
                    'suggestion': '[Use consistent tense]', # Would need better suggestion
                    'explanation': 'Verbene i setningen har ulike tempusformer. Vurder å bruke konsistent tempus.',
                    'severity': 'medium',
                    'source': 'grammar-rules'
                })
    
    return issues

def get_transformer_suggestions(text: str) -> List[Dict[str, Any]]:
    """Get grammar correction suggestions using transformer model"""
    if transformer_model is None or transformer_tokenizer is None:
        return []
    
    issues = []
    
    try:
        # Prepare the input with a prompt that guides the model toward grammar correction
        prompt = f"Fix grammar: {text}"
        inputs = transformer_tokenizer(prompt, return_tensors="pt", max_length=512, truncation=True)
        
        # Generate grammatically corrected text
        outputs = transformer_model.generate(
            inputs.input_ids, 
            max_length=512,
            num_beams=4, 
            early_stopping=True
        )
        
        corrected_text = transformer_tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Remove the prompt part if it's included in the output
        if corrected_text.startswith("Fix grammar:"):
            corrected_text = corrected_text[len("Fix grammar:"):].strip()
        
        # Only include if there's an actual difference
        if corrected_text != text:
            issues.append({
                'type': 'grammar_transformer',
                'position': 0,
                'issue': text,
                'suggestion': corrected_text,
                'explanation': 'Forslag til grammatisk forbedring fra AI-modell',
                'severity': 'medium',
                'source': 'transformer-model'
            })
    except Exception as e:
        logger.warning(f"Transformer model error: {str(e)}")
    
    return issues

def check_determiners_advanced(doc) -> List[Dict[str, Any]]:
    """Advanced determiner agreement checks"""
    issues = []
    
    det_noun_pairs = []
    for token in doc:
        if token.pos_ == "DET" and token.head.pos_ == "NOUN":
            det_noun_pairs.append((token, token.head))
    
    for det, noun in det_noun_pairs:
        # Check gender agreement
        det_gender = None
        noun_gender = None
        
        # Extract determiner gender
        if det.text.lower() in ["en", "denne", "min", "din", "sin", "hans", "hennes"]:
            det_gender = "masc"
        elif det.text.lower() in ["ei", "denne", "mi", "di", "si", "hans", "hennes"]:
            det_gender = "fem"
        elif det.text.lower() in ["et", "dette", "mitt", "ditt", "sitt", "hans", "hennes"]:
            det_gender = "neut"
        elif det.text.lower() in ["de", "disse", "mine", "dine", "sine", "deres"]:
            det_gender = "plur"
        
        # Extract noun gender and number
        noun_features = str(noun.morph)
        
        if "Gender=Masc" in noun_features:
            noun_gender = "masc"
        elif "Gender=Fem" in noun_features:
            noun_gender = "fem"
        elif "Gender=Neut" in noun_features:
            noun_gender = "neut"
        
        # Check number agreement (singular vs plural)
        det_number = "sing" if det_gender in ["masc", "fem", "neut"] else "plur"
        noun_number = "plur" if "Number=Plur" in noun_features else "sing"
        
        # Check for gender mismatch
        if det_gender and noun_gender and det_gender != noun_gender and det_gender != "plur":
            correct_det = {
                "masc": {"en": "en", "denne": "denne", "min": "min", "din": "din", "sin": "sin"},
                "fem": {"en": "ei", "denne": "denne", "min": "mi", "din": "di", "sin": "si"},
                "neut": {"en": "et", "denne": "dette", "min": "mitt", "din": "ditt", "sin": "sitt"}
            }
            
            base_det = det.text.lower()
            base_form = next((k for k in ["en", "denne", "min", "din", "sin"] if base_det in correct_det.get(det_gender, {}).get(k, "")), None)
            
            if base_form and noun_gender in correct_det and base_form in correct_det[noun_gender]:
                issues.append({
                    "type": "determiner_agreement",
                    "position": det.idx,
                    "issue": det.text,
                    "suggestion": correct_det[noun_gender][base_form],
                    "explanation": f"Artikkelen bør samsvare med substantivets kjønn ({noun.text})",
                    "severity": "medium",
                    "source": "spacy-rules"
                })
        
        # Check for number mismatch
        if det_number != noun_number:
            issues.append({
                "type": "determiner_number_agreement",
                "position": det.idx,
                "issue": f"{det.text} {noun.text}",
                "suggestion": "[Bruk samsvarende tall]", # Would need better suggestion 
                "explanation": f"Determinativ og substantiv bør samsvare i tall (entall/flertall)",
                "severity": "medium",
                "source": "spacy-rules"
            })
    
    return issues

def check_grammar(text):
    """Check grammar with enhanced comprehensive rules"""
    global nlp
    
    if nlp is None:
        # Attempt to load if not loaded yet
        if not load_model():
            return [{
                "type": "error", 
                "issue": "Grammar check model not available", 
                "explanation": "Could not load the language model",
                "severity": "high",
                "source": "grammar-check-error"
            }]
    
    try:
        # Process the text with SpaCy
        doc = nlp(text)
        
        # Initialize issues list
        issues = []
        
        # Basic checks from original implementation
        # Check for basic sentence capitalization
        for sent in doc.sents:
            first_token = sent[0]
            if first_token.is_alpha and not first_token.is_title and not first_token.is_punct:
                issues.append({
                    "type": "capitalization",
                    "position": first_token.idx,
                    "issue": first_token.text,
                    "suggestion": first_token.text.capitalize(),
                    "explanation": "Setninger bør begynne med stor bokstav",
                    "severity": "medium",
                    "source": "spacy-model"
                })
        
        # Check for double punctuation
        for i, token in enumerate(doc):
            if token.is_punct and i < len(doc) - 1 and doc[i+1].is_punct:
                if token.text == doc[i+1].text:
                    issues.append({
                        "type": "punctuation_usage",
                        "position": token.idx,
                        "issue": token.text + doc[i+1].text,
                        "suggestion": token.text,
                        "explanation": "Unødvendig dobbel tegnsetting",
                        "severity": "low",
                        "source": "spacy-model"
                    })
        
        # Add enhanced checks:
        
        # 1. Advanced determiner agreement
        issues.extend(check_determiners_advanced(doc))
        
        # 2. Compound word checks
        issues.extend(check_compound_words(text, doc))
        
        # 3. Preposition usage
        issues.extend(check_prepositions(text))
        
        # 4. Subject-verb agreement
        issues.extend(check_subject_verb_agreement(doc))
        
        # 5. Word order checks
        issues.extend(check_word_order(doc))
        
        # 6. Advanced punctuation checks
        issues.extend(check_punctuation_advanced(doc))
        
        # 7. Tense consistency
        issues.extend(check_tense_consistency(doc))
        
        # 8. Transformer model suggestions (if available)
        if transformer_model and transformer_tokenizer:
            # Only use transformer for longer texts where context matters more
            if len(text.split()) > 5:
                issues.extend(get_transformer_suggestions(text))
        
        # Sort issues by position for better presentation
        issues.sort(key=lambda x: x.get('position', 0))
        
        return issues
        
    except Exception as e:
        logger.error(f"Grammar check error: {str(e)}")
        logger.error(traceback.format_exc())
        return [{
            "type": "error", 
            "issue": "Feil under grammatikkontroll", 
            "explanation": str(e),
            "severity": "high",
            "source": "grammar-check-error"
        }]

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

    # Load model if not loaded
    if nlp is None and not load_model():
        print(json.dumps([{
            "type": "error", 
            "issue": "Could not load grammar model", 
            "explanation": "Failed to initialize SpaCy model",
            "severity": "high",
            "source": "grammar-check-error"
        }]))
        return
        
    # Run the grammar check
    issues = check_grammar(text)
    print(json.dumps(issues))

if __name__ == "__main__":
    main()
