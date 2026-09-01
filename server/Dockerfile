# Build context is the repository root (see docker-compose.yml) so that the
# sql/ directory can be copied in for the boot-time migration runner.
FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./
RUN npm install --omit=dev

COPY server/src ./src
COPY sql ./sql

EXPOSE 4000

CMD ["npm", "start"]
