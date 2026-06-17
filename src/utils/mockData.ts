import type { Station, CTDDataPoint, TidalRecord } from '@/types/oceanography';
import { stationColorPalette } from '@/utils/colorScales';

const seededRandom = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

const generateCTDProfile = (
  seed: number,
  waterMassType: 'kuroshio' | 'coastal' | 'mixed' | 'deep',
  maxDepth: number
): CTDDataPoint[] => {
  const rand = seededRandom(seed);
  const data: CTDDataPoint[] = [];
  const nDepths = Math.floor(maxDepth / 2) + 1;

  const profiles = {
    kuroshio: {
      surfaceTemp: 26 + rand() * 3,
      surfaceSal: 34.5 + rand() * 0.4,
      thermoclineDepth: 150 + rand() * 80,
      tempGradient: 0.16 + rand() * 0.04,
      salMaxDepth: 100 + rand() * 50,
      salMinDepth: 600 + rand() * 200,
    },
    coastal: {
      surfaceTemp: 20 + rand() * 5,
      surfaceSal: 31.5 + rand() * 1.2,
      thermoclineDepth: 40 + rand() * 30,
      tempGradient: 0.12 + rand() * 0.04,
      salMaxDepth: 30 + rand() * 20,
      salMinDepth: 250 + rand() * 100,
    },
    mixed: {
      surfaceTemp: 23 + rand() * 3,
      surfaceSal: 33.2 + rand() * 0.6,
      thermoclineDepth: 80 + rand() * 60,
      tempGradient: 0.14 + rand() * 0.03,
      salMaxDepth: 70 + rand() * 40,
      salMinDepth: 400 + rand() * 150,
    },
    deep: {
      surfaceTemp: 14 + rand() * 3,
      surfaceSal: 34.2 + rand() * 0.3,
      thermoclineDepth: 800 + rand() * 300,
      tempGradient: 0.025 + rand() * 0.01,
      salMaxDepth: 300 + rand() * 150,
      salMinDepth: 1500 + rand() * 500,
    },
  };

  const p = profiles[waterMassType];

  for (let i = 0; i < nDepths; i++) {
    const depth = i * 2;
    if (depth > maxDepth) break;

    let temperature: number;
    let salinity: number;

    if (depth < p.thermoclineDepth) {
      const t = depth / p.thermoclineDepth;
      const mixT = Math.pow(t, 0.7);
      temperature = p.surfaceTemp * (1 - mixT * 0.55) + rand() * 0.25 - 0.12;
      salinity = p.surfaceSal +
        Math.sin(depth / p.salMaxDepth * Math.PI) * 0.45 -
        t * 0.15 +
        rand() * 0.15 - 0.08;
    } else if (depth < p.thermoclineDepth * 2.5) {
      const t = (depth - p.thermoclineDepth) / (p.thermoclineDepth * 1.5);
      temperature =
        (p.surfaceTemp * 0.45) - p.tempGradient * (depth - p.thermoclineDepth) * 0.1 +
        rand() * 0.2 - 0.1;
      const salMax = p.surfaceSal + 0.5;
      const salMin = p.surfaceSal - 0.4;
      salinity = salMax - (salMax - salMin) * t + rand() * 0.12 - 0.06;
    } else {
      const t = Math.min(1, (depth - p.thermoclineDepth * 2.5) / p.salMinDepth);
      temperature = Math.max(2, 8 - t * 5 + rand() * 0.15 - 0.07);
      salinity = 34.6 - t * 0.25 + rand() * 0.08 - 0.04;
    }

    const density = 1024 + (salinity - 35) * 0.78 - (temperature - 15) * 0.22 + rand() * 0.1;
    const soundSpeed = 1450 + 4.2 * temperature + 1.3 * (salinity - 35) + 0.017 * depth;

    data.push({
      depth: +depth.toFixed(1),
      temperature: +temperature.toFixed(3),
      salinity: +salinity.toFixed(3),
      density: +density.toFixed(3),
      soundSpeed: +soundSpeed.toFixed(2),
    });
  }

  return data;
};

