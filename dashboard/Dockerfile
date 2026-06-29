FROM node:20-slim

WORKDIR /app

RUN apt-get update -qq && apt-get install -y -qq \
  libgtk-3-dev libnotify-dev libnss3 libxss1 libasound2 \
  libxcb-shm0 libxcb-shape0 libxcb-xfixes0 \
  libdrm2 libgbm1 libegl1 libxkbcommon0 libpango-1.0-0 \
  libcairo2 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libxdamage1 libxrandr2 libpixman-1-0 \
  ca-certificates fonts-liberation && \
  rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --legacy-peer-deps && npm cache clean --force
RUN npx playwright install chromium --with-deps 2>/dev/null || true

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

ENV NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV GEMINI_MODEL
ENV NEXT_PUBLIC_APP_URL

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
