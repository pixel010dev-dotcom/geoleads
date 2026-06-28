FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps --omit=dev && npm cache clean --force

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# Railway injeta NEXT_PUBLIC_* via ambiente de build
ENV NEXT_PUBLIC_SUPABASE_URL=https://mwnpwrzwgwrqqlomqhux.supabase.co
ENV GEMINI_MODEL=gemini-1.5-flash
ENV NEXT_PUBLIC_APP_URL=https://geoleads-production.up.railway.app

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
