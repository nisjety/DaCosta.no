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

# Expose port (Next.js defaults to 3000)
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
