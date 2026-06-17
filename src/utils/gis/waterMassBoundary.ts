import * as d3 from 'd3';
import type { WaterMass } from '@/types/oceanography';
import type { ShapeFeature } from './shapefileWriter';
import { projectToLocal, unprojectFromLocal } from './geoUtils';

interface GridResult {
  values: number[][];
  xMin: number; xMax: number;
  yMin: number; yMax: number;
  nx: number; ny: number;
}

export const generateWaterMassPolygons = (
  tempGrid: GridResult,
  salGrid: GridResult,
  waterMasses: WaterMass[],
  coordSystem: 'WGS84' | 'CGCS2000' = 'WGS84'
): ShapeFeature[] => {
  const { nx, ny } = tempGrid;
  if (waterMasses.length === 0) return [];
  if (nx !== salGrid.nx || ny !== salGrid.ny) return [];

  const tempRange = [
    Math.min(...waterMasses.map(w => w.tempRange[0])),
    Math.max(...waterMasses.map(w => w.tempRange[1])),
  ];
  const salRange = [
    Math.min(...waterMasses.map(w => w.salRange[0])),
    Math.max(...waterMasses.map(w => w.salRange[1])),
  ];
  const tempSpan = Math.max(tempRange[1] - tempRange[0], 1);
  const salSpan = Math.max(salRange[1] - salRange[0], 0.5);

  const classification: number[][] = [];
  for (let j = 0; j < ny; j++) {
    const row: number[] = [];
    for (let i = 0; i < nx; i++) {
      const t = tempGrid.values[j][i];
      const s = salGrid.values[j][i];

      let bestIdx = 0;
      let bestDist = Infinity;
      for (let k = 0; k < waterMasses.length; k++) {
        const wm = waterMasses[k];
        const dt = (t - wm.centroid.temp) / tempSpan;
        const ds = (s - wm.centroid.sal) / salSpan;
        const dist = dt * dt + ds * ds;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = k;
        }
      }
      row.push(bestIdx);
    }
    classification.push(row);
  }

  const features: ShapeFeature[] = [];

  for (let k = 0; k < waterMasses.length; k++) {
    const wm = waterMasses[k];
    const binary = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        binary[j * nx + i] = classification[j][i] === k ? 1 : 0;
      }
    }

    const contours = d3.contours()
      .size([nx, ny])
      .thresholds([0.5])(binary as any);

    if (contours.length === 0) continue;

    const contour = contours[0];
    const rings = contour.coordinates as unknown as number[][][];

    const originLon = tempGrid.xMin;
    const originLat = tempGrid.yMin;
    const xSpan = tempGrid.xMax - tempGrid.xMin;
    const ySpan = tempGrid.yMax - tempGrid.yMin;

    const wmPolygons: ShapeFeature[] = [];

    for (let ringIdx = 0; ringIdx < rings.length; ringIdx++) {
      const ring = rings[ringIdx] as number[][];
      if (ring.length < 4) continue;

      const geoRing = ring.map(([ix, iy]) => {
        const lon = tempGrid.xMin + (ix / (nx - 1)) * xSpan;
        const lat = tempGrid.yMin + (iy / (ny - 1)) * ySpan;
        return { x: lon, y: lat };
      });

      const first = geoRing[0];
      const last = geoRing[geoRing.length - 1];
      if (first.x !== last.x || first.y !== last.y) {
        geoRing.push({ ...first });
      }

      if (geoRing.length < 4) continue;

      wmPolygons.push({
        type: 'polygon',
        properties: {
          mass_id: `${wm.id}_${ringIdx}`,
          name: wm.name,
          cluster: wm.clusterIndex + 1,
          T_centroid: +wm.centroid.temp.toFixed(3),
          S_centroid: +wm.centroid.sal.toFixed(3),
          T_min: +wm.tempRange[0].toFixed(3),
          T_max: +wm.tempRange[1].toFixed(3),
          S_min: +wm.salRange[0].toFixed(3),
          S_max: +wm.salRange[1].toFixed(3),
          n_points: wm.pointCount,
          ring_idx: ringIdx,
          crs: coordSystem,
        },
        points: geoRing,
        parts: [0],
      });
    }

    if (wmPolygons.length > 0) {
      features.push(...wmPolygons);
    }
  }

  return features;
};

export { type GridResult };
