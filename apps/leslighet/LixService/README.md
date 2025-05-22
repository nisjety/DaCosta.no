# Readability Service

Dette prosjektet tilbyr en API-basert tjeneste for tekstanalyse, strukturert etter SOLID-prinsippene. Tjenesten er tilpasset norske voksne og benytter LIX og RIX for å vurdere tekstens kompleksitet, i tillegg til å gi en detaljert analyse per setning og per ord.

## Funksjoner

- ✅ FastAPI implementasjon
- ✅ Statisk filbetjening
- ✅ Pydantic responsmodeller
- ✅ WebSocket støtte for sanntidsanalyse
- ✅ SSE (Server-Sent Events) støtte
- ✅ Kafka-integrasjon for hendelsesstrømming (KRaft mode)
- ✅ Redis caching
- ✅ Prometheus/Grafana overvåkning
- ✅ Omfattende anbefalingssystem for tekstforbedring
- ✅ Modulær mikrotjenestearkitektur

## Ny arkitektur

Systemet er strukturert som mikrotjenester med fokus på enkelformål:

1. **LixService** - Spesialisert på lesbarhetsvurdering (LIX/RIX) og tekstanalyse
2. **GatewayService** - Koordinerer mellom tjenester og håndterer autentisering
3. **RecommendationService** - Avansert anbefalingssystem basert på metrikker

Denne modulære strukturen gir bedre skalerbarhet, vedlikeholdbarhet og fleksibilitet.

## Prosjektstruktur
```
readability-service/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── models.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── readability.py
│   │   ├── text_analysis.py
│   │   ├── recommendations.py
│   │   └── factory.py
│   └── static/
├── monitoring/
│   ├── prometheus/
│   │   ├── prometheus.yml
│   │   └── alerts.yml
│   └── grafana/
│       └── provisioning/
├── .env
├── requirements.txt
├── Dockerfile
├── Dockerfile.dev
├── Dockerfile.prod
├── docker-compose.yml
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── docker-control.sh
├── init-kafka.sh
└── README.md
```

## Bruksanvisning

### Miljøvariabler
Opprett en `.env`-fil i prosjektets rotmappe med følgende innhold:

```
# API Configuration
API_PORT=8000
API_HOST=0.0.0.0
API_WORKERS=4
API_RELOAD=false
API_DEBUG=false

# Kafka Configuration
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
KAFKA_TOPIC=text_analysis
KAFKA_AUTH_TOPIC=user_auth
KAFKA_GROUP_ID=lix_service_group

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=
REDIS_CACHE_TTL=3600

# Clerk Auth Configuration
CLERK_API_KEY=your_clerk_api_key
CLERK_JWT_PUBLIC_KEY=your_clerk_jwt_public_key

# Monitoring Configuration
PROMETHEUS_METRICS_PORT=8000
PROMETHEUS_METRICS_PATH=/metrics
ENABLE_METRICS=true

# Grafana Credentials (for production)
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=secure_password
```

### Utvikling og produksjon
Systemet støtter to miljøer:

1. **Utviklingsmiljø** (`docker-compose.dev.yml`)
   - Hot-reloading for kode
   - Debug-modus aktivert
   - Kafka UI verktøy på http://localhost:8080
   - Anonym tilgang til Grafana

2. **Produksjonsmiljø** (`docker-compose.prod.yml`)
   - Optimalisert for ytelse
   - Sikkerhetsforbedringer (ikke-root bruker)
   - Ressursbegrensninger
   - Datalagring og logging-konfigurasjon

### Docker Compose
Bruk `docker-control.sh` skriptet for å administrere miljøene:

```bash
# Utviklingsmiljø (standard)
./docker-control.sh start          # Start utviklingsmiljø
./docker-control.sh prod start     # Start produksjonsmiljø

./docker-control.sh stop           # Stopp utviklingsmiljø
./docker-control.sh prod stop      # Stopp produksjonsmiljø

./docker-control.sh logs           # Vis logger for utviklingsmiljø
./docker-control.sh prod logs      # Vis logger for produksjonsmiljø
```

### Overvåkning og metrikker
Systemet inkluderer komplett overvåkning:

- **Prometheus**: http://localhost:9090 - Samler metrikker hvert 5. sekund
- **Grafana**: http://localhost:3000 - Visualiserer metrikker med forhåndskonfigurerte dashboards
- **Helsekontroller**: Alle tjenester har helsekontroller
- **Ressursreservasjoner**: CPU og minne er begrenset (1 kjerne/1GB per tjeneste)

### Autentisering
Tjenesten bruker Clerk for autentisering:

1. Brukere autentiseres via Clerk
2. Clerk genererer JWT-tokens
3. JWT-tokens verifiseres av tjenesten
4. Brukerdata lagres i Redis

Autentisering er påkrevd for alle endepunkter unntatt `/health` og rotendepunktet.

