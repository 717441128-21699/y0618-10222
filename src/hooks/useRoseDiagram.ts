import { useMemo } from 'react';
import type { TidalRecord, RoseSector } from '@/types/oceanography';

const DIRECTION_LABELS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

const DIRECTION_DEGREES = DIRECTION_LABELS.map((_, i) => i * 22.5);

const timeFilters = {
  day: (t: string) => {
    const d = new Date(t);
    const now = new Date('2025-06-15');
    return Math.abs(d.getTime() - now.getTime()) < 24 * 3600 * 1000;
  },
  week: (t: string) => {
    const d = new Date(t);
    const now = new Date('2025-06-15');
    return Math.abs(d.getTime() - now.getTime()) < 7 * 24 * 3600 * 1000;
  },
  month: () => true,
} as const;

export type TimeRange = keyof typeof timeFilters;

export const useRoseDiagram = (
  records: TidalRecord[],
  timeRange: TimeRange = 'month'
) => {
  return useMemo(() => {
    const filtered = records.filter(r => timeFilters[timeRange](r.time));
    if (filtered.length === 0) {
      return {
        sectors: DIRECTION_DEGREES.map((d, i) => ({
          direction: d,
          directionLabel: DIRECTION_LABELS[i],
          frequency: 0,
          avgSpeed: 0,
          count: 0,
        })),
        totalRecords: 0,
        maxFrequency: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        dominantDirection: '',
      };
    }

    const buckets = new Array(16).fill(0).map(() => ({ count: 0, speedSum: 0 }));

    let totalSpeed = 0;
    let maxSpeed = 0;

    for (const r of filtered) {
      const dir = ((r.direction % 360) + 360) % 360;
      const idx = Math.round(dir / 22.5) % 16;
      buckets[idx].count++;
      buckets[idx].speedSum += r.speed;
      totalSpeed += r.speed;
      maxSpeed = Math.max(maxSpeed, r.speed);
    }

    const total = filtered.length;
    const sectors: RoseSector[] = buckets.map((b, i) => ({
      direction: DIRECTION_DEGREES[i],
      directionLabel: DIRECTION_LABELS[i],
      frequency: total > 0 ? (b.count / total) * 100 : 0,
      avgSpeed: b.count > 0 ? b.speedSum / b.count : 0,
      count: b.count,
    }));

    let maxFreq = 0;
    let dominantIdx = 0;
    sectors.forEach((s, i) => {
      if (s.frequency > maxFreq) {
        maxFreq = s.frequency;
        dominantIdx = i;
      }
    });

    return {
      sectors,
      totalRecords: total,
      maxFrequency: maxFreq,
      avgSpeed: total > 0 ? totalSpeed / total : 0,
      maxSpeed,
      dominantDirection: DIRECTION_LABELS[dominantIdx],
    };
  }, [records, timeRange]);
};

export const aggregateTidalTimeSeries = (
  records: TidalRecord[],
  timeRange: TimeRange = 'week',
  points: number = 200
): { time: Date; speed: number; direction: number; u: number; v: number; waterLevel?: number }[] => {
  const filtered = records.filter(r => timeFilters[timeRange](r.time));
  if (filtered.length === 0) return [];

  const step = Math.max(1, Math.floor(filtered.length / points));
  const result: { time: Date; speed: number; direction: number; u: number; v: number; waterLevel?: number }[] = [];

  for (let i = 0; i < filtered.length; i += step) {
    const slice = filtered.slice(i, Math.min(i + step, filtered.length));
    const avg = slice.reduce((acc, r) => ({
      speed: acc.speed + r.speed,
      u: acc.u + r.uComponent,
      v: acc.v + r.vComponent,
      wl: acc.wl + (r.waterLevel ?? 0),
      wlCount: acc.wlCount + (r.waterLevel !== undefined ? 1 : 0),
    }), { speed: 0, u: 0, v: 0, wl: 0, wlCount: 0 });

    const n = slice.length;
    const meanU = avg.u / n;
    const meanV = avg.v / n;
    const dir = (Math.atan2(meanU, meanV) * 180 / Math.PI + 360) % 360;

    result.push({
      time: new Date(slice[Math.floor(slice.length / 2)].time),
      speed: avg.speed / n,
      direction: dir,
      u: meanU,
      v: meanV,
      waterLevel: avg.wlCount > 0 ? avg.wl / avg.wlCount : undefined,
    });
  }

  return result;
};
