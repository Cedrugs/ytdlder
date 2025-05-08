FROM node:23-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY . .

RUN npm install --ignore-scripts

RUN npm run build

FROM node:23-alpine AS runner
WORKDIR /app

ENV SITE_URL=http://localhost:3000
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
EXPOSE 3001

RUN apk update
RUN apk add ffmpeg

CMD ["node_modules/.bin/next", "start"]
