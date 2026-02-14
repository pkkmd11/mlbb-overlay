## Production image for False MLBB Overlay Tool (Node/Express + WebSocket)
## - Serves static files from /public
## - Runs server.js which listens on port 3000

FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy app source
COPY . .

ENV NODE_ENV=production

EXPOSE 3000

# server.js creates needed folders/files under public/ on startup
CMD ["node", "server.js"]

