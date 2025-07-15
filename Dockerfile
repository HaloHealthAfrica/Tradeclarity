# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the working JavaScript server
COPY server-simple.js ./
COPY utils/ ./utils/

# Copy frontend and build it
COPY frontend/ ./frontend/
WORKDIR /app/frontend
RUN npm ci
RUN npm run build

# Switch back to main directory
WORKDIR /app

# Create logs directory
RUN mkdir -p logs

# Verify the build directory exists and show its contents
RUN ls -la frontend/build/
RUN ls -la frontend/build/static/

# Expose port 8080 for Zeabur
EXPOSE 8080

# Start the working JavaScript server
CMD ["node", "server-simple.js"] 