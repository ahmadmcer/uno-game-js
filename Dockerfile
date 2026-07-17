FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci --workspaces=false || npm install

FROM node:20-alpine AS build-client
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY client ./client
RUN npm run build -w client

FROM node:20-alpine AS deps-server
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
RUN npm install --omit=dev --workspace=server

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV UNO_PORT=3001
EXPOSE 3001

COPY package.json package-lock.json ./
COPY server ./server
COPY --from=deps-server /app/node_modules ./node_modules
COPY --from=build-client /app/client/dist ./client/dist

WORKDIR /app/server
CMD ["node", "src/index.js"]
