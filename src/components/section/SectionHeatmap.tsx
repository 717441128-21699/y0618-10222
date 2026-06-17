import React from 'react';
import * as d3 from 'd3';
import type { ColorScale } from '@/utils/colorScales';
import { oceanTemperatureScale } from '@/utils/colorScales';

interface SectionHeatmapProps {
  gridValues: number[][];
  distances: number[];
  depths: number[];
  colorScale?: ColorScale;
  unit?: string;
  parameterLabel?: string;
  width?: number;
  height?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  showContours?: boolean;
  contourStep?: number;
  stationLabels?: string[];
}

export const SectionHeatmap: React.FC<SectionHeatmapProps> = ({
  gridValues,
  distances,
  depths,
  colorScale = oceanTemperatureScale as ColorScale,
  unit = '°C',
  parameterLabel = '温度',
  width = 900,
  height = 520,
  padding = { top: 30, right: 70, bottom: 60, left: 70 },
  showContours = true,
  contourStep,
  stationLabels,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [hoverInfo, setHoverInfo] = React.useState<{
    x: number; y: number; distance: number; depth: number; value: number;
  } | null>(null);

  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const nDist = distances.length;
  const nDepth = depths.length;

  const { vMin, vMax, computedStep } = React.useMemo(() => {
    const flat = gridValues.flat().filter(v => !isNaN(v) && isFinite(v));
    const min = flat.length > 0 ? Math.min(...flat) : 0;
    const max = flat.length > 0 ? Math.max(...flat) : 1;
    let step = contourStep;
    if (!step && max > min) {
      const rough = (max - min) / 10;
      const mag = Math.pow(10, Math.floor(Math.log10(rough)));
      step = Math.ceil(rough / mag) * mag;
    }
    return { vMin: min, vMax: max, computedStep: step ?? 1 };
  }, [gridValues, contourStep]);

  const proj = React.useMemo(() => {
    if (nDist < 2 || nDepth < 2) return null;
    const xScale = d3.scaleLinear()
      .domain([distances[0], distances[nDist - 1]])
      .range([0, innerW]);
    const yScale = d3.scaleLinear()
      .domain([depths[0], depths[nDepth - 1]])
      .range([0, innerH]);
    return {
      distToX: (d: number) => padding.left + xScale(d),
      depthToY: (d: number) => padding.top + yScale(d),
      xToDist: (x: number) => xScale.invert(x - padding.left),
      yToDepth: (y: number) => yScale.invert(y - padding.top),
      xScale, yScale,
    };
  }, [distances, depths, nDist, nDepth, innerW, innerH, padding]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !proj || nDist < 2 || nDepth < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const imgData = ctx.createImageData(innerW, innerH);
    const data = imgData.data;

    const dMin = distances[0];
    const dMax = distances[nDist - 1];
    const zMin = depths[0];
    const zMax = depths[nDepth - 1];

    for (let py = 0; py < innerH; py++) {
      const zNorm = py / (innerH - 1);
      const z = zMin + (zMax - zMin) * zNorm;
      const gz = (z - depths[0]) / (depths[nDepth - 1] - depths[0]) * (nDepth - 1);
      const jz0 = Math.max(0, Math.min(nDepth - 1, Math.floor(gz)));
      const jz1 = Math.max(0, Math.min(nDepth - 1, jz0 + 1));
      const tz = nDepth > 1 ? gz - jz0 : 0;

      for (let px = 0; px < innerW; px++) {
        const dNorm = px / (innerW - 1);
        const d = dMin + (dMax - dMin) * dNorm;
        const gd = (d - distances[0]) / (distances[nDist - 1] - distances[0]) * (nDist - 1);
        const jx0 = Math.max(0, Math.min(nDist - 1, Math.floor(gd)));
        const jx1 = Math.max(0, Math.min(nDist - 1, jx0 + 1));
        const tx = nDist > 1 ? gd - jx0 : 0;

        const v00 = gridValues[jz0]?.[jx0] ?? NaN;
        const v10 = gridValues[jz0]?.[jx1] ?? NaN;
        const v01 = gridValues[jz1]?.[jx0] ?? NaN;
        const v11 = gridValues[jz1]?.[jx1] ?? NaN;

        let value: number;
        if (isNaN(v00) || isNaN(v10) || isNaN(v01) || isNaN(v11)) {
          const vals = [v00, v10, v01, v11].filter(v => !isNaN(v));
          value = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
        } else {
          const v0 = v00 * (1 - tx) + v10 * tx;
          const v1 = v01 * (1 - tx) + v11 * tx;
          value = v0 * (1 - tz) + v1 * tz;
        }

        const idx = (py * innerW + px) * 4;
        if (isNaN(value) || !isFinite(value)) {
          data[idx] = 10; data[idx + 1] = 18; data[idx + 2] = 32; data[idx + 3] = 255;
        } else {
          const t = vMax === vMin ? 0.5 : (value - vMin) / (vMax - vMin);
          const clamped = Math.max(0, Math.min(1, t));
          const color = colorScale(clamped);
          data[idx] = parseInt(color.slice(1, 3), 16);
          data[idx + 1] = parseInt(color.slice(3, 5), 16);
          data[idx + 2] = parseInt(color.slice(5, 7), 16);
          data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, padding.left, padding.top);

    if (showContours && computedStep > 0) {
      const nx = nDist;
      const ny = nDepth;
      const flatArr = new Array(nx * ny);
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const v = gridValues[j]?.[i];
          flatArr[j * nx + i] = (v !== undefined && !isNaN(v)) ? v : NaN;
        }
      }

      const thresholds: number[] = [];
      for (let v = Math.ceil(vMin / computedStep) * computedStep; v <= vMax; v += computedStep) {
        thresholds.push(+v.toFixed(3));
      }

      try {
        const contours = d3.contours()
          .size([nx, ny])
          .thresholds(thresholds)(flatArr);

        const lineGen = d3.line<[number, number]>()
          .x(d => padding.left + (d[0] / (nx - 1)) * innerW)
          .y(d => padding.top + (d[1] / (ny - 1)) * innerH)
          .curve(d3.curveMonotoneX);

        for (const c of contours) {
          const t = vMax === vMin ? 0.5 : (c.value - vMin) / (vMax - vMin);
          const baseColor = colorScale(Math.max(0, Math.min(1, t)));
          const r = parseInt(baseColor.slice(1, 3), 16);
          const g = parseInt(baseColor.slice(3, 5), 16);
          const b = parseInt(baseColor.slice(5, 7), 16);
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          ctx.strokeStyle = brightness > 140
            ? 'rgba(10, 20, 40, 0.65)'
            : 'rgba(255, 255, 255, 0.55)';
          ctx.lineWidth = 0.9;

          for (const ring of c.coordinates) {
            for (const rawCoords of ring) {
              const coords = rawCoords as [number, number][];
              if (coords.length < 2) continue;
              const path = lineGen(coords);
              if (path) {
                const p = new Path2D(path);
                ctx.stroke(p);
              }
              if (coords.length > 4) {
                const mid = coords[Math.floor(coords.length / 2)];
                const mx = padding.left + (mid[0] / (nx - 1)) * innerW;
                const my = padding.top + (mid[1] / (ny - 1)) * innerH;
                ctx.font = "9px 'Source Code Pro', monospace";
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.textAlign = 'center';
                const label = Number.isInteger(c.value) ? c.value.toFixed(0) : c.value.toFixed(1);
                ctx.fillText(label, mx, my);
              }
            }
          }
        }
      } catch (_) {
      }
    }

    drawAxes(ctx);
  }, [gridValues, distances, depths, nDist, nDepth, proj, innerW, innerH, padding, colorScale, vMin, vMax, showContours, computedStep, width, height]);

  const drawAxes = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + innerH);
    ctx.lineTo(padding.left + innerW, padding.top + innerH);
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + innerH);
    ctx.stroke();

    const distTicks = Math.min(8, nDist);
    const tickStep = Math.max(1, Math.floor((nDist - 1) / (distTicks - 1)));
    ctx.fillStyle = 'rgba(230,240,255,0.55)';
    ctx.font = "10px 'Source Code Pro', monospace";
    ctx.textAlign = 'center';

    for (let i = 0; i < nDist; i += tickStep) {
      const x = proj!.distToX(distances[i]);
      ctx.beginPath();
      ctx.moveTo(x, padding.top + innerH);
      ctx.lineTo(x, padding.top + innerH + 5);
      ctx.stroke();
      ctx.fillText(distances[i].toFixed(0), x, padding.top + innerH + 18);
      if (stationLabels && stationLabels[i]) {
        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = 'rgba(230,240,255,0.8)';
        ctx.save();
        ctx.translate(x, padding.top + innerH + 32);
        ctx.rotate(-Math.PI / 6);
        ctx.textAlign = 'right';
        ctx.fillText(stationLabels[i], 0, 0);
        ctx.restore();
        ctx.font = "10px 'Source Code Pro', monospace";
        ctx.fillStyle = 'rgba(230,240,255,0.55)';
        ctx.textAlign = 'center';
      }
    }

    const depthTicks = Math.min(8, nDepth);
    const dTickStep = Math.max(1, Math.floor((nDepth - 1) / (depthTicks - 1)));
    ctx.textAlign = 'right';
    for (let i = 0; i < nDepth; i += dTickStep) {
      const y = proj!.depthToY(depths[i]);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left - 5, y);
      ctx.stroke();
      ctx.fillText(depths[i].toFixed(0) + ' m', padding.left - 8, y + 3);
    }

    ctx.save();
    ctx.translate(padding.left - 48, padding.top + innerH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(230,240,255,0.8)';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('深度 Depth (m)', 0, 0);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(230,240,255,0.8)';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('断面距离 Distance (km)', padding.left + innerW / 2, padding.top + innerH + 50);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!proj) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < padding.left || x > padding.left + innerW ||
        y < padding.top || y > padding.top + innerH) {
      setHoverInfo(null);
      return;
    }

    const distance = proj.xToDist(x);
    const depth = proj.yToDepth(y);

    const gd = (distance - distances[0]) / (distances[nDist - 1] - distances[0]) * (nDist - 1);
    const gz = (depth - depths[0]) / (depths[nDepth - 1] - depths[0]) * (nDepth - 1);
    const ix = Math.max(0, Math.min(nDist - 1, Math.round(gd)));
    const iy = Math.max(0, Math.min(nDepth - 1, Math.round(gz)));
    const value = gridValues[iy]?.[ix];

    if (value !== undefined && !isNaN(value)) {
      setHoverInfo({ x, y, distance, depth, value });
    } else {
      setHoverInfo(null);
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="relative" style={{ width, height }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="rounded-lg cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverInfo(null)}
        />
        {hoverInfo && (
          <div
            className="chart-tooltip"
            style={{
              left: Math.min(hoverInfo.x + 14, width - 200),
              top: Math.max(hoverInfo.y - 60, 5),
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '3px 10px', fontSize: 11 }}>
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>距离:</span>
              <span style={{ fontFamily: "'Source Code Pro', monospace" }}>
                {hoverInfo.distance.toFixed(1)} km
              </span>
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>深度:</span>
              <span style={{ fontFamily: "'Source Code Pro', monospace" }}>
                {hoverInfo.depth.toFixed(0)} m
              </span>
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>{parameterLabel}:</span>
              <span style={{ color: '#4ECDC4', fontWeight: 600 }}>
                {hoverInfo.value.toFixed(2)} {unit}
              </span>
            </div>
          </div>
        )}
        {(nDist < 2 || nDepth < 2 || gridValues.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center text-ocean-200/50 text-sm">
            请选择至少两个站点以绘制断面
          </div>
        )}
      </div>
    </div>
  );
};
