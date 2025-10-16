FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package manifests first to leverage Docker cache
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application files
COPY . .

# Expose the port the app listens on
EXPOSE 3000

# Ensure production mode
ENV NODE_ENV=production

# Start the app
CMD ["node", "server.js"]