export const generateStations = (): Station[] => {
  const stationConfigs = [
    { name: 'ST-A01', lon: 121.50, lat: 30.10, type: 'coastal' as const, depth: 60, seed: 1001 },
    { name: 'ST-A02', lon: 121.85, lat: 30.00, type: 'mixed' as const, depth: 180, seed: 1002 },
    { name: 'ST-A03', lon: 122.20, lat: 29.90, type: 'kuroshio' as const, depth: 450, seed: 1003 },
    { name: 'ST-A04', lon: 122.55, lat: 29.80, type: 'kuroshio' as const, depth: 800, seed: 1004 },
    { name: 'ST-B01', lon: 121.40, lat: 29.70, type: 'coastal' as const, depth: 45, seed: 2001 },
    { name: 'ST-B02', lon: 121.75, lat: 29.60, type: 'mixed' as const, depth: 220, seed: 2002 },
    { name: 'ST-B03', lon: 122.10, lat: 29.50, type: 'kuroshio' as const, depth: 650, seed: 2003 },
    { name: 'ST-B04', lon: 122.45, lat: 29.40, type: 'deep' as const, depth: 1200, seed: 2004 },
    { name: 'ST-C01', lon: 121.30, lat: 29.30, type: 'coastal' as const, depth: 35, seed: 3001 },
    { name: 'ST-C02', lon: 121.65, lat: 29.20, type: 'mixed' as const, depth: 280, seed: 3002 },
    { name: 'ST-C03', lon: 122.00, lat: 29.10, type: 'kuroshio' as const, depth: 900, seed: 3003 },
    { name: 'ST-C04', lon: 122.35, lat: 29.00, type: 'deep' as const, depth: 1500, seed: 3004 },
  ];

  return stationConfigs.map((cfg, idx) => ({
    id: `station-${idx + 1}`,
    name: cfg.name,
    longitude: cfg.lon,
    latitude: cfg.lat,
    date: `2025-${String((idx % 8) + 4).padStart(2, '0')}-${String((idx % 27) + 1).padStart(2, '0')}`,
    maxDepth: cfg.depth,
    data: generateCTDProfile(cfg.seed, cfg.type, cfg.depth),
    color: stationColorPalette[idx % stationColorPalette.length],
  }));
};

export const generateTidalData = (): TidalRecord[] => {
  const rand = seededRandom(20240601);
  const data: TidalRecord[] = [];
  const startTime = new Date('2025-06-01T00:00:00Z');
  const interval = 30 * 60 * 1000;
  const totalRecords = 30 * 24 * 2;

  for (let i = 0; i < totalRecords; i++) {
    const time = new Date(startTime.getTime() + i * interval);
    const t = i / totalRecords;

    const M2 = 12.42 * 3600 * 1000;
    const S2 = 12 * 3600 * 1000;
    const K1 = 23.93 * 3600 * 1000;

    const m2Phase = (time.getTime() % M2) / M2 * 2 * Math.PI;
    const s2Phase = (time.getTime() % S2) / S2 * 2 * Math.PI;
    const k1Phase = (time.getTime() % K1) / K1 * 2 * Math.PI;

    const floodDir = 300 + rand() * 30 - 15;
    const ebbDir = 120 + rand() * 30 - 15;

    const tidalStrength =
      0.55 * Math.sin(m2Phase) +
      0.25 * Math.sin(s2Phase) +
      0.15 * Math.sin(k1Phase) +
      0.18 * Math.sin(t * 2 * Math.PI * 28 + 0.7);

    const baseSpeed = 45 * tidalStrength;
    const residualU = 8 * Math.sin(t * 2 * Math.PI * 14 + 1.2) + rand() * 6 - 3;
    const residualV = 5 * Math.cos(t * 2 * Math.PI * 14 + 0.8) + rand() * 4 - 2;

    let u: number, v: number;
    if (tidalStrength >= 0) {
      const dirRad = floodDir * Math.PI / 180;
      u = Math.sin(dirRad) * baseSpeed + residualU;
      v = Math.cos(dirRad) * baseSpeed + residualV;
    } else {
      const dirRad = ebbDir * Math.PI / 180;
      u = Math.sin(dirRad) * Math.abs(baseSpeed) + residualU;
      v = Math.cos(dirRad) * Math.abs(baseSpeed) + residualV;
    }

    const speed = Math.sqrt(u * u + v * v);
    let direction = (Math.atan2(u, v) * 180 / Math.PI + 360) % 360;

    const waterLevel = 1.2 * tidalStrength + 0.3 * Math.sin(t * 2 * Math.PI * 14 + 1.5);

    data.push({
      time: time.toISOString(),
      speed: +speed.toFixed(2),
      direction: +direction.toFixed(1),
      uComponent: +u.toFixed(2),
      vComponent: +v.toFixed(2),
      waterLevel: +waterLevel.toFixed(3),
    });
  }

  return data;
};
