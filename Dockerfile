# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG GIT_SHA=dev
ENV GIT_SHA=${GIT_SHA}
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3150
ENV STATIC_DIR=/app/dist/client
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
ARG GIT_SHA=dev
ENV GIT_SHA=${GIT_SHA}
EXPOSE 3150
CMD ["node", "dist/server/index.js"]
