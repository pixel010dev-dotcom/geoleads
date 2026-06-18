FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    wget \
    xdg-utils \
    tor \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/tor && \
    echo "SOCKSPort 9050" > /etc/tor/torrc && \
    echo "ExitNodes {br},{us}" >> /etc/tor/torrc && \
    echo "StrictNodes 0" >> /etc/tor/torrc && \
    echo "MaxCircuitDirtiness 60" >> /etc/tor/torrc && \
    echo "DNSPort 5353" >> /etc/tor/torrc

WORKDIR /app/dashboard

COPY dashboard/package*.json ./
RUN npm ci --legacy-peer-deps
RUN npx playwright install chromium --with-deps

COPY dashboard ./

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG MERCADO_PAGO_ACCESS_TOKEN
ARG GEMINI_API_KEY
ARG NEXT_PUBLIC_APP_URL
ARG SUPABASE_SERVICE_ROLE_KEY
ARG CF_WORKER_URL
ARG GOOGLE_PLACES_API_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV MERCADO_PAGO_ACCESS_TOKEN=$MERCADO_PAGO_ACCESS_TOKEN
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
ENV CF_WORKER_URL=$CF_WORKER_URL
ENV GOOGLE_PLACES_API_KEY=$GOOGLE_PLACES_API_KEY
ENV TOR_ENABLED=true

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "tor -f /etc/tor/torrc & sleep 2 && npm run start -- -H 0.0.0.0 -p ${PORT:-3000}"]
