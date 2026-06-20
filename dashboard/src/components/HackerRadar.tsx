"use client";
import React, { useEffect, useState, useRef } from 'react';
import { useTranslations } from '@/lib/i18n';

interface HackerRadarProps {
  keyword: string;
  location: string;
  extractStats?: {
    scanned?: number;
    time?: number;
    message?: string;
    total?: number;
  } | null;
}

export default function HackerRadar({ keyword, location, extractStats }: HackerRadarProps) {
  const { t } = useTranslations();
  const [logs, setLogs] = useState<string[]>([]);
  const [blips, setBlips] = useState<{ x: number; y: number; id: number; color: string; life: number }[]>([]);
  const lastMessageRef = useRef('');
  const startTimeRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    startTimeRef.current = Date.now();
    setElapsed(0);
    lastMessageRef.current = '';

    setLogs([
      `[SYS] Motor de varredura iniciado em: ${new Date().toLocaleTimeString()}`,
      `[SYS] Pesquisa: "${keyword || 'Geral'}" em "${location || 'Brasil'}"`,
      `[GRID] Conectando a fontes de dados públicos...`,
    ]);

    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);

    const blipInterval = setInterval(() => {
      setBlips(prev => {
        const next = prev
          .map(b => ({ ...b, life: b.life - 1 }))
          .filter(b => b.life > 0);
        if (next.length < 8) {
          next.push({
            x: 10 + Math.random() * 80,
            y: 10 + Math.random() * 80,
            id: Date.now() + Math.random(),
            color: Math.random() > 0.25 ? '#00ff66' : '#ff3366',
            life: 8,
          });
        }
        return next;
      });
    }, 600);

    return () => {
      clearInterval(blipInterval);
      clearInterval(timer);
    };
  }, [keyword, location]);

  useEffect(() => {
    if (!extractStats) return;

    const displayTime = extractStats.time || Math.floor((Date.now() - startTimeRef.current) / 1000);
    setElapsed(displayTime);

    const msg = extractStats.message || '';
    if (msg && msg !== lastMessageRef.current) {
      lastMessageRef.current = msg;
      setLogs(prev => {
        const next = [...prev, `[RUNTIME] ${msg}`];
        if (next.length > 10) next.shift();
        return next;
      });
    }

    if (extractStats.scanned && extractStats.scanned > 0) {
      const scanMsg = `[SCAN] ${extractStats.scanned} empresas escaneadas`;
      setLogs(prev => {
        if (prev.some(l => l.includes(`${extractStats.scanned} empresas escaneadas`))) return prev;
        const next = [...prev, scanMsg];
        if (next.length > 10) next.shift();
        return next;
      });
    }
  }, [extractStats]);

  const displayTime = extractStats?.time || elapsed;

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-black/60 border border-green-500/20 rounded-[2rem] w-full max-w-2xl mx-auto shadow-[0_0_35px_rgba(0,255,102,0.1)] relative overflow-hidden backdrop-blur-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,102,0.05)_0%,transparent_75%)] pointer-events-none" />

      <div className="flex items-center gap-2 mb-6">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
        <span className="text-xs font-mono font-bold text-green-400 tracking-widest uppercase">{t('hackerRadar.title')}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center w-full relative z-10">
        
        <div className="flex justify-center">
          <div className="relative w-48 h-48 rounded-full border border-green-500/20 bg-black overflow-hidden shadow-[inset_0_0_20px_rgba(0,255,102,0.2)]">
            
            <div className="absolute inset-4 rounded-full border border-green-500/10" />
            <div className="absolute inset-10 rounded-full border border-green-500/10" />
            <div className="absolute inset-20 rounded-full border border-green-500/15" />
            
            <div className="absolute inset-y-0 left-1/2 w-px bg-green-500/15 -translate-x-1/2" />
            <div className="absolute inset-x-0 top-1/2 h-px bg-green-500/15 -translate-y-1/2" />

            <div 
              className="absolute inset-0 origin-center animate-[spin_4s_linear_infinite]"
              style={{
                background: 'conic-gradient(from 0deg, transparent 40%, rgba(0,255,102,0.25) 90%, rgba(0,255,102,0.55) 100%)',
                mixBlendMode: 'screen'
              }}
            />

            <div 
              className="absolute inset-0 origin-center animate-[spin_6s_linear_infinite_reverse] opacity-50"
              style={{
                background: 'conic-gradient(from 90deg, transparent 50%, rgba(0,200,255,0.15) 85%, rgba(0,200,255,0.3) 100%)',
                mixBlendMode: 'screen'
              }}
            />

            {blips.map(blip => (
              <div 
                key={blip.id}
                className="absolute w-2 h-2 rounded-full pointer-events-none transition-all duration-500"
                style={{ 
                  left: `${blip.x}%`, 
                  top: `${blip.y}%`, 
                  backgroundColor: blip.color,
                  boxShadow: `0 0 ${4 + (8 - blip.life)}px ${blip.color}`,
                  opacity: Math.max(0.1, blip.life / 8),
                  transform: `scale(${Math.max(0.3, blip.life / 8)})`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="w-full h-48 bg-black/80 rounded-xl border border-green-500/15 p-4 flex flex-col justify-between font-mono text-[10px] text-green-400/90 shadow-[inset_0_0_12px_rgba(0,0,0,0.8)] overflow-hidden">
          <div className="flex-1 space-y-1.5 overflow-hidden">
            {logs.map((log, index) => (
              <div 
                key={index} 
                className="truncate leading-normal animate-fade-in"
                style={{ animationDelay: '0ms' }}
              >
                <span className="text-green-500/60 font-bold">&gt;</span> {log}
              </div>
            ))}
          </div>
          <div className="mt-2 border-t border-green-500/20 pt-2 flex items-center justify-between text-green-500/60 text-[9px]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              {t('hackerRadar.status')}
            </span>
            <span>● {displayTime}s</span>
          </div>
        </div>
      </div>
      
      <p className="text-gray-400 text-xs text-center mt-6 tracking-wide leading-relaxed">
        {t('hackerRadar.footer')} <br />
        <span className="text-gray-600 text-[10px]">Tempo decorrido: {displayTime}s</span>
      </p>
    </div>
  );
}
