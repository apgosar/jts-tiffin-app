# Stage 1: Build the React client
FROM node:22-alpine AS build
WORKDIR /app

# Copy client package files
COPY client/package.json client/package-lock.json ./client/
# Install client dependencies (including devDependencies for build)
RUN cd client && npm install

# Copy client source code
COPY client/ ./client/
# Build the client
RUN cd client && npm run build

# Stage 2: Production server
FROM node:22-alpine
WORKDIR /app

# Copy server package files
COPY package.json package-lock.json ./
# Install ONLY production dependencies for the server (excludes Playwright/Jest)
RUN npm install --omit=dev --ignore-scripts

# Copy server source code (server.js, scripts, etc.)
# .dockerignore prevents node_modules from being copied
COPY . .

# Overwrite the client directory with only the built artifacts from Stage 1
# We remove the original client folder (which might have raw source from COPY . .)
RUN rm -rf ./client/*
COPY --from=build /app/client/build ./client/build

# Expose port and start server
EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["npm", "start"]
