import { useMemo } from 'react';
import type { Station, WaterMass, CTDDataPoint } from '@/types/oceanography';
import { kmeans, findOptimalK, normalizeData } from '@/utils/clustering/kmeans';
import { waterMassColorPalette, waterMassBorderPalette } from '@/utils/colorScales';

interface TSPoint {
  temp: number;
  sal: number;
  density: number;
  stationId: string;
  depth: number;
  clusterIndex?: number;
}

const WATER_MASS_NAMES = [
  '黑潮表层水团',
  '沿岸冲淡水团',
  '黄海冷水团',
  '黑潮次表层水团',
  '黑潮中层水团',
  '深层混合水团',
];

export const useWaterMass = (stations: Station[]) => {
  const { tsPoints, waterMasses } = useMemo(() => {
    const allData: TSPoint[] = [];

    for (const s of stations) {
      for (const p of s.data) {
        if (p.depth >= 0 && p.temperature > -5 && p.temperature < 40 &&
            p.salinity > 0 && p.salinity < 42) {
          allData.push({
            temp: p.temperature,
            sal: p.salinity,
            density: p.density,
            stationId: s.id,
            depth: p.depth,
          });
        }
      }
    }

    if (allData.length < 10) {
      return { tsPoints: allData, waterMasses: [] as WaterMass[] };
    }

    const rawVectors = allData.map(p => [p.temp, p.sal]);
    const { normalized, means, stds } = normalizeData(rawVectors);

    const optimalK = findOptimalK(normalized, 5);
    let bestResult = kmeans(normalized, optimalK);
    for (let trial = 0; trial < 5; trial++) {
      const res = kmeans(normalized, optimalK);
      if (res.inertia < bestResult.inertia) bestResult = res;
    }

    const denormCentroids = bestResult.centroids.map(c =>
      c.map((v, j) => v * stds[j] + means[j])
    );

    const clusterStats: {
      index: number;
      temps: number[];
      sals: number[];
      densities: number[];
      count: number;
    }[] = denormCentroids.map((_, i) => ({
      index: i,
      temps: [],
      sals: [],
      densities: [],
      count: 0,
    }));

    for (let i = 0; i < allData.length; i++) {
      const c = bestResult.assignments[i];
      allData[i].clusterIndex = c;
      const stat = clusterStats[c];
      if (stat) {
        stat.temps.push(allData[i].temp);
        stat.sals.push(allData[i].sal);
        stat.densities.push(allData[i].density);
        stat.count++;
      }
    }

    const sortedStats = clusterStats.sort((a, b) => b.count - a.count);
    const indexRemap = new Map<number, number>();
    sortedStats.forEach((s, newIdx) => indexRemap.set(s.index, newIdx));

    for (const p of allData) {
      p.clusterIndex = indexRemap.get(p.clusterIndex ?? 0) ?? 0;
    }

    const waterMasses: WaterMass[] = sortedStats.map((stat, idx) => {
      const sortT = [...stat.temps].sort((a, b) => a - b);
      const sortS = [...stat.sals].sort((a, b) => a - b);
      const sortD = [...stat.densities].sort((a, b) => a - b);
      const p05 = Math.floor(sortT.length * 0.05);
      const p95 = Math.floor(sortT.length * 0.95);

      const centroid = denormCentroids[stat.index];

      return {
        id: `wm-${idx}`,
        name: WATER_MASS_NAMES[idx] || `水团 ${idx + 1}`,
        tempRange: [sortT[p05] ?? centroid[0], sortT[p95] ?? centroid[0]],
        salRange: [sortS[p05] ?? centroid[1], sortS[p95] ?? centroid[1]],
        densityRange: [sortD[p05] ?? 1024, sortD[p95] ?? 1028],
        centroid: { temp: centroid[0], sal: centroid[1] },
        pointCount: stat.count,
        color: waterMassColorPalette[idx % waterMassColorPalette.length],
        clusterIndex: idx,
      };
    });

    return { tsPoints: allData, waterMasses };
  }, [stations]);

  return {
    tsPoints,
    waterMasses,
    totalPoints: tsPoints.length,
  };
};

export const computeIsopycnals = (
  tMin: number, tMax: number,
  sMin: number, sMax: number,
  levels: number[] = [1020, 1022, 1024, 1026, 1028]
): { level: number; points: { temp: number; sal: number }[] }[] => {
  const results: { level: number; points: { temp: number; sal: number }[] }[] = [];
  for (const level of levels) {
    const points: { temp: number; sal: number }[] = [];
    for (let t = tMin; t <= tMax; t += (tMax - tMin) / 60) {
      const sigmaT = level - 1000;
      const sal = (sigmaT + 0.22 * (t - 15)) / 0.78 + 35;
      if (sal >= sMin && sal <= sMax) {
        points.push({ temp: t, sal });
      }
    }
    if (points.length > 1) results.push({ level, points });
  }
  return results;
};

export type { TSPoint };
