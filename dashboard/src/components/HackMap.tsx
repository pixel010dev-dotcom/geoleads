'use client';

import { useEffect, useRef, useState } from 'react';

const CITY_CACHE: Record<string, [number, number]> = {};

async function geocodeCity(city: string): Promise<[number, number] | null> {
  const key = city.toLowerCase().trim();
  if (CITY_CACHE[key]) return CITY_CACHE[key];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city + ', Brasil')}&limit=1`,
      { headers: { 'User-Agent': 'GeoLeads/1.0' } }
    );
    const data = await res.json();
    if (data?.[0]?.lat && data?.[0]?.lon) {
      const coord: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      CITY_CACHE[key] = coord;
      return coord;
    }
  } catch {}
  return null;
}

const DARK_TILES = 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

export default function HackMap({ leads }: { leads: any[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersLayer = useRef<any>(null);
  const coordsRef = useRef<[number, number][]>([]);
  const geoDone = useRef(false);
  const citiesKeyRef = useRef('');
  const [pointCount, setPointCount] = useState(0);
  const [leaflet, setLeaflet] = useState<any>(null);
  const hasTiles = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    import('leaflet').then((L) => {
      setLeaflet(L);
    });
  }, []);

  useEffect(() => {
    if (!leaflet || !mapRef.current || mapInstance.current) return;
    const L = leaflet;
    const map = L.map(mapRef.current, {
      center: [-14.235, -51.9253],
      zoom: 4,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false,
    });
    L.tileLayer(DARK_TILES, { maxZoom: 18 }).addTo(map);
    mapInstance.current = map;
    markersLayer.current = L.layerGroup().addTo(map);
  }, [leaflet]);

  useEffect(() => {
    if (!leaflet || !mapInstance.current) return;
    const cities = [...new Set(leads.map((l) => l.cidade).filter(Boolean))] as string[];
    const newKey = cities.sort().join('|');
    if (newKey === citiesKeyRef.current) return;
    citiesKeyRef.current = newKey;
    geoDone.current = false;
    coordsRef.current = [];
    let cancelled = false;
    (async () => {
      for (const city of cities) {
        if (cancelled) break;
        const c = await geocodeCity(city);
        if (c) coordsRef.current.push(c);
        await new Promise(r => setTimeout(r, 1200));
      }
      if (cancelled) return;
      geoDone.current = true;
      const L = leaflet;
      const map = mapInstance.current;
      const coords = coordsRef.current;
      if (coords.length === 0) return;
      markersLayer.current.clearLayers();
      coords.forEach(([lat, lng]) => {
        const circle = L.circleMarker([lat, lng], {
          radius: 8,
          color: '#00ff41',
          fillColor: '#ff0040',
          fillOpacity: 0.9,
          weight: 2,
          opacity: 1,
        });
        circle.addTo(markersLayer.current);
        const pulse = L.circleMarker([lat, lng], {
          radius: 18,
          color: '#00ff41',
          fillColor: '#00ff41',
          fillOpacity: 0.15,
          weight: 1,
        });
        pulse.addTo(markersLayer.current);
      });
      map.fitBounds(L.latLngBounds(coords).pad(0.3));
      setPointCount(coords.length);
    })();
    return () => { cancelled = true; };
  }, [leads, leaflet]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-green-500/20 shadow-[0_0_30px_rgba(0,255,65,0.05)]">
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2 bg-black/70 px-3 py-1.5 rounded-lg border border-green-500/30 text-[10px] text-green-400 font-mono">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        GEOLEADS_MAP::ACTIVE
      </div>
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1 text-[10px] text-green-500/50 font-mono">
        {pointCount} PONTOS
      </div>
      <div ref={mapRef} className="w-full h-[320px] sm:h-[400px]" />
    </div>
  );
}
