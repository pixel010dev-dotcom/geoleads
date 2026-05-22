"use client";
import React, { useEffect, useState } from 'react';

interface HackerRadarProps {
  keyword: string;
  location: string;
}

export default function HackerRadar({ keyword, location }: HackerRadarProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [blips, setBlips] = useState<{ x: number; y: number; id: number; color: string; life: number }[]>([]);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    setElapsed(0);

    setLogs([
      `[SYS] MOTOR DE VARREDURA INICIADO EM: ${new Date().toLocaleTimeString()}`,
      `[SYS] PESQUISA PARAMETRIZADA: "${keyword || 'Geral'}" EM "${location || 'Brasil'}"`,
      `[GRID] Estabelecendo conexões via proxies residenciais seguros...`,
      `[GRID] Acessando canais de dados públicos de geolocalização...`
    ]);

    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);

    const logTemplates = [
      () => `[PING] Servidor Google Maps respondeu em ${Math.floor(Math.random() * 80) + 15}ms.`,
      () => `[SEARCH] Varrendo blocos de coordenadas lat/long na região de ${location || 'Local'}.`,
      () => `[TARGET] Potencial lead "${keyword || 'Empresa'}" detectado no quadrante.`,
      () => `[DECODE] Descriptografando metadados de API pública...`,
      () => `[SCRAPE] Extraído contato telefônico através de links de ação direta.`,
      () => `[ENRICH] Efetuando requisição silenciosa no site oficial para pescar redes sociais.`,
      () => `[FILTER] Lead atende às métricas de filtros ativos. Adicionando ao buffer.`,
      () => `[BUFFER] Lead válido registrado temporariamente na fila de saída.`,
      () => `[SYS] Proxies atualizados com sucesso.`,
      () => `[PARSE] Normalizando endereço e região metropolitana.`,
      () => `[HASH] Checksum do lead verificado. Integridade confirmada.`,
      () => `[MAP] Tile ${Math.floor(Math.random()*100)}x${Math.floor(Math.random()*100)} carregado.`,
      () => `[CACHE] Dados do Google Places armazenados em buffer volátil.`,
      () => `[SOCIAL] Verificando presença digital em plataformas parceiras...`,
    ];

    const logInterval = setInterval(() => {
      const randomTemplate = logTemplates[Math.floor(Math.random() * logTemplates.length)];
      setLogs(prev => {
        const next = [...prev, randomTemplate()];
        if (next.length > 10) next.shift();
        return next;
      });
    }, 800);

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
      clearInterval(logInterval);
      clearInterval(blipInterval);
      clearInterval(timer);
    };
  }, [keyword, location]);

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-black/60 border border-green-500/20 rounded-[2rem] w-full max-w-2xl mx-auto shadow-[0_0_35px_rgba(0,255,102,0.1)] relative overflow-hidden backdrop-blur-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,102,0.05)_0%,transparent_75%)] pointer-events-none" />

      <div className="flex items-center gap-2 mb-6">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
        <span className="text-xs font-mono font-bold text-green-400 tracking-widest uppercase">RASTREAMENTO ATIVO DE LEADS</span>
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
              STATUS: ESCANEANDO MAPS
            </span>
            <span>● {elapsed}s</span>
          </div>
        </div>
      </div>
      
      <p className="text-gray-400 text-xs text-center mt-6 tracking-wide leading-relaxed">
        Buscando dados públicos no Google Maps e cruzando com o site oficial da empresa. <br />
        <span className="text-gray-600 text-[10px]">Tempo decorrido: {elapsed}s · Limite de segurança: 50s</span>
      </p>
    </div>
  );
}
