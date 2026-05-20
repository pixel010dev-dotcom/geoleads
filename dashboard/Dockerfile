# Dockerfile para rodar o Next.js com Playwright (Chromium) na nuvem (Railway, Render, VPS)
FROM node:20-bullseye-slim

# Instalar dependências necessárias do sistema para o Chromium rodar headless
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libgconf-2-4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libnss3 \
    libxss1 \
    libasound2 \
    libxtst6 \
    x11-apps \
    fonts-liberation \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia e instala dependências do Node
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Instala o executável do Chromium do Playwright
RUN npx playwright install chromium

# Copia todo o código do projeto
COPY . .

# Build do Next.js
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production
RUN npm run build

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "start"]
