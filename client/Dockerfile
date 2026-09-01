# Development image: runs the Vite dev server with hot reload.
# Production builds are handled by render.yaml, which compiles the client and
# serves it from the API service.
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
