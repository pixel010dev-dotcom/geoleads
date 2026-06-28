FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps --omit=dev && npm cache clean --force

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
