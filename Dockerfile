FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

RUN npm test

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/bin ./bin

RUN set -eux; \
    npm ci --only=production; \
    npm cache clean --force

RUN npm link

ENTRYPOINT ["fetch-trace"]
