FROM node:18-alpine AS base

# Create app directory
WORKDIR /usr/src/app

# Install dependencies only when needed
FROM base AS deps
COPY package.json ./
RUN npm install --omit=dev

# Production image
FROM base AS production
WORKDIR /usr/src/app

# Copy node modules and source code
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

# Create necessary directories and fix permissions
RUN mkdir -p data public && chmod -R 755 src/ && chown -R node:node /usr/src/app

# Set environment variables for port configuration 
# Using consistent port numbers
ENV API_PORT=3001
ENV WEBSOCKET_PORT=3002

# Use non-root user
USER node

# Expose API and WebSocket ports
EXPOSE 3001
EXPOSE 3002

# Command to run the application using explicit path
CMD ["node", "/usr/src/app/src/index.js"]