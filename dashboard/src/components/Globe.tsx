"use client";
import React from 'react';

interface GlobeProps {
  size?: number;
  className?: string;
}

export default function Globe({ size = 36, className = "" }: GlobeProps) {
  return (
    <div 
      className={`relative rounded-full overflow-hidden select-none flex-shrink-0 ${className}`}
      style={{ 
        width: size, 
        height: size,
        background: 'radial-gradient(circle at 35% 35%, #00d9ff 0%, #0052ff 50%, #000c3b 100%)',
        boxShadow: `
          inset -4px -4px 8px rgba(0,0,0,0.8), 
          inset 4px 4px 8px rgba(255,255,255,0.3), 
          0 0 12px rgba(0,217,255,0.5)
        `,
        border: '1px solid rgba(0,217,255,0.3)'
      }}
    >
      {/* Atmosphere reflection highlight */}
      <div 
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35) 0%, transparent 55%)',
          zIndex: 3
        }}
      />
      
      {/* Outer shadow overlay for depth */}
      <div 
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 75% 75%, transparent 35%, rgba(0,0,0,0.8) 100%)',
          zIndex: 2
        }}
      />

      {/* Animating Continents Container */}
      <div 
        className="absolute inset-0 flex items-center animate-[spinGlobe_15s_linear_infinite]"
        style={{
          zIndex: 1,
          width: '300%',
        }}
      >
        <svg 
          viewBox="0 0 300 100" 
          preserveAspectRatio="none"
          className="h-full w-full opacity-90"
        >
          {/* Continuous seamless continents (3 identical panels repeating) */}
          <g fill="#00ff88" filter="drop-shadow(0px 0px 2.5px rgba(0,255,136,0.9))">
            {/* Panel 1 (0 to 100) */}
            <path d="M10,25 Q18,15 25,22 T40,18 T55,25 T70,15 T85,22 T95,20 L95,35 Q85,45 75,38 T55,42 T35,35 T15,40 Z" />
            <path d="M20,50 Q30,45 42,52 T65,48 T80,55 T90,50 L88,70 Q75,78 62,72 T42,75 T22,68 Z" />
            <path d="M5,75 Q15,70 25,78 T45,72 L42,88 Q30,92 18,85 T5,82 Z" />
            <circle cx="50" cy="30" r="2" />
            <circle cx="75" cy="62" r="1.5" />
            <circle cx="85" cy="28" r="2.5" />

            {/* Panel 2 (100 to 200) - Panel 1 shifted by +100 */}
            <path d="M110,25 Q118,15 125,22 T140,18 T155,25 T170,15 T185,22 T195,20 L195,35 Q185,45 175,38 T155,42 T135,35 T115,40 Z" />
            <path d="M120,50 Q130,45 142,52 T165,48 T180,55 T190,50 L188,70 Q175,78 162,72 T142,75 T122,68 Z" />
            <path d="M105,75 Q115,70 125,78 T145,72 L142,88 Q130,92 118,85 T105,82 Z" />
            <circle cx="150" cy="30" r="2" />
            <circle cx="175" cy="62" r="1.5" />
            <circle cx="185" cy="28" r="2.5" />

            {/* Panel 3 (200 to 300) - Panel 1 shifted by +200 */}
            <path d="M210,25 Q218,15 225,22 T240,18 T255,25 T270,15 T285,22 T295,20 L295,35 Q285,45 275,38 T255,42 T235,35 T215,40 Z" />
            <path d="M220,50 Q230,45 242,52 T265,48 T280,55 T290,50 L288,70 Q275,78 262,72 T242,75 T222,68 Z" />
            <path d="M205,75 Q215,70 225,78 T245,72 L242,88 Q230,92 218,85 T205,82 Z" />
            <circle cx="250" cy="30" r="2" />
            <circle cx="275" cy="62" r="1.5" />
            <circle cx="285" cy="28" r="2.5" />
          </g>
        </svg>
      </div>
    </div>
  );
}
