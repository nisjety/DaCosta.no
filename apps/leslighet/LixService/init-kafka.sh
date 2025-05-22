#!/bin/bash

# Kafka initialization script with environment support
# Set default compose file if not provided
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.dev.yml}

# Set proper environment name for display
if [[ "$COMPOSE_FILE" == *"prod"* ]]; then
  ENV_NAME="production"
else
  ENV_NAME="development"
fi

echo "Initializing Kafka for $ENV_NAME environment using $COMPOSE_FILE..."

# Wait for Kafka to be ready
echo "Waiting for Kafka to be ready..."
until docker-compose -f $COMPOSE_FILE exec -T kafka kafka-topics.sh --bootstrap-server kafka:9092 --list &> /dev/null
do
  echo "Kafka not yet ready, waiting..."
  sleep 5
done

echo "Kafka is ready. Creating topics..."

# Define the topics to create
TOPICS=(
  "text_analysis"
  "user_auth"
)

# Create topics if they don't exist
for TOPIC in "${TOPICS[@]}"; do
  if ! docker-compose -f $COMPOSE_FILE exec -T kafka kafka-topics.sh --bootstrap-server kafka:9092 --list | grep -q "^$TOPIC$"
  then
    echo "Creating $TOPIC topic..."
    docker-compose -f $COMPOSE_FILE exec -T kafka kafka-topics.sh --create --topic $TOPIC --bootstrap-server kafka:9092 --partitions 1 --replication-factor 1
    echo "Topic $TOPIC created successfully."
  else
    echo "Topic $TOPIC already exists."
  fi
done

echo "Kafka initialization completed for $ENV_NAME environment." 