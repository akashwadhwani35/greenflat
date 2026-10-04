# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and tsconfig
COPY package*.json tsconfig.json tsconfig.scripts.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# The marketing demo seeder runs as a one-off Cloud Run job from this image,
# because that is the only place with a working path to the database.
RUN npx tsc -p tsconfig.scripts.json

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy database schema for migrations
COPY src/database ./src/database

# Static assets served at /public (email logo)
COPY public ./public

# Expose port
EXPOSE 8080

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Start the server
CMD ["node", "dist/index.js"]
