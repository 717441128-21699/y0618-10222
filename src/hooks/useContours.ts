import { useMemo } from 'react';
import * as d3 from 'd3';
import type { Station, ContourLine, InterpolationGrid, ParameterType } from '@/types/oceanography';
import { KrigingInterpolator } from '@/utils/interpolation/kriging';
import { IDWInterpolator } from '@/utils/interpolation/idw';
import { projectToLocal, unprojectFromLocal } from '@/utils/gis/geoUtils';

const getValueAtDepth = (
  station: Station,
  targetDepth: number,
  param: ParameterType
): number | null => {
  const data = station.data;
  if (data.length === 0) return null;

  if (targetDepth <= data[0].depth) {
    return data[0][param];
  }
  if (targetDepth >= data[data.length - 1].depth) {
    return data[data.length - 1][param];
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i].depth >= targetDepth) {
      const d0 = data[i - 1];
      const d1 = data[i];
      const t = (targetDepth - d0.depth) / (d1.depth - d0.depth);
      return d0[param] + (d1[param] - d0[param]) * t;
    }
  }

  return data[data.length - 1][param];
};

export const useHorizontalInterpolation = (
  stations: Station[],
  options: {
    depthLevel: number;
    parameter: ParameterType;
    algorithm: 'kriging' | 'idw';
    gridNx?: number;
    gridNy?: number;
    contourStep?: number;
  }
): InterpolationGrid | null => {
  return useMemo(() => {
    const { depthLevel, parameter, algorithm } = options;
    const nx = options.gridNx ?? 60;
    const ny = options.gridNy ?? 60;

    if (stations.length < 3) return null;

    const samples: { x: number; y: number; value: number; lon: number; lat: number }[] = [];
    let originLon = Infinity, originLat = Infinity;
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;

    for (const s of stations) {
      originLon = Math.min(originLon, s.longitude);
      originLat = Math.min(originLat, s.latitude);
    }

    for (const s of stations) {
      const val = getValueAtDepth(s, depthLevel, parameter);
      if (val === null) continue;
      const [x, y] = projectToLocal(s.longitude, s.latitude, originLon, originLat);
      samples.push({ x, y, value: val, lon: s.longitude, lat: s.latitude });
      xMin = Math.min(xMin, x);
      xMax = Math.max(xMax, x);
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }

    if (samples.length < 3) return null;

    const padX = (xMax - xMin) * 0.15;
    const padY = (yMax - yMin) * 0.15;
    xMin -= padX; xMax += padX;
    yMin -= padY; yMax += padY;

    const samplesForInterp = samples.map(s => ({ x: s.x, y: s.y, value: s.value }));

    let gridValues: number[][];
    if (algorithm === 'kriging') {
      const kriging = new KrigingInterpolator(samplesForInterp, undefined, Math.min(10, samplesForInterp.length));
      gridValues = kriging.interpolateGrid(xMin, xMax, yMin, yMax, nx, ny);
    } else {
      const idw = new IDWInterpolator(samplesForInterp, 2, Math.min(12, samplesForInterp.length));
      gridValues = idw.interpolateGrid(xMin, xMax, yMin, yMax, nx, ny);
    }

    const allValues = gridValues.flat();
    const vMin = Math.min(...allValues);
    const vMax = Math.max(...allValues);
    const step = options.contourStep ?? (vMax - vMin) / 10;

    const thresholds: number[] = [];
    for (let v = Math.ceil(vMin / step) * step; v <= vMax; v += step) {
      thresholds.push(+v.toFixed(3));
    }

    const flatValues = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        flatValues[j * nx + i] = gridValues[j][i];
      }
    }

    const contours = d3.contours()
      .size([nx, ny])
      .thresholds(thresholds)(flatValues as any);

    const contourLines: ContourLine[] = [];
    for (const c of contours) {
      const value = c.value;
      for (const ring of c.coordinates as number[][][][]) {
        for (const coords of ring as number[][][]) {
          const geographicCoords: [number, number][] = coords.map(([ix, iy]) => {
            const localX = xMin + (xMax - xMin) * (ix / (nx - 1));
            const localY = yMin + (yMax - yMin) * (iy / (ny - 1));
            return unprojectFromLocal(localX, localY, originLon, originLat);
          });
          contourLines.push({ value, coordinates: geographicCoords });
        }
      }
    }

    const geoBounds = {
      xMin: Infinity, xMax: -Infinity, yMin: Infinity, yMax: -Infinity,
    };
    for (const s of stations) {
      geoBounds.xMin = Math.min(geoBounds.xMin, s.longitude);
      geoBounds.xMax = Math.max(geoBounds.xMax, s.longitude);
      geoBounds.yMin = Math.min(geoBounds.yMin, s.latitude);
      geoBounds.yMax = Math.max(geoBounds.yMax, s.latitude);
    }
    const gPadX = (geoBounds.xMax - geoBounds.xMin) * 0.15;
    const gPadY = (geoBounds.yMax - geoBounds.yMin) * 0.15;

    return {
      algorithm,
      parameter,
      depthLevel,
      xMin: geoBounds.xMin - gPadX,
      xMax: geoBounds.xMax + gPadX,
      yMin: geoBounds.yMin - gPadY,
      yMax: geoBounds.yMax + gPadY,
      nx,
      ny,
      values: gridValues,
      contours: contourLines,
    };
  }, [stations, options.depthLevel, options.parameter, options.algorithm, options.gridNx, options.gridNy, options.contourStep]);
};

export const extractDepthValues = (
  stations: Station[],
  param: ParameterType
): { station: Station; depths: number[]; values: number[] }[] => {
  return stations.map(s => {
    const depths: number[] = [];
    const values: number[] = [];
    for (const p of s.data) {
      depths.push(p.depth);
      values.push(p[param]);
    }
    return { station: s, depths, values };
  });
};