### Redis caching
Systemet bruker Redis for:

1. Caching av analyseresultater (TTL: 1 time)
2. Lagring av brukerdata
3. Mellomlagring av Kafka-resultater

### Docker Control
For enklere administrasjon av Docker Compose-systemet, bruk det medfølgende skriptet:

1. **Gjør skriptene kjørbare**:
   ```bash
   chmod +x docker-control.sh
   chmod +x init-kafka.sh
   ```

2. **Tilgjengelige kommandoer**:
   ```bash
   ./docker-control.sh [dev|prod] COMMAND
   ```

   **Miljøer**:
   - `dev`: Utviklingsmiljø (standard)
   - `prod`: Produksjonsmiljø

   **Kommandoer**:
   - `start`: Starter tjenestene
   - `stop`: Stopper tjenestene
   - `restart`: Omstarter tjenestene
   - `logs`: Viser logger for alle tjenester
   - `app-logs`: Viser kun applikasjonslogger
   - `kafka-logs`: Viser kun Kafka-logger
   - `status`: Viser status for containere
   - `rebuild`: Bygger om og starter tjenestene på nytt
   - `kafka-topics`: Lister opp Kafka-topics
   - `create-topic TOPIC_NAME`: Oppretter nytt Kafka-topic
   - `init-kafka`: Initialiserer Kafka-topics
   - `clean`: Fjerner alle containere og volumer
   - `shell`: Åpner en shell i app-containeren
   - `python`: Åpner en Python-shell i app-containeren
   - `test`: Kjører tester
   - `lint`: Kjører linting-verktøy
   - `switch`: Bytter mellom utviklings- og produksjonsmiljø

3. **Eksempler**:
   ```bash
   ./docker-control.sh start               # Starter utviklingsmiljø
   ./docker-control.sh prod start          # Starter produksjonsmiljø
   ./docker-control.sh create-topic events # Oppretter topic 'events'
   ./docker-control.sh prod status         # Sjekker status i produksjonsmiljø
   ```

## API-endepunkter

### Kjerneendepunkter
- **POST /analyze** - Analyserer tekst og returnerer lesbarhetsvurdering og tekstanalyse.
- **GET /health** - Helsesjekk-endepunkt for tjenesten.
- **WebSocket /ws** - Sanntidsanalyse via WebSocket.
- **GET /sse** - Server-Sent Events strøm for sanntidsoppdateringer.
- **GET /kafka/latest** - Henter siste tekstanalyser fra Kafka.

### Redis Caching
Alle analyser caches i Redis med en TTL på 1 time (konfigurerbar). Dette gir:
- Raskere responstider for repeterte forespørsler
- Redusert belastning på backend-tjenester
- Robusthet ved midlertidige tjenestefeil

### Anbefalingssystem
Systemet har et omfattende anbefalingssystem som gir detaljerte forbedringsforslag basert på:

- Lesbarhetsmetrikker (LIX og RIX)
- Setningsstruktur og -lengde
- Ordkompleksitet og -frekvens
- Tekstflyt og -struktur
- Målgruppebaserte tilpasninger
- Brukerens kontekst (utdanning, forretning, etc.)

Hver anbefaling inkluderer:
- Type (f.eks. setningsstruktur, ordkompleksitet)
- Tittel og beskrivelse
- Konkrete forbedringsforslag
- Påvirkningsgrad (høy/medium/lav)
- Praktiske eksempler på før/etter forbedring

## Integrasjon med andre tjenester
LixService er designet for sømløs integrasjon med andre tjenester i et mikrotjenestemiljø:

- **RESTful API**: Standardiserte endepunkter for enkel integrasjon
- **Sanntidskommunikasjon**: WebSocket og SSE for direkteoppdateringer
- **Hendelsesstrømming**: Kafka-integrasjon for asynkron kommunikasjon
- **Caching**: Redis-basert caching for ytelsesoptimalisering

## Om lesbarhetsvurdering
LixService bruker to primære metrikker for lesbarhetsvurdering:

### LIX (Lesbarhetsindeks)
- **< 30**: Svært lettlest, barnebøker
- **30-40**: Lettlest, skjønnlitteratur, populæraviser
- **40-50**: Middels vanskelig, normalavis
- **50-60**: Vanskelig, sakprosa, akademiske tekster
- **> 60**: Svært vanskelig, forskningsartikler, juridiske dokumenter

### RIX (Readability Index)
- **< 2.0**: Barnehagenivå
- **2.0-3.0**: Grunnskolenivå
- **3.0-4.0**: Ungdomsskolenivå
- **4.0-5.0**: Videregående nivå
- **5.0-6.0**: Universitetsnivå
- **> 6.0**: Spesialistnivå/akademisk

## Lisens
Dette prosjektet er lisensiert under MIT-lisensen. Se LICENSE-filen for detaljer.