# Dockerfile

# ───────────────────────────────────────────────────────────────────────────────
# 1) Partimos de una imagen oficial de Node 20 que soporta ESM correctamente
# ───────────────────────────────────────────────────────────────────────────────
FROM node:20-bullseye-slim

# ───────────────────────────────────────────────────────────────────────────────
# 2) Establecemos el directorio de trabajo dentro del contenedor
# ───────────────────────────────────────────────────────────────────────────────
WORKDIR /app

# ───────────────────────────────────────────────────────────────────────────────
# 3) Copiamos solo package.json (y package-lock.json si existiera)
# ───────────────────────────────────────────────────────────────────────────────
COPY package.json ./

# ───────────────────────────────────────────────────────────────────────────────
# 4) Instalamos dependencias (npm install)
#    - Como no hay package-lock.json, npm creará uno en el contenedor si es necesario
# ───────────────────────────────────────────────────────────────────────────────
RUN npm install

# ───────────────────────────────────────────────────────────────────────────────
# 5) Copiamos el resto del código de la aplicación
# ───────────────────────────────────────────────────────────────────────────────
COPY . .

# ───────────────────────────────────────────────────────────────────────────────
# 6) Instalamos Chromium (necesario para Puppeteer)
#    En Debian Bullseye:
#      - chromium es el paquete principal
#      - las bibliotecas adicionales ya vienen por defecto en esta imagen slim
# ───────────────────────────────────────────────────────────────────────────────
RUN apt-get update \
 && apt-get install -y chromium \
 && rm -rf /var/lib/apt/lists/*

# ───────────────────────────────────────────────────────────────────────────────
# 7) Variables de entorno para Puppeteer y el puerto
#    - Indicar ubicación de Chromium del sistema
#    - Evitar que Puppeteer descargue su propio binario
#    - Definir un valor por defecto para PORT (Render inyectará su propio)
# ───────────────────────────────────────────────────────────────────────────────
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PORT=3000

# ───────────────────────────────────────────────────────────────────────────────
# 8) Exponer el puerto 3000 (opcional, pero buena práctica)
# ───────────────────────────────────────────────────────────────────────────────
EXPOSE 3000

# ───────────────────────────────────────────────────────────────────────────────
# 9) Comando para arrancar la aplicación
# ───────────────────────────────────────────────────────────────────────────────
CMD ["node", "index.js"]
