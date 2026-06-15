"use client";
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from '@/lib/i18n';

interface StatItem {
  value: number;
  label: string;
  suffix?: string;
}

export default function AnimatedStats() {
  const { t, locale } = useTranslations();
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stats: StatItem[] = [
    { value: 4200, label: t('stats.leadsExtracted'), suffix: '+' },
    { value: 150, label: t('stats.activeUsers'), suffix: '+' },
    { value: 98, label: t('stats.uptime'), suffix: '%' },
    { value: 3, label: t('stats.minutesToResult'), suffix: 'min' },
  ];

  return (
    <div ref={ref} className="app-container py-10 sm:py-16">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-2xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 tabular-nums">
                <Counter target={s.value} visible={visible} locale={locale} />
                {s.suffix || ''}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Counter({ target, visible, locale }: { target: number; visible: boolean; locale: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!visible) return;
    if (target === 0) return;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [visible, target]);

  if (!visible) return <>{0}</>;
  return <>{count.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR')}</>;
}
