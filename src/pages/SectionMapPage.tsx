import React from 'react';
import * as d3 from 'd3';
import { useDataStore } from '@/store/dataStore';
import { ChartCard } from '@/components/layout/ChartCard';
import type { Station } from '@/types/oceanography';
import { haversineDistance, interpolateAlongLine, bearing } from '@/utils/gis/geoUtils';
import { Route, MapPin, ChevronDown, Navigation, Anchor } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PresetRoute {
  id: string;
  name: string;
  waypoints: [number, number][];
  description: string;
}

const PRESET_ROUTES: PresetRoute[] = [
  {
    id: 'route-a',
    name: '航线A · 近岸-外海断面',
    waypoints: [
      [121.35, 29.35],
      [122.45, 29.85],
    ],
    description: 'NW-SE走向 · 跨沿岸水团与黑潮锋面',
  },
  {
    id: 'route-b',
    name: '航线B · 纬向断面',
    waypoints: [
      [121.30, 29.55],
      [122.50, 29.55],
    ],
    description: 'EW走向 · 横穿长江冲淡水主轴',
  },
  {
    id: 'route-c',
    name: '航线C · 经向深断面',
    waypoints: [
      [121.80, 29.00],
      [122.00, 30.10],
    ],
    description: 'NS走向 · 穿越深层陆架坡折带',
  },
];

