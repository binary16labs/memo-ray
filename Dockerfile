# Memo-Ray — the memory-graph Express server (memory graph tier of the mesh).
#
# Builds the dashboard client, installs the server, and serves on PORT (3030).
# Consumed by the Prime-Silo shell through its /api/memoray proxy.
FROM node:20-slim

WORKDIR /app

# Install client + server deps first for layer caching.
COPY agent-os-dashboard/client/package*.json agent-os-dashboard/client/
RUN npm install --prefix agent-os-dashboard/client

COPY agent-os-dashboard/server/package*.json agent-os-dashboard/server/
RUN npm install --omit=dev --prefix agent-os-dashboard/server

# Bring in the rest and build the client bundle the server serves.
COPY . .
RUN npm run build:client

ENV NODE_ENV=production \
    PORT=3030

EXPOSE 3030

CMD ["node", "agent-os-dashboard/server/index.js"]
