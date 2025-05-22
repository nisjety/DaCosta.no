#!/bin/sh
set -e

# Wait for Redis to be ready
echo "Waiting for Redis..."
until nc -z ${REDIS_HOST:-redis} ${REDIS_PORT:-6369}; do
  echo "Redis is unavailable - sleeping"
  sleep 1
done
echo "Redis is up - continuing"

# Run the application
exec "$@"