# SpellChecker Microservice

A multilingual spell-checking microservice with support for Norwegian (Bokmål/Nynorsk) and English (British/American) dialects. This service provides both REST API and WebSocket interfaces for real-time spell checking.

## 📋 Features

- **Multilingual Support**: Norwegian and English with dialect variations
- **Real-time Spell Checking**: Both individual words and full text
- **Multiple Interfaces**: REST API and WebSocket for different use cases
- **Hyphenation**: Word hyphenation following language rules
- **Synonyms**: Word synonyms lookup
- **Dialect Settings**: Configurable dialect preferences
- **User Feedback**: System for users to contribute feedback on spelling corrections
- **Efficient Caching**: Memory-efficient caching for performance optimization
- **Health Monitoring**: Detailed health and statistics endpoints
- **Docker Ready**: Containerized for easy deployment

## 🏗️ Architecture

The SpellChecker microservice is designed with a clean, modular architecture:

```
┌───────────────────────────────────────────────────────────┐
│                 SpellChecker Microservice                 │
├───────────────────────────────────────────────────────────┤
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────────┐ │
│ │    REST API   │ │   WebSocket   │ │   Health Check    │ │
│ └───────┬───────┘ └───────┬───────┘ └─────────┬─────────┘ │
│         │                 │                   │           │
│ ┌───────┴─────────────────┴───────────────────┴───────┐   │
│ │                 Express Application                  │   │
│ └───────┬─────────────────┬───────────────────┬───────┘   │
│         │                 │                   │           │
│ ┌───────┴───────┐ ┌───────┴───────┐  ┌────────┴────────┐  │
│ │  Norwegian    │ │    English    │  │  Spell Checker  │  │
│ │ Spell Checker │ │ Spell Checker │  │ Feedback System │  │
│ └───────┬───────┘ └───────┬───────┘  └─────────────────┘  │
│         │                 │                               │
│ ┌───────┴─────────────────┴───────────────────────────┐   │
│ │                  Base Spell Checker                 │   │
│ └───────────────────────────┬───────────────────────────┘ │
│                             │                             │
│ ┌───────────────────────────┴───────────────────────────┐ │
│ │                      Redis Cache                      │ │
│ └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

## 🚀 Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 16+ (for development only)
- Redis

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/spellchecker-service.git
   cd spellchecker-service
   ```

2. Start with Docker Compose:
   ```bash
   docker-compose up -d
   ```

3. Verify the service is running:
   ```bash
   curl http://localhost:5002/api/v1/health
   ```

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables (copy from .env.sample):
   ```bash
   cp .env.sample .env
   ```

3. Start Redis:
   ```bash
   docker-compose up -d redis
   ```

4. Run in development mode:
   ```bash
   npm run dev
   ```

## 🔌 API Endpoints

### REST API

#### Health Check
```
GET /api/v1/health
```

Returns service health information and dialect settings.

#### Norwegian Spell Check

Individual word check:
```
POST /api/v1/norwegian/spell
Body: { "word": "eksampel" }
```

Full text check:
```
POST /api/v1/norwegian/check-text
Body: { "text": "Dette er en eksampel." }
```

#### English Spell Check

Individual word check:
```
POST /api/v1/english/spell
Body: { "word": "exemple" }
```

Full text check:
```
POST /api/v1/english/check-text
Body: { "text": "This is an exemple." }
```

#### Dialect Settings

Norwegian dialects:
```
POST /api/v1/norwegian/settings
Body: { "dialects": { "nb": true, "nn": false } }
```

English dialects:
```
POST /api/v1/english/settings
Body: { "dialects": { "gb": true, "us": true } }
```

#### Additional Endpoints

- `POST /api/v1/norwegian/hyphenate` - Hyphenate a Norwegian word
- `POST /api/v1/english/hyphenate` - Hyphenate an English word
- `POST /api/v1/norwegian/synonyms` - Get synonyms for a Norwegian word
- `POST /api/v1/english/synonyms` - Get synonyms for an English word
- `POST /api/v1/english/dialect-variations` - Get dialect variations for an English word

### WebSocket API

Connect to:
```
ws://localhost:5002/api/ws
```

Message formats:

**Set Language Preference:**
```json
{
  "action": "setLanguage",
  "language": "english"
}
```

**Check Text:**
```json
{
  "action": "checkText",
  "text": "This is an exemple.",
  "language": "english",
  "dialectSettings": { "gb": true, "us": true }
}
```

**Set Dialect Settings:**
```json
{
  "action": "setDialects",
  "language": "norwegian",
  "nb": true,
  "nn": false
}
```

**Get Dialect Settings:**
```json
{
  "action": "getDialects",
  "language": "norwegian"
}
```

**Ping/Pong:**
```json
{
  "action": "ping"
}
```

## 🔒 Authentication

### Header-Based Authentication

The Spellchecker microservice is configured to use header-based authentication from an API gateway.

To authenticate requests:

1. Set the `AUTH_ENABLED` environment variable to `true`
2. The gateway should provide the following headers:
   - `x-user-id`: The unique identifier for the user
   - `x-user-roles` (optional): JSON array of user roles
   - `x-user-permissions` (optional): JSON array of user permissions
   - `x-organization-id` (optional): Organization identifier

Example:
```
GET /api/v1/user
x-user-id: user-123
x-user-roles: ["user", "editor"]
x-user-permissions: ["spell-check:basic", "spell-check:advanced"]
```

For WebSocket connections, the same headers should be included in the WebSocket upgrade request.

## 🧩 Microservices Integration

The SpellChecker service is designed to work as part of a larger microservices architecture:

1. **API Gateway**: For routing, authentication, and load balancing
2. **Redis/Dragonfly**: For caching and PubSub messaging
3. **RabbitMQ** (optional): For event-driven communication
4. **Ngrok**: For exposing the service publicly during development

### Redis PubSub Integration

The SpellCheck service uses Redis PubSub for real-time communication:

```
REDIS_HOST=redis
REDIS_PORT=6379
```

### RabbitMQ Integration (Optional)

For more advanced event-driven architectures, RabbitMQ integration is available:

```
RABBITMQ_ENABLED=true
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_EXCHANGE=spellcheck-exchange
RABBITMQ_USER_EVENTS_QUEUE=user-events-queue
RABBITMQ_USER_EVENTS_ROUTING_KEY=user.events
```

## 🛠️ Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_PORT` | Port for the service | `5002` |
| `APP_HOST` | Host to bind to | `0.0.0.0` |
| `REDIS_HOST` | Redis host | `redis` |
| `REDIS_PORT` | Redis port | `6379` |
| `CACHE_MAX_SIZE` | Maximum cache size | `10000` |
| `AUTH_ENABLED` | Enable authentication | `false` |
| `CORS_ENABLED` | Enable CORS | `true` |
| `CORS_ORIGINS` | Allowed origins | `*` |
| `RABBITMQ_ENABLED` | Enable RabbitMQ | `false` |

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.
