FROM node:20-alpine AS deps-root
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci

FROM node:20-alpine AS build-client
WORKDIR /app
COPY --from=deps-root /app/node_modules ./node_modules
COPY --from=deps-root /app/package.json ./package.json
COPY --from=deps-root /app/package-lock.json ./package-lock.json
COPY client ./client
WORKDIR /app/client
RUN npx --no-install vite build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV UNO_PORT=3001
EXPOSE 3001

COPY package.json package-lock.json ./
COPY server ./server
RUN npm install --omit=dev --workspace=server
COPY --from=build-client /app/client/dist ./client/dist

WORKDIR /app/server
CMD ["node", "src/index.js"]
