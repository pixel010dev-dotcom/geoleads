const COUNTERS = new Map<string, { minute: number; hour: number; day: number; minuteTs: number; hourTs: number; dayTs: number }>();

function getBucketKey(sessionId: string): string {
  const now = Date.now();
  const minuteTs = Math.floor(now / 60000);
  const hourTs = Math.floor(now / 3600000);
  const dayTs = Math.floor(now / 86400000);
  const key = `${sessionId}:${minuteTs}:${hourTs}:${dayTs}`;
  return key;
}

export function checkRateLimit(sessionId: string, limits: { perMinute: number; perHour: number; perDay: number }): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const minuteTs = Math.floor(now / 60000);
  const hourTs = Math.floor(now / 3600000);
  const dayTs = Math.floor(now / 86400000);

  let counter = COUNTERS.get(sessionId);
  if (!counter || counter.minuteTs !== minuteTs || counter.hourTs !== hourTs || counter.dayTs !== dayTs) {
    counter = { minute: 0, hour: 0, day: 0, minuteTs, hourTs, dayTs };
    COUNTERS.set(sessionId, counter);
  }

  if (counter.minute >= limits.perMinute) {
    return { allowed: false, reason: `Limite de ${limits.perMinute}/minuto atingido` };
  }
  if (counter.hour >= limits.perHour) {
    return { allowed: false, reason: `Limite de ${limits.perHour}/hora atingido` };
  }
  if (counter.day >= limits.perDay) {
    return { allowed: false, reason: `Limite de ${limits.perDay}/dia atingido` };
  }

  counter.minute++;
  counter.hour++;
  counter.day++;

  return { allowed: true };
}

export function getNextDelay(sessionId: string, minDelay: number, maxDelay: number): number {
  const base = minDelay + Math.random() * (maxDelay - minDelay);
  const jitter = (Math.random() - 0.5) * (maxDelay - minDelay) * 0.4;
  return Math.max(2, Math.round(base + jitter));
}

export function getSmartDelay(sentCount: number, minDelay: number, maxDelay: number): number {
  if (sentCount < 10) {
    return minDelay + Math.random() * 10;
  }
  if (sentCount < 50) {
    return minDelay + Math.random() * 15;
  }
  if (sentCount < 100) {
    return minDelay + Math.random() * 20;
  }
  return minDelay + Math.random() * (maxDelay - minDelay);
}

const ONE_HOUR = 3600000;
setInterval(() => {
  const cutoff = Date.now() - ONE_HOUR;
  for (const [key] of COUNTERS) {
    const parts = key.split(':');
    if (parts.length >= 4) {
      const dayTs = parseInt(parts[3], 10);
      if (dayTs * 86400000 < cutoff) {
        COUNTERS.delete(key);
      }
    }
  }
}, 300000);
