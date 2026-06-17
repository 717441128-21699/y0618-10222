import * as d3 from 'd3';
import type { WaterMass } from '@/types/oceanography';
import type { ShapeFeature } from './shapefileWriter';

interface GridResult {
  values: number[][];
  xMin: number; xMax: number;
  yMin: number; yMax: number;
  nx: number; ny: number;
}

const ringArea = (ring: { x: number; y: number }[]): number => {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i].x * ring[i + 1].y - ring[i + 1].x * ring[i].y;
  }
  return a / 2;
};

const reverseRing = (ring: { x: number; y: number }[]): { x: number; y: number }[] => {
  return [...ring].reverse();
};

const smoothRing = (ring: { x: number; y: number }[], iterations = 2): { x: number; y: number }[] => {
  let pts = ring.slice();
  if (pts.length < 3) return pts;

  for (let it = 0; it < iterations; it++) {
    const n = pts.length;
    if (n < 3) break;
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      out.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
      });
      out.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
      });
    }
    const last = out[out.length - 1];
    const first = out[0];
    if (Math.abs(last.x - first.x) > 1e-9 || Math.abs(last.y - first.y) > 1e-9) {
      out.push({ ...first });
    }
    pts = out;
  }
  return pts;
};

const pixelToGeo = (
  ix: number, iy: number,
  grid: GridResult
): { x: number; y: number } => {
  const lon = grid.xMin + (ix / (grid.nx - 1)) * (grid.xMax - grid.xMin);
  const lat = grid.yMax - (iy / (grid.ny - 1)) * (grid.yMax - grid.yMin);
  return { x: lon, y: lat };
};

export const generateWaterMassPolygons = (
  tempGrid: GridResult,
  salGrid: GridResult,
  waterMasses: WaterMass[],
  coordSystem: 'WGS84' | 'CGCS2000' = 'WGS84'
): ShapeFeature[] => {
  const { nx, ny } = tempGrid;
  if (waterMasses.length === 0) return [];
  if (nx !== salGrid.nx || ny !== salGrid.ny) return [];
  if (nx < 4 || ny < 4) return [];

  const tempMin = Math.min(...waterMasses.map(w => w.tempRange[0]));
  const tempMax = Math.max(...waterMasses.map(w => w.tempRange[1]));
  const salMin = Math.min(...waterMasses.map(w => w.salRange[0]));
  const salMax = Math.max(...waterMasses.map(w => w.salRange[1]));
  const tempSpan = Math.max(tempMax - tempMin, 1);
  const salSpan = Math.max(salMax - salMin, 0.5);

  const classification = new Int32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
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
      classification[j * nx + i] = bestIdx;
    }
  }

  const features: ShapeFeature[] = [];

  for (let k = 0; k < waterMasses.length; k++) {
    const wm = waterMasses[k];
    const binary = new Float64Array(nx * ny);
    for (let p = 0; p < nx * ny; p++) {
      binary[p] = classification[p] === k ? 1 : 0;
    }

    const contours = d3.contours()
      .size([nx, ny])
      .smooth(true)
      .thresholds([0.5])(binary as any);

    if (contours.length === 0) continue;

    for (const contour of contours) {
      const multiPolygon = contour.coordinates as unknown as number[][][][];
      if (!multiPolygon || multiPolygon.length === 0) continue;

      for (let polyIdx = 0; polyIdx < multiPolygon.length; polyIdx++) {
        const polygonRings = multiPolygon[polyIdx];
        if (!polygonRings || polygonRings.length === 0) continue;

        const allPoints: { x: number; y: number }[] = [];
        const parts: number[] = [];

        for (let ringIdx = 0; ringIdx < polygonRings.length; ringIdx++) {
          const ring = polygonRings[ringIdx];
          if (!ring || ring.length < 4) continue;

          let geoRing = ring.map(([ix, iy]) => pixelToGeo(ix, iy, tempGrid));

          const first = geoRing[0];
          const last = geoRing[geoRing.length - 1];
          if (Math.abs(first.x - last.x) > 1e-9 || Math.abs(first.y - last.y) > 1e-9) {
            geoRing.push({ ...first });
          }
          if (geoRing.length < 4) continue;

          geoRing = smoothRing(geoRing, 2);

          if (geoRing.length < 4) continue;

          const area = ringArea(geoRing);
          if (ringIdx === 0) {
            if (area < 0) {
              geoRing = reverseRing(geoRing);
            }
          } else {
            if (area > 0) {
              geoRing = reverseRing(geoRing);
            }
          }

          const absArea = Math.abs(ringArea(geoRing));
          const xSpan = tempGrid.xMax - tempGrid.xMin;
          const ySpan = tempGrid.yMax - tempGrid.yMin;
          const minArea = (xSpan * ySpan) / (nx * ny) * 4;
          if (absArea < minArea) continue;

          parts.push(allPoints.length);
          allPoints.push(...geoRing);
        }

        if (allPoints.length < 4 || parts.length === 0) continue;

        features.push({
          type: 'polygon',
          properties: {
            mass_id: wm.id,
            poly_id: `${wm.id}_${polyIdx}`,
            name: wm.name,
            cluster: wm.clusterIndex + 1,
            n_rings: parts.length,
            T_centroid: +wm.centroid.temp.toFixed(3),
            S_centroid: +wm.centroid.sal.toFixed(3),
            T_min: +wm.tempRange[0].toFixed(3),
            T_max: +wm.tempRange[1].toFixed(3),
            S_min: +wm.salRange[0].toFixed(3),
            S_max: +wm.salRange[1].toFixed(3),
            n_points: wm.pointCount,
            crs: coordSystem,
          },
          points: allPoints,
          parts,
        });
      }
    }
  }

  return features;
};

export { type GridResult };
