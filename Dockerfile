FROM node:20-alpine

# Install build tools needed for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy the server package files and install dependencies
COPY roe-server/package*.json ./roe-server/
RUN cd roe-server && npm install

# Copy the rest of the application
COPY . .

# Seed the local SQLite database
RUN cd roe-server && node db/seed.js

EXPOSE 8080
ENV PORT=8080

# Start the Node server
CMD ["node", "roe-server/server.js"]
