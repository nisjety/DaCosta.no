# Spell Checker Microservice API Documentation

## Endpoints

### POST /api/spell/check
Checks the spelling of a word.

**Request Body:**
```json
{
  "word": "misspelledWord",
  "context": "Optional sentence context for NLP analysis."
}
```

**Response:**
```json
{
  "correct": false,
  "suggestions": ["suggestion1", "suggestion2", ...]
}
```

### POST /api/spell/add
Adds a new word to the dictionary.

**Request Body:**
```json
{
  "word": "newWord"
}
```

**Response:**
```json
{
  "success": true
}
```
