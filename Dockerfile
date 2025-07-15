FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port (Zeabur uses 8080)
EXPOSE 8080

# Use the production server to avoid ts-node dependency
CMD ["npm", "run", "start:prod"] 