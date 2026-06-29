FROM node:20-slim

WORKDIR /app/dashboard

# System dependencies for Chromium
RUN apt-get update -qq && apt-get install -y -qq \
  libgtk-3-dev libnotify-dev libnss3 libxss1 libasound2 \
  libxcb-shm0 libxcb-shape0 libxcb-xfixes0 \
  libdrm2 libgbm1 libegl1 libxkbcommon0 libpango-1.0-0 \
  libcairo2 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libxdamage1 libxrandr2 libpixman-1-0 \
  ca-certificates fonts-liberation && \
  rm -rf /var/lib/apt/lists/*

COPY dashboard/package*.json ./
RUN npm ci --legacy-peer-deps && npm cache clean --force
RUN npx playwright install chromium --with-deps 2>/dev/null || true

COPY dashboard ./

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV NODE_OPTIONS=--max-old-space-size=2048

# Railway injeta NEXT_PUBLIC_* via ambiente de build
ENV NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL
ENV SUPABASE_SERVICE_ROLE_KEY
ENV GOOGLE_CSE_API_KEY
ENV GOOGLE_CSE_ID
ENV CF_WORKER_URL

# Build com log reduzido
RUN npm run build 2>&1 | tail -20

EXPOSE 3000

CMD ["npm", "run", "start"]
