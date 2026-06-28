FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps --omit=dev && npm cache clean --force

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# NEXT_PUBLIC_* são inlinados no bundle no build time
# Railway as injeta via ambiente de build, mas precisamos de defaults
ENV NEXT_PUBLIC_SUPABASE_URL=https://mwnpwrzwgwrqqlomqhux.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bnB3cnp3Z3dycXFzb21xaHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMzg4MjQsImV4cCI6MjA5NDgxNDgyNH0.2gQPLPtkHXCItXSO3HEx_SfGckYZZNCC2Xv6vY93vmQ
ENV GEMINI_API_KEY=
ENV GEMINI_MODEL=gemini-1.5-flash
ENV NEXT_PUBLIC_APP_URL=https://geoleads-production.up.railway.app
ENV SUPABASE_SERVICE_ROLE_KEY=
ENV GOOGLE_CSE_API_KEY=
ENV GOOGLE_CSE_ID=
ENV CF_WORKER_URL=

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
