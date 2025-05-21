# Use official Node.js base image
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy only the Next.js app folder (adjust if needed)
COPY apps/portefolio ./ 

# Install dependencies
RUN npm install

# Build the app
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000", "--hostname", "0.0.0.0"]

