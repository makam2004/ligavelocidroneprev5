# Dockerfile corregido
FROM node:18-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

COPY . .
# Puppeteer necesitará Chromium; en Alpine a veces hay que añadir 'chromium' y dependencias de librerías:
RUN apk add --no-cache chromium nss

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PORT=3000

EXPOSE 3000
CMD ["node", "index.js"]
