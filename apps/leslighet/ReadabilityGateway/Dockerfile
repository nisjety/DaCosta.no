FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Create utils directory if not exists
RUN mkdir -p ./utils

# The redis_pubsub.js will be mounted as a volume in docker-compose

# Expose the application port
EXPOSE 5000

# Start the service
CMD ["node", "app.js"]