import React from 'react';
import * as d3 from 'd3';
import type { InterpolationGrid, Station } from '@/types/oceanography';
import { getParameterScale, type ColorScale } from '@/utils/colorScales';

interface ChartCanvasProps {
  grid: InterpolationGrid | null;
  stations: Station[];
  width?: number;
  height?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  showStations?: boolean;
  showContours?: boolean;
}

interface Projector {
  lonToX: (lon: number) => number;
  latToY: (lat: number) => number;
  xToLon: (x: number) => number;
  yToLat: (y: number) => number;
}

export const ChartCanvas: React.FC<ChartCanvasProps> = ({
  grid,
  stations,
  width = 820,
  height = 640,
  padding = { top: 30, right: 30, bottom: 50, left: 60 },
  showStations = true,
  showContours = true,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const overlayRef = React.useRef<HTMLCanvasElement>(null);
  const [hoverInfo, setHoverInfo] = React.useState<{
    x: number; y: number; lon: number; lat: number; value?: number; station?: Station;
  } | null>(null);

  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const projector = React.useMemo<Projector | null>(() => {
    if (!grid) return null;
    const xScale = d3.scaleLinear()
      .domain([grid.xMin, grid.xMax])
      .range([0, innerW]);
    const yScale = d3.scaleLinear()
      .domain([grid.yMin, grid.yMax])
      .range([innerH, 0]);
    return {
      lonToX: (lon: number) => padding.left + xScale(lon),
      latToY: (lat: number) => padding.top + yScale(lat),
      xToLon: (x: number) => xScale.invert(x - padding.left),
      yToLat: (y: number) => yScale.invert(y - padding.top),
    };
  }, [grid, innerW, innerH, padding]);

  const { vMin, vMax, colorScale } = React.useMemo(() => {
    if (!grid) return { vMin: 0, vMax: 1, colorScale: getParameterScale('temperature') as ColorScale };
    const flat = grid.values.flat();
    const min = Math.min(...flat);
    const max = Math.max(...flat);
    return {
      vMin: min,
      vMax: max,
      colorScale: getParameterScale(grid.parameter) as ColorScale,
    };
  }, [grid]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid || !projector) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255,255,255,0)';
    ctx.fillRect(0, 0, width, height);

    const { nx, ny, values } = grid;
    const cellW = innerW / (nx - 1);
    const cellH = innerH / (ny - 1);

    const imgData = ctx.createImageData(innerW, innerH);
    const data = imgData.data;

    for (let py = 0; py < innerH; py++) {
      const gy = (innerH - 1 - py) / (innerH - 1) * (ny - 1);
      const jy0 = Math.max(0, Math.floor(gy));
      const jy1 = Math.min(ny - 1, jy0 + 1);
      const ty = gy - jy0;

      for (let px = 0; px < innerW; px++) {
        const gx = px / (innerW - 1) * (nx - 1);
        const ix0 = Math.max(0, Math.floor(gx));
        const ix1 = Math.min(nx - 1, ix0 + 1);
        const tx = gx - ix0;

        const v00 = values[jy0]?.[ix0] ?? 0;
        const v10 = values[jy0]?.[ix1] ?? 0;
        const v01 = values[jy1]?.[ix0] ?? 0;
        const v11 = values[jy1]?.[ix1] ?? 0;

        const v0 = v00 * (1 - tx) + v10 * tx;
        const v1 = v01 * (1 - tx) + v11 * tx;
        const value = v0 * (1 - ty) + v1 * ty;

        const t = vMax === vMin ? 0.5 : (value - vMin) / (vMax - vMin);
        const clamped = Math.max(0, Math.min(1, t));
        const color = colorScale(clamped);

        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        const idx = (py * innerW + px) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, padding.left, padding.top);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < nx; gx += Math.ceil(nx / 8)) {
      const x = padding.left + (gx / (nx - 1)) * innerW;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + innerH);
      ctx.stroke();
    }
    for (let gy = 0; gy < ny; gy += Math.ceil(ny / 8)) {
      const y = padding.top + innerH - (gy / (ny - 1)) * innerH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + innerW, y);
      ctx.stroke();
    }

    if (showContours && grid.contours && grid.contours.length > 0) {
      const lineGen = d3.line<[number, number]>()
        .x(d => projector.lonToX(d[0]))
        .y(d => projector.latToY(d[1]))
        .curve(d3.curveMonotoneX);

      const contoursByValue = new Map<number, Array<[number, number][]>>();
      for (const c of grid.contours) {
        if (!contoursByValue.has(c.value)) {
          contoursByValue.set(c.value, []);
        }
        contoursByValue.get(c.value)!.push(c.coordinates);
      }

      for (const [value, rings] of contoursByValue) {
        const t = vMax === vMin ? 0.5 : (value - vMin) / (vMax - vMin);
        const baseColor = colorScale(Math.max(0, Math.min(1, t)));
        const r = parseInt(baseColor.slice(1, 3), 16);
        const g = parseInt(baseColor.slice(3, 5), 16);
        const b = parseInt(baseColor.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        const stroke = brightness > 140
          ? 'rgba(10, 20, 40, 0.55)'
          : 'rgba(255, 255, 255, 0.45)';

        ctx.strokeStyle = stroke;
        ctx.lineWidth = 0.8;
        for (const ring of rings) {
          const path = lineGen(ring);
          if (path) {
            const p = new Path2D(path);
            ctx.stroke(p);
          }
        }
      }
    }

    drawAxes(ctx, grid, projector);
  }, [grid, projector, innerW, innerH, padding, colorScale, vMin, vMax, showContours, width, height]);

  React.useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !projector) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (showStations) {
      for (const s of stations) {
        const x = projector.lonToX(s.longitude);
        const y = projector.latToY(s.latitude);

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 14);
        gradient.addColorStop(0, `${s.color}66`);
        gradient.addColorStop(1, `${s.color}00`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = s.color;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(230,240,255,0.85)';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(s.name, x + 10, y + 3);
      }
    }
  }, [stations, projector, showStations, width, height]);

  const drawAxes = (
    ctx: CanvasRenderingContext2D,
    grid: InterpolationGrid,
    proj: Projector
  ) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + innerH);
    ctx.lineTo(padding.left + innerW, padding.top + innerH);
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + innerH);
    ctx.stroke();

    const lonTicks = d3.ticks(grid.xMin, grid.xMax, 6);
    ctx.fillStyle = 'rgba(230,240,255,0.55)';
    ctx.font = "10px 'Source Code Pro', monospace";
    ctx.textAlign = 'center';
    for (const lon of lonTicks) {
      const x = proj.lonToX(lon);
      ctx.beginPath();
      ctx.moveTo(x, padding.top + innerH);
      ctx.lineTo(x, padding.top + innerH + 5);
      ctx.stroke();
      ctx.fillText(lon.toFixed(2) + '°E', x, padding.top + innerH + 18);
    }

    const latTicks = d3.ticks(grid.yMin, grid.yMax, 6);
    ctx.textAlign = 'right';
    for (const lat of latTicks) {
      const y = proj.latToY(lat);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left - 5, y);
      ctx.stroke();
      ctx.fillText(lat.toFixed(2) + '°N', padding.left - 8, y + 3);
    }

    ctx.save();
    ctx.translate(padding.left - 42, padding.top + innerH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(230,240,255,0.8)';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('纬度 Latitude', 0, 0);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(230,240,255,0.8)';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('经度 Longitude', padding.left + innerW / 2, padding.top + innerH + 38);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!projector || !grid) return;
    const rect = overlayRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const lon = projector.xToLon(x);
    const lat = projector.yToLat(y);

    let value: number | undefined;
    if (lon >= grid.xMin && lon <= grid.xMax && lat >= grid.yMin && lat <= grid.yMax) {
      const gx = ((lon - grid.xMin) / (grid.xMax - grid.xMin)) * (grid.nx - 1);
      const gy = ((lat - grid.yMin) / (grid.yMax - grid.yMin)) * (grid.ny - 1);
      const ix = Math.max(0, Math.min(grid.nx - 1, Math.round(gx)));
      const iy = Math.max(0, Math.min(grid.ny - 1, Math.round(gy)));
      value = grid.values[iy]?.[ix];
    }

    let station: Station | undefined;
    for (const s of stations) {
      const sx = projector.lonToX(s.longitude);
      const sy = projector.latToY(s.latitude);
      if (Math.hypot(sx - x, sy - y) < 10) {
        station = s;
        break;
      }
    }

    setHoverInfo({ x, y, lon, lat, value, station });
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="relative" style={{ width, height }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="rounded-lg"
          style={{ imageRendering: 'pixelated' }}
        />
        <canvas
          ref={overlayRef}
          width={width}
          height={height}
          className="absolute inset-0 rounded-lg cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverInfo(null)}
        />
        {hoverInfo && (
          <div
            className="chart-tooltip"
            style={{
              left: Math.min(hoverInfo.x + 14, width - 210),
              top: Math.max(hoverInfo.y - 60, 5),
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '3px 10px', fontSize: 11 }}>
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>经度:</span>
              <span style={{ fontFamily: "'Source Code Pro', monospace" }}>{hoverInfo.lon.toFixed(3)}°E</span>
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>纬度:</span>
              <span style={{ fontFamily: "'Source Code Pro', monospace" }}>{hoverInfo.lat.toFixed(3)}°N</span>
              {hoverInfo.value !== undefined && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {grid?.parameter === 'temperature' ? '温度:' : grid?.parameter === 'salinity' ? '盐度:' : '密度σt:'}
                  </span>
                  <span style={{ color: '#4ECDC4', fontWeight: 600 }}>
                    {grid?.parameter === 'density'
                      ? (hoverInfo.value - 1000).toFixed(2)
                      : hoverInfo.value.toFixed(2)}
                    {grid?.parameter === 'temperature' ? '°C' : grid?.parameter === 'salinity' ? ' PSU' : ''}
                  </span>
                </>
              )}
              {hoverInfo.station && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.55)' }}>站点:</span>
                  <span style={{ color: hoverInfo.station.color, fontWeight: 600 }}>
                    {hoverInfo.station.name}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
        {!grid && (
          <div className="absolute inset-0 flex items-center justify-center text-ocean-200/50 text-sm">
            暂无水平插值数据，请选择深度层和参数
          </div>
        )}
      </div>
    </div>
  );
};
