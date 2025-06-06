# Dockerfile

FROM node:20-bullseye-slim

WORKDIR /app

# 1) Copiamos package.json
COPY package.json ./

# 2) Instalamos dependencias
RUN npm install

# 3) Copiamos el resto del código (incluyendo index.js e index.mjs)
COPY . .

# 4) Instalamos Chromium para Puppeteer
RUN apt-get update \
 && apt-get install -y chromium \
 && rm -rf /var/lib/apt/lists/*

# 5) Variables para Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PORT=3000

EXPOSE 3000

# 6) Ahora arrancamos index.js, pero éste importará index.mjs
CMD ["node", "index.js"]
