FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends tzdata && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production TZ=Africa/Cairo DB_FILE=/data/store.db
VOLUME /data
EXPOSE 3000
CMD ["node","server.js"]
