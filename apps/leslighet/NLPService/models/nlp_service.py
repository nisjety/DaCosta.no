#!/usr/bin/env python3
import sys
import json
import spacy
import os

def main():
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

    try:
        # Load the Norwegian large model
        nlp = spacy.load("nb_core_news_lg")
    except Exception as e:
        print(json.dumps({"error": f"Failed to load model: {str(e)}"}))
        sys.exit(1)

    doc = nlp(text)
    tokens = []
    for token in doc:
        tokens.append({
            "id": token.i,
            "form": token.text,
            "lemma": token.lemma_,
            "upos": token.pos_,
            "xpos": token.tag_,
            "feats": token.morph.to_dict(),
            "head": token.head.i,
            "deprel": token.dep_,
            "misc": ""
        })
    print(json.dumps(tokens, ensure_ascii=False))

if __name__ == "__main__":
    main()
