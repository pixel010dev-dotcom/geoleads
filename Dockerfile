FROM node:20-slim

WORKDIR /app/dashboard

COPY dashboard/package*.json ./
RUN npm ci --legacy-peer-deps --omit=dev && npm cache clean --force

COPY dashboard ./

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV NODE_OPTIONS=--max-old-space-size=2048

# Railway injeta NEXT_PUBLIC_* via ambiente de build
ENV NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL
ENV GEMINI_API_KEY
ENV GEMINI_MODEL
ENV SUPABASE_SERVICE_ROLE_KEY
ENV GOOGLE_CSE_API_KEY
ENV GOOGLE_CSE_ID
ENV CF_WORKER_URL

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
