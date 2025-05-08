FROM node:23-alpine AS builder
WORKDIR /app

RUN apk update
RUN apk add ffmpeg

COPY package.json package-lock.json ./
COPY node_modules/@distube/ytdl-core ./node_modules/@distube/ytdl-core
COPY . .

RUN npm install --ignore-scripts

RUN npm run build

FROM node:23-alpine AS runner
WORKDIR /app

ENV SITE_URL=http://localhost:3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["node_modules/.bin/next", "start"]
