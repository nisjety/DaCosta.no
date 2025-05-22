#!/bin/bash

# Enhanced control script for Docker Compose operations with environment support

# Default environment
ENV="dev"

# Parse environment argument if provided
if [ "$1" == "dev" ] || [ "$1" == "prod" ]; then
  ENV="$1"
  shift
fi

# Get the Docker Compose file based on environment
if [ "$ENV" == "prod" ]; then
  COMPOSE_FILE="docker-compose.prod.yml"
  ENV_NAME="production"
else
  COMPOSE_FILE="docker-compose.dev.yml"
  ENV_NAME="development"
fi

case "$1" in
  start)
    echo "Starting LixService in $ENV_NAME environment..."
    docker-compose -f $COMPOSE_FILE up -d
    echo "LixService is starting at http://localhost:8012"
    echo "Initializing Kafka topics..."
    COMPOSE_FILE=$COMPOSE_FILE ./init-kafka.sh
    echo "System is ready."
    
    if [ "$ENV" == "dev" ]; then
      echo "Development tools available at:"
      echo "  - Kafka UI: http://localhost:8080"
      echo "  - Prometheus: http://localhost:9090"
      echo "  - Grafana: http://localhost:3000 (admin/admin)"
    fi
    ;;
  stop)
    echo "Stopping LixService in $ENV_NAME environment..."
    docker-compose -f $COMPOSE_FILE down
    ;;
  restart)
    echo "Restarting LixService in $ENV_NAME environment..."
    docker-compose -f $COMPOSE_FILE down
    docker-compose -f $COMPOSE_FILE up -d
    echo "LixService is starting at http://localhost:8012"
    echo "Initializing Kafka topics..."
    COMPOSE_FILE=$COMPOSE_FILE ./init-kafka.sh
    echo "System is ready."
    ;;
  logs)
    echo "Showing logs for $ENV_NAME environment (Press Ctrl+C to exit)..."
    docker-compose -f $COMPOSE_FILE logs -f
    ;;
  kafka-logs)
    echo "Showing Kafka logs for $ENV_NAME environment (Press Ctrl+C to exit)..."
    docker-compose -f $COMPOSE_FILE logs -f kafka
    ;;
  app-logs)
    echo "Showing App logs for $ENV_NAME environment (Press Ctrl+C to exit)..."
    docker-compose -f $COMPOSE_FILE logs -f app
    ;;
  status)
    echo "LixService containers status in $ENV_NAME environment:"
    docker-compose -f $COMPOSE_FILE ps
    ;;
  rebuild)
    echo "Rebuilding and restarting LixService in $ENV_NAME environment..."
    docker-compose -f $COMPOSE_FILE down
    docker-compose -f $COMPOSE_FILE build
    docker-compose -f $COMPOSE_FILE up -d
    echo "LixService is starting at http://localhost:8012"
    echo "Initializing Kafka topics..."
    COMPOSE_FILE=$COMPOSE_FILE ./init-kafka.sh
    echo "System is ready."
    ;;
  kafka-topics)
    echo "Listing Kafka topics in $ENV_NAME environment..."
    docker-compose -f $COMPOSE_FILE exec kafka kafka-topics.sh --list --bootstrap-server kafka:9092
    ;;
  create-topic)
    if [ -z "$2" ]; then
      echo "Error: No topic name provided"
      echo "Usage: $0 [$ENV] create-topic TOPIC_NAME"
      exit 1
    fi
    echo "Creating Kafka topic in $ENV_NAME environment: $2"
    docker-compose -f $COMPOSE_FILE exec kafka kafka-topics.sh --create --topic "$2" --bootstrap-server kafka:9092 --partitions 1 --replication-factor 1
    ;;
  init-kafka)
    echo "Initializing Kafka topics in $ENV_NAME environment..."
    COMPOSE_FILE=$COMPOSE_FILE ./init-kafka.sh
    ;;
  clean)
    echo "Removing all containers and volumes in $ENV_NAME environment..."
    docker-compose -f $COMPOSE_FILE down -v
    echo "Cleaned up all resources."
    ;;
  shell)
    echo "Opening shell in app container in $ENV_NAME environment..."
    docker-compose -f $COMPOSE_FILE exec app /bin/bash
    ;;
  python)
    echo "Opening Python shell in app container in $ENV_NAME environment..."
    docker-compose -f $COMPOSE_FILE exec app python
    ;;
  test)
    echo "Running tests in $ENV_NAME environment..."
    docker-compose -f $COMPOSE_FILE exec app pytest
    ;;
  lint)
    echo "Running linters in $ENV_NAME environment..."
    docker-compose -f $COMPOSE_FILE exec app flake8 app/
    docker-compose -f $COMPOSE_FILE exec app isort --check-only app/
    docker-compose -f $COMPOSE_FILE exec app black --check app/
    ;;
  switch)
    if [ "$ENV" == "prod" ]; then
      echo "Switching to development environment..."
      ENV="dev"
    else
      echo "Switching to production environment..."
      ENV="prod"
    fi
    echo "Now using $ENV environment (docker-compose.$ENV.yml)"
    ;;
  *)
    echo "Usage: $0 [dev|prod] {start|stop|restart|logs|kafka-logs|app-logs|status|rebuild|kafka-topics|create-topic|init-kafka|clean|shell|python|test|lint|switch}"
    echo ""
    echo "Environment:"
    echo "  dev     Use development environment (default)"
    echo "  prod    Use production environment"
    echo ""
    echo "Commands:"
    echo "  start                Start the services"
    echo "  stop                 Stop the services"
    echo "  restart              Restart the services"
    echo "  logs                 Show logs for all services"
    echo "  kafka-logs           Show Kafka logs"
    echo "  app-logs             Show App logs"
    echo "  status               Show service status"
    echo "  rebuild              Rebuild and restart services"
    echo "  kafka-topics         List Kafka topics"
    echo "  create-topic NAME    Create a Kafka topic"
    echo "  init-kafka           Initialize Kafka topics"
    echo "  clean                Remove all containers and volumes"
    echo "  shell                Open shell in app container"
    echo "  python               Open Python shell in app container"
    echo "  test                 Run tests"
    echo "  lint                 Run linters"
    echo "  switch               Switch between dev and prod environments"
    exit 1
    ;;
esac

exit 0 