const getValueAtDepth = (
  data: { depth: number; temperature: number; salinity: number; density: number }[],
  targetDepth: number,
  param: 'temperature' | 'salinity' | 'density'
): number => {
  if (data.length === 0) return NaN;
  if (targetDepth <= data[0].depth) return data[0][param];
  if (targetDepth >= data[data.length - 1].depth) return data[data.length - 1][param];
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

const findNearestStation = (lon: number, lat: number, stations: Station[]): Station | null => {
  if (stations.length === 0) return null;
  let best = stations[0];
  let bestDist = haversineDistance(lon, lat, best.longitude, best.latitude);
  for (const s of stations) {
    const d = haversineDistance(lon, lat, s.longitude, s.latitude);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
};

interface SectionHeatmapProps {
  stations: Station[];
  route: PresetRoute;
  param: 'temperature' | 'salinity' | 'density';
  width?: number;
  height?: number;
}

const SectionHeatmap: React.FC<SectionHeatmapProps> = ({
  stations,
  route,
  param,
  width = 800,
  height = 500,
}) => {
  const svgRef = React.useRef<SVGSVGElement>(null);

  const paramLabel = param === 'temperature' ? '温度' : param === 'salinity' ? '盐度' : '密度';
  const paramUnit = param === 'temperature' ? '°C' : param === 'salinity' ? 'PSU' : 'kg/m³';

  React.useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 30, right: 60, bottom: 60, left: 70 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    if (stations.length === 0) {
      svg.append('text')
        .attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(230,240,255,0.4)')
        .style('font-size', 14)
        .text('暂无数据');
      return;
    }

    const nPoints = 60;
    const nDepths = 80;
    const maxDepth = 1500;

    const linePts = interpolateAlongLine(route.waypoints, nPoints);

    let totalDist = 0;
    const distances: number[] = [0];
    for (let i = 1; i < linePts.length; i++) {
      totalDist += haversineDistance(
        linePts[i - 1][0], linePts[i - 1][1],
        linePts[i][0], linePts[i][1]
      ) / 1000;
      distances.push(totalDist);
    }

    const gridValues: number[][] = [];
    let vMin = Infinity, vMax = -Infinity;

    for (let j = 0; j < nDepths; j++) {
      const row: number[] = [];
      const depth = (j / (nDepths - 1)) * maxDepth;
      for (let i = 0; i < nPoints; i++) {
        const [lon, lat] = linePts[i];
        const station = findNearestStation(lon, lat, stations);
        if (!station) { row.push(NaN); continue; }
        const val = getValueAtDepth(station.data, depth, param);
        row.push(val);
        if (!isNaN(val)) {
          vMin = Math.min(vMin, val);
          vMax = Math.max(vMax, val);
        }
      }
      gridValues.push(row);
    }

    if (vMin === Infinity) {
      svg.append('text')
        .attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(230,240,255,0.4)')
        .style('font-size', 14)
        .text('断面数据不足');
      return;
    }

    const colormap = param === 'temperature'
      ? d3.interpolateTurbo
      : param === 'salinity'
      ? d3.interpolateViridis
      : d3.interpolateCividis;

    const colorScale = d3.scaleSequential([vMin, vMax], colormap);

    const xScale = d3.scaleLinear().domain([0, totalDist]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([0, maxDepth]).range([0, innerH]);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const cellW = innerW / (nPoints - 1);
    const cellH = innerH / (nDepths - 1);

    for (let j = 0; j < nDepths - 1; j++) {
      for (let i = 0; i < nPoints - 1; i++) {
        const vals = [
          gridValues[j][i], gridValues[j][i + 1],
          gridValues[j + 1][i], gridValues[j + 1][i + 1],
        ].filter(v => !isNaN(v));
        if (vals.length === 0) continue;
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        g.append('rect')
          .attr('x', i * cellW).attr('y', j * cellH)
          .attr('width', cellW + 0.5).attr('height', cellH + 0.5)
          .attr('fill', colorScale(avg))
          .attr('fill-opacity', 0.9);
      }
    }

    const contourLevels = d3.range(
      Math.ceil(vMin * 10) / 10,
      vMax,
      Math.max(0.2, (vMax - vMin) / 8)
    );

    const flatVals = new Float64Array(nPoints * nDepths);
    for (let j = 0; j < nDepths; j++) {
      for (let i = 0; i < nPoints; i++) {
        flatVals[j * nPoints + i] = isNaN(gridValues[j][i])
          ? (vMin + vMax) / 2
          : gridValues[j][i];
      }
    }

    try {
      const contours = d3.contours()
        .size([nPoints, nDepths])
        .thresholds(contourLevels)(flatVals as any);

      for (const c of contours) {
        for (const ring of c.coordinates as number[][][][]) {
          for (const coords of ring as number[][][]) {
            const projected = coords.map(([ix, iy]) => [
              xScale((ix / (nPoints - 1)) * totalDist),
              yScale((iy / (nDepths - 1)) * maxDepth),
            ] as [number, number]);
            const line = d3.line<[number, number]>().curve(d3.curveMonotoneX);
            const path = g.append('path')
              .datum(projected)
              .attr('d', line)
              .attr('fill', 'none')
              .attr('stroke', 'rgba(255,255,255,0.45)')
              .attr('stroke-width', 0.8);

            if (projected.length > 5) {
              const mid = projected[Math.floor(projected.length / 2)];
              const vStr = param === 'density'
                ? `σt=${(c.value - 1000).toFixed(1)}`
                : `${c.value.toFixed(1)}`;
              path.attr('data-label', vStr);
              const labelG = g.append('g')
                .attr('transform', `translate(${mid[0]},${mid[1]})`);
              labelG.append('rect')
                .attr('x', -vStr.length * 3.2 - 4).attr('y', -6)
                .attr('width', vStr.length * 6.4 + 8).attr('height', 12)
                .attr('rx', 2)
                .attr('fill', 'rgba(5,20,41,0.9)');
              labelG.append('text')
                .attr('text-anchor', 'middle')
                .attr('y', 3)
                .attr('fill', 'rgba(255,255,255,0.9)')
                .style('font-size', 8.5)
                .style('font-family', "'Source Code Pro', monospace")
                .style('font-weight', 600)
                .text(vStr);
            }
          }
        }
      }
    } catch (e) { /* ignore contour errors */ }

    for (let i = 0; i <= 8; i++) {
      const d = (i / 8) * totalDist;
      g.append('line')
        .attr('x1', xScale(d)).attr('x2', xScale(d))
        .attr('y1', 0).attr('y2', innerH)
        .attr('stroke', 'rgba(255,255,255,0.08)')
        .attr('stroke-width', 1);
    }
    for (let i = 0; i <= 8; i++) {
      const d = (i / 8) * maxDepth;
      g.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', yScale(d)).attr('y2', yScale(d))
        .attr('stroke', 'rgba(255,255,255,0.08)')
        .attr('stroke-width', 1);
    }

    const styleAxis = (sel: d3.Selection<SVGGElement, unknown, null, undefined>) => {
      sel.selectAll('.domain').attr('stroke', 'rgba(255,255,255,0.25)');
      sel.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.15)');
      sel.selectAll('.tick text').attr('class', 'axis-label');
    };

    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(8).tickFormat(d => `${d}km`)).call(styleAxis);

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(10).tickFormat(d => `${d}m`)).call(styleAxis);

    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 42)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(230,240,255,0.85)')
      .style('font-size', 12).style('font-weight', 500)
      .text('沿航线距离  Distance');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -55)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(230,240,255,0.85)')
      .style('font-size', 12).style('font-weight', 500)
      .text('深度  Depth');

    const legendW = 12, legendH = innerH;
    const legendG = svg.append('g')
      .attr('transform', `translate(${width - 25},${margin.top})`);
    for (let k = 0; k < 100; k++) {
      legendG.append('rect')
        .attr('x', 0).attr('y', (k / 100) * legendH)
        .attr('width', legendW).attr('height', legendH / 100 + 0.5)
        .attr('fill', colorScale(vMax - (k / 99) * (vMax - vMin)));
    }
    legendG.append('rect')
      .attr('x', 0).attr('y', 0)
      .attr('width', legendW).attr('height', legendH)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.2)');
    legendG.append('text')
      .attr('x', legendW / 2).attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(230,240,255,0.6)')
      .style('font-size', 9)
      .style('font-family', "'Source Code Pro', monospace")
      .text(param === 'density' ? `σt=${(vMax - 1000).toFixed(1)}` : vMax.toFixed(1));
    legendG.append('text')
      .attr('x', legendW / 2).attr('y', legendH + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(230,240,255,0.6)')
      .style('font-size', 9)
      .style('font-family', "'Source Code Pro', monospace")
      .text(param === 'density' ? `σt=${(vMin - 1000).toFixed(1)}` : vMin.toFixed(1));

    svg.append('text')
      .attr('x', width / 2).attr('y', height - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(230,240,255,0.45)')
      .style('font-size', 10)
      .text(`${route.name} · 总长${totalDist.toFixed(1)}km · ${paramLabel}(${paramUnit})`);

  }, [stations, route, param, width, height, paramLabel, paramUnit]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg ref={svgRef} width={width} height={height} />
    </div>
  );
};

interface RoutePreviewProps {
  route: PresetRoute;
  stations: Station[];
  width?: number;
  height?: number;
}

const RoutePreview: React.FC<RoutePreviewProps> = ({ route, stations, width = 520, height = 180 }) => {
  const svgRef = React.useRef<SVGSVGElement>(null);

  React.useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 15, right: 20, bottom: 25, left: 35 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
    for (const [lon, lat] of route.waypoints) {
      lonMin = Math.min(lonMin, lon); lonMax = Math.max(lonMax, lon);
      latMin = Math.min(latMin, lat); latMax = Math.max(latMax, lat);
    }
    for (const s of stations) {
      lonMin = Math.min(lonMin, s.longitude); lonMax = Math.max(lonMax, s.longitude);
      latMin = Math.min(latMin, s.latitude); latMax = Math.max(latMax, s.latitude);
    }
    const pad = 0.08;
    const dLon = (lonMax - lonMin) * pad;
    const dLat = (latMax - latMin) * pad;
    lonMin -= dLon; lonMax += dLon; latMin -= dLat; latMax += dLat;

    const lonScale = d3.scaleLinear().domain([lonMin, lonMax]).range([0, innerW]);
    const latScale = d3.scaleLinear().domain([latMin, latMax]).range([innerH, 0]);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    for (let i = 0; i <= 5; i++) {
      const lon = lonMin + (i / 5) * (lonMax - lonMin);
      g.append('line')
        .attr('x1', lonScale(lon)).attr('x2', lonScale(lon))
        .attr('y1', 0).attr('y2', innerH)
        .attr('stroke', 'rgba(255,255,255,0.06)');
      if (i % 2 === 0) {
        g.append('text')
          .attr('x', lonScale(lon)).attr('y', innerH + 14)
          .attr('text-anchor', 'middle')
          .attr('fill', 'rgba(230,240,255,0.35)')
          .style('font-size', 8)
          .style('font-family', "'Source Code Pro', monospace")
          .text(`${lon.toFixed(2)}°E`);
      }
    }
    for (let i = 0; i <= 4; i++) {
      const lat = latMin + (i / 4) * (latMax - latMin);
      g.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', latScale(lat)).attr('y2', latScale(lat))
        .attr('stroke', 'rgba(255,255,255,0.06)');
      if (i % 2 === 0) {
        g.append('text')
          .attr('x', -6).attr('y', latScale(lat) + 3)
          .attr('text-anchor', 'end')
          .attr('fill', 'rgba(230,240,255,0.35)')
          .style('font-size', 8)
          .style('font-family', "'Source Code Pro', monospace")
          .text(`${lat.toFixed(2)}°N`);
      }
    }

    for (const s of stations) {
      const px = lonScale(s.longitude);
      const py = latScale(s.latitude);
      g.append('circle')
        .attr('cx', px).attr('cy', py)
        .attr('r', 3.5)
        .attr('fill', s.color)
        .attr('stroke', 'white')
        .attr('stroke-width', 0.6)
        .attr('fill-opacity', 0.85);
      g.append('text')
        .attr('x', px + 5).attr('y', py + 2)
        .attr('fill', 'rgba(230,240,255,0.55)')
        .style('font-size', 7)
        .style('font-weight', 500)
        .text(s.name);
    }

    const pts = route.waypoints;
    const linePts = pts.map(([lon, lat]) => [lonScale(lon), latScale(lat)] as [number, number]);
    const line = d3.line<[number, number]>().curve(d3.curveMonotoneX);

    const gradientId = `route-grad-${route.id}`;
    const defs = svg.append('defs');
    const grad = defs.append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%').attr('x2', '100%')
      .attr('y1', '0%').attr('y2', '0%');
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#3E92CC');
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#F46036');

    g.append('path')
      .datum(linePts)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', `url(#${gradientId})`)
      .attr('stroke-width', 3.5)
      .attr('stroke-linecap', 'round');

    g.append('path')
      .datum(linePts)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.4)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '5 4')
      .attr('stroke-linecap', 'round');

    const startPts = pts.map(([lon, lat]) => [lonScale(lon), latScale(lat)] as [number, number]);
    const start = startPts[0];
    const end = startPts[startPts.length - 1];

    g.append('circle')
      .attr('cx', start[0]).attr('cy', start[1])
      .attr('r', 8)
      .attr('fill', '#2FB6B0')
      .attr('fill-opacity', 0.2)
      .attr('stroke', '#2FB6B0')
      .attr('stroke-width', 1.5);
    g.append('circle')
      .attr('cx', start[0]).attr('cy', start[1])
      .attr('r', 4)
      .attr('fill', '#2FB6B0')
      .attr('stroke', 'white')
      .attr('stroke-width', 1);
    g.append('text')
      .attr('x', start[0]).attr('y', start[1] - 12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#2FB6B0')
      .style('font-size', 9)
      .style('font-weight', 700)
      .text('起点');

    g.append('circle')
      .attr('cx', end[0]).attr('cy', end[1])
      .attr('r', 8)
      .attr('fill', '#F46036')
      .attr('fill-opacity', 0.2)
      .attr('stroke', '#F46036')
      .attr('stroke-width', 1.5);
    g.append('circle')
      .attr('cx', end[0]).attr('cy', end[1])
      .attr('r', 4)
      .attr('fill', '#F46036')
      .attr('stroke', 'white')
      .attr('stroke-width', 1);
    g.append('text')
      .attr('x', end[0]).attr('y', end[1] - 12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#F46036')
      .style('font-size', 9)
      .style('font-weight', 700)
      .text('终点');

    if (pts.length >= 2) {
      const brg = bearing(pts[0][0], pts[0][1], pts[pts.length - 1][0], pts[pts.length - 1][1]);
      const dist = haversineDistance(pts[0][0], pts[0][1], pts[pts.length - 1][0], pts[pts.length - 1][1]) / 1000;
      g.append('text')
        .attr('x', innerW / 2).attr('y', 8)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(230,240,255,0.5)')
        .style('font-size', 9)
        .style('font-family', "'Source Code Pro', monospace")
        .text(`方位 ${brg.toFixed(0)}° · ${dist.toFixed(1)}km`);
    }

  }, [route, stations, width, height]);

  return (
    <div className="flex items-center justify-center w-full">
      <svg ref={svgRef} width={width} height={height} />
    </div>
  );
};

type SectionParam = 'temperature' | 'salinity' | 'density';

const SectionMapPage: React.FC = () => {
  const { stations } = useDataStore();
  const [routeId, setRouteId] = useState<string>(PRESET_ROUTES[0].id);
  const [param, setParam] = useState<SectionParam>('temperature');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const route = PRESET_ROUTES.find(r => r.id === routeId) || PRESET_ROUTES[0];

  const paramOptions: { value: SectionParam; label: string; color: string }[] = [
    { value: 'temperature', label: '温度', color: '#F46036' },
    { value: 'salinity', label: '盐度', color: '#3E92CC' },
    { value: 'density', label: '密度', color: '#2FB6B0' },
  ];

  return (
    <div className="p-6 h-full flex flex-col gap-5 fade-in-stagger">
      <ChartCard className="flex-shrink-0">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-end">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-ocean-200/50">
              <Route className="w-3.5 h-3.5" />
              预设航线
            </div>
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl
                          bg-white/[0.04] border border-white/[0.08] hover:border-marine-cyan/30
                          hover:bg-white/[0.06] transition-all text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-marine-cyan flex-shrink-0" />
                    <span className="text-sm font-medium text-ocean-50 truncate">{route.name}</span>
                  </div>
                  <div className="text-[11px] text-ocean-200/50 mt-0.5 flex items-center gap-1.5 ml-6">
                    <Anchor className="w-3 h-3" />
                    {route.description}
                  </div>
                </div>
                <ChevronDown className={cn(
                  'w-4 h-4 text-ocean-200/50 flex-shrink-0 transition-transform',
                  dropdownOpen && 'rotate-180'
                )} />
              </button>
              {dropdownOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-2 rounded-xl
                               bg-ocean-900/95 backdrop-blur-xl border border-white/[0.1]
                               shadow-2xl overflow-hidden">
                  {PRESET_ROUTES.map(r => (
                    <button
                      key={r.id}
                      onClick={() => { setRouteId(r.id); setDropdownOpen(false); }}
                      className={cn(
                        'w-full px-4 py-3 text-left hover:bg-white/[0.06] transition-colors',
                        r.id === routeId && 'bg-marine-cyan/10 border-l-2 border-marine-cyan'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Route className="w-3.5 h-3.5 text-marine-cyan" />
                        <span className="text-sm font-medium text-ocean-50">{r.name}</span>
                      </div>
                      <div className="text-[11px] text-ocean-200/50 mt-0.5 ml-5.5">
                        {r.description}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-ocean-200/50">
              显示参数
            </div>
            <div className="flex rounded-xl bg-white/[0.04] border border-white/[0.08] p-1">
              {paramOptions.map(opt => {
                const active = param === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setParam(opt.value)}
                    className={cn(
                      'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                      active ? 'text-white shadow-lg' : 'text-ocean-200/60 hover:text-ocean-100'
                    )}
                    style={active ? { backgroundColor: `${opt.color}25`, border: `1px solid ${opt.color}50` } : {}}
                  >
                    <span className="w-2 h-2 rounded-full inline-block mr-2 align-middle"
                          style={{ backgroundColor: opt.color, opacity: active ? 1 : 0.5 }} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </ChartCard>

      <ChartCard
        title={`断面${param === 'temperature' ? '温度' : param === 'salinity' ? '盐度' : '密度'}场`}
        subtitle={route.description}
        actions={
          <div className="flex items-center gap-3 text-xs text-ocean-200/50">
            <MapPin className="w-3.5 h-3.5" />
            <span>{route.waypoints.length} 个航点</span>
          </div>
        }
        className="flex-1 min-h-0"
      >
        <div className="w-full h-full flex items-center justify-center">
          <SectionHeatmap
            stations={stations}
            route={route}
            param={param}
            width={820}
            height={500}
          />
        </div>
      </ChartCard>

      <ChartCard
        title="航线地图预览"
        subtitle="断面起止位置及周边观测站点分布"
        className="flex-shrink-0"
      >
        <RoutePreview route={route} stations={stations} width={780} height={180} />
      </ChartCard>
    </div>
  );
};

function useState<T>(initial: T): [T, (v: T | ((p: T) => T)) => void] {
  return React.useState(initial);
}

export default SectionMapPage;
