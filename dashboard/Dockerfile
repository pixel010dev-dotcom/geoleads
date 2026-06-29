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

COPY dashboard/package*.json ./dashboard/
RUN cd dashboard && npm ci --legacy-peer-deps && npm cache clean --force
RUN cd dashboard && npx playwright install chromium --with-deps 2>/dev/null || true

COPY dashboard/ ./dashboard/

WORKDIR /app/dashboard

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

ENV NEXT_PUBLIC_SUPABASE_URL=https://mwnpwrzwgwrqqlomqhux.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bnB3cnp3Z3dycXFsb21xaHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMzg4MjQsImV4cCI6MjA5NDgxNDgyNH0.2gQPLPtkHXCItXSO3HEx_SfGckYZZNCC2Xv6vY93vmQ
ENV GEMINI_MODEL=gemini-1.5-flash
ENV NEXT_PUBLIC_APP_URL=https://geoleads-production.up.railway.app

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
