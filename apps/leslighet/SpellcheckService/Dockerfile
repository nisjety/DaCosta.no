# Use the official Node.js 18 image as the base
FROM node:23-slim

# Set the working directory inside the container
WORKDIR /app

# Install required system dependencies for node-gyp and health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json to the container
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5002

# Expose the port that the app uses
EXPOSE 5002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5002/api/v1/health || exit 1

# Start the application
CMD ["node", "server.js"]