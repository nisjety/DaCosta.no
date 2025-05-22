# AI Service - FastAPI Model API

A specialized Python-based service providing text analysis capabilities using FastAPI. This service has been updated to remove the Node.js layer and expose the model API directly.

## Purpose

This service provides NLP and text analysis functionality for Norwegian texts, including:

- Grammar correction for Norwegian
- Sentiment analysis
- Text summarization
- Text correction with real-time feedback via WebSockets

## API Endpoints

All endpoints can be accessed directly from the model API server running on port 5014.

### Health Check
- **GET** `/api/health`
- Returns the current status of all models and the service

### Sentiment Analysis
- **POST** `/api/sentiment`
- Request body: `{ "text": "Text to analyze" }`
- Returns sentiment analysis, including sentiment label and confidence score

### Text Summarization
- **POST** `/api/summarize`
- Request body: `{ "text": "Text to summarize" }`
- Returns a concise summary of the provided text

### Text Correction
- **POST** `/api/correct`
- Request body: `{ "text": "Text to correct", "sessionId": "optional-session-id" }`
- Returns corrected text with details about changes

### WebSocket Grammar Correction
- **WebSocket** `/ws/grammar`
- Send: `{ "text": "Text to check", "sessionId": "optional-session-id" }`
- Receive: Real-time grammar correction updates

## Running the Service

### Local Development

To run the service locally without Docker:

```bash
cd /path/to/AIService
pip install -r models/requirements.txt
python models/model_api_server.py
```

### Docker Deployment

To run using Docker:

```bash
cd /path/to/AIService
docker-compose build
docker-compose up -d
```

The service will be available at http://localhost:5014

## Security

All endpoints can be secured by setting an API key:

```bash
export API_KEY=your-secure-api-key
```

When set, all requests must include the `X-API-Key` header with this value.

## Frontend Testing

HTML test pages are available in the `public` folder:

- `/public/grammar-realtime.html` - Test real-time grammar correction via WebSocket
- `/public/text-transformations.html` - Test various text transformations

You can access these pages directly through the model API server when running locally.

### Text Correction
- **POST** `/api/correct`
- Request body: `{ "text": "Text to correct" }`
- Returns spelling and grammar corrections for the provided text

### WebSocket Grammar API
- Connect to `/ws/grammar` for real-time grammar correction
- Send JSON: `{ "text": "Text to analyze", "sessionId": "optional-session-id" }`
- Receive real-time corrections with debouncing

## Setup

1. Install Python dependencies:
```bash
cd models
pip install -r requirements.txt
```

2. Run the model API server:
```bash
cd models
uvicorn model_api_server:app --host 0.0.0.0 --port 5014
```

## Docker Setup

1. Build and start the service:
```bash
npm start
```

Alternatively, use Docker:
```bash
docker-compose up -d
```

## Python Models

The service requires Python 3.9+ and the following models:
- nb_core_news_lg (SpaCy)
- NbAiLab/nb-bert-base
- facebook/mbart-large-cc25
- NbAiLab/nb-t5-base

Install Python dependencies:
```bash
pip install -r models/requirements.txt
```

## For Developers

Each AI capability is implemented as a separate Python script in the `models/` directory, with a corresponding JavaScript service in `src/services/` that handles the communication between the Node.js server and the Python scripts.
