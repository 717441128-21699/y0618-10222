import React from 'react';
import * as d3 from 'd3';
import { useDataStore } from '@/store/dataStore';
import { ChartCard } from '@/components/layout/ChartCard';
import { StationSelector } from '@/components/common/StationSelector';
import { extractDepthValues } from '@/hooks/useContours';
import type { Station, CTDDataPoint } from '@/types/oceanography';
import { Thermometer, Droplets, Gauge, Volume2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type ProfileParam = 'temperature' | 'salinity' | 'density' | 'soundSpeed';

const paramConfig: Record<ProfileParam, {
  label: string;
  unit: string;
  icon: React.ElementType;
  color: string;
  key: keyof CTDDataPoint;
}> = {
  temperature: { label: '温度', unit: '°C', icon: Thermometer, color: '#F46036', key: 'temperature' },
  salinity: { label: '盐度', unit: 'PSU', icon: Droplets, color: '#3E92CC', key: 'salinity' },
  density: { label: '密度', unit: 'kg/m³', icon: Gauge, color: '#2FB6B0', key: 'density' },
  soundSpeed: { label: '声速', unit: 'm/s', icon: Volume2, color: '#F4D35E', key: 'soundSpeed' },
};

const findThermoclineDepth = (station: Station, param: ProfileParam): { depth: number; gradient: number } | null => {
  const data = station.data;
  if (data.length < 3) return null;

  const key = paramConfig[param].key;
  let maxGradient = -Infinity;
  let thermoclineDepth = data[Math.floor(data.length / 2)].depth;

  for (let i = 1; i < data.length; i++) {
    const d0 = data[i - 1];
    const d1 = data[i];
    const v0 = d0[key] as number;
    const v1 = d1[key] as number;
    if (v0 === undefined || v1 === undefined) continue;
    const depthDiff = d1.depth - d0.depth;
    if (depthDiff <= 0) continue;
    const gradient = Math.abs((v1 - v0) / depthDiff);
    if (gradient > maxGradient) {
      maxGradient = gradient;
      thermoclineDepth = (d0.depth + d1.depth) / 2;
    }
  }

  return { depth: thermoclineDepth, gradient: maxGradient };
};

interface ProfileChartProps {
  stations: Station[];
  param: ProfileParam;
  width?: number;
  height?: number;
}

const ProfileChart: React.FC<ProfileChartProps> = ({ stations, param, width = 780, height = 560 }) => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = React.useState<{
    station: Station;
    depth: number;
    value: number;
    x: number;
    y: number;
  } | null>(null);

  const cfg = paramConfig[param];
  const profiles = extractDepthValues(stations, param === 'soundSpeed' ? 'temperature' : param as any);

  React.useEffect(() => {
    if (!svgRef.current || stations.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 30, right: 50, bottom: 50, left: 70 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    let allValues: number[] = [];
    let maxDepth = 0;
    for (const p of profiles) {
      if (param === 'soundSpeed') {
        const st = stations.find(s => s.id === p.station.id);
        if (st) {
          const ssValues = st.data.map(d => d.soundSpeed ?? 0);
          allValues = allValues.concat(ssValues);
          p.values = ssValues;
          p.depths = st.data.map(d => d.depth);
        }
      } else {
        allValues = allValues.concat(p.values);
      }
      maxDepth = Math.max(maxDepth, ...p.depths);
    }

    if (allValues.length === 0) return;

    const vMin = d3.min(allValues) || 0;
    const vMax = d3.max(allValues) || 1;
    const vPad = (vMax - vMin) * 0.08;

    const xScale = d3.scaleLinear()
      .domain([vMin - vPad, vMax + vPad])
      .range([0, innerW]);

    const yScale = d3.scaleLinear()
      .domain([0, maxDepth * 1.05])
      .range([0, innerH]);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('g').selectAll('line.h')
      .data(xScale.ticks(8)).join('line').attr('class', 'tick-line')
      .attr('x1', d => xScale(d)).attr('x2', d => xScale(d))
      .attr('y1', 0).attr('y2', innerH);

    g.append('g').selectAll('line.v')
      .data(yScale.ticks(8)).join('line').attr('class', 'tick-line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', d => yScale(d)).attr('y2', d => yScale(d));

    for (const prof of profiles) {
      const st = stations.find(s => s.id === prof.station.id);
      if (!st) continue;
      const thermo = findThermoclineDepth(st, param);
      if (thermo) {
        g.append('line')
          .attr('x1', 0).attr('x2', innerW)
          .attr('y1', yScale(thermo.depth)).attr('y2', yScale(thermo.depth))
          .attr('stroke', st.color)
          .attr('stroke-opacity', 0.3)
          .attr('stroke-dasharray', '3 3')
          .attr('stroke-width', 1);
      }
    }

    const line = d3.line<[number, number]>()
      .x(d => xScale(d[0]))
      .y(d => yScale(d[1]))
      .curve(d3.curveMonotoneY);

    for (const prof of profiles) {
      const pts: [number, number][] = [];
      for (let i = 0; i < prof.values.length; i++) {
        pts.push([prof.values[i], prof.depths[i]]);
      }

      const pathG = g.append('g');

      const gradId = `grad-${prof.station.id}-${param}`;
      const grad = svg.append('defs')
        .append('linearGradient')
        .attr('id', gradId)
        .attr('x1', '0%').attr('x2', '100%')
        .attr('y1', '0%').attr('y2', '0%');
      grad.append('stop').attr('offset', '0%').attr('stop-color', prof.station.color).attr('stop-opacity', 0.08);
      grad.append('stop').attr('offset', '100%').attr('stop-color', prof.station.color).attr('stop-opacity', 0.25);

      const areaPath = d3.area<[number, number]>()
        .x0(0).x1(d => xScale(d[0]))
        .y(d => yScale(d[1]))
        .curve(d3.curveMonotoneY);

      pathG.append('path')
        .datum(pts)
        .attr('d', areaPath)
        .attr('fill', `url(#${gradId})`);

      pathG.append('path')
        .datum(pts)
        .attr('fill', 'none')
        .attr('stroke', prof.station.color)
        .attr('stroke-width', 2)
        .attr('d', line)
        .style('cursor', 'pointer');

      const hoverPts = pathG.selectAll('circle.hover')
        .data(pts.filter((_, i) => i % Math.max(1, Math.floor(pts.length / 40)) === 0))
        .join('circle')
        .attr('class', 'hover')
        .attr('cx', d => xScale(d[0]))
        .attr('cy', d => yScale(d[1]))
        .attr('r', 0)
        .attr('fill', prof.station.color)
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer');

      pathG.on('mouseenter', () => {
        hoverPts.transition().duration(100).attr('r', 3);
      }).on('mouseleave', () => {
        hoverPts.transition().duration(150).attr('r', 0);
        setHovered(null);
      });

      hoverPts.on('mouseenter', (event, d) => {
        const [mx, my] = d3.pointer(event, svgRef.current!);
        setHovered({
          station: prof.station,
          depth: d[1],
          value: d[0],
          x: mx,
          y: my,
        });
      }).on('mousemove', (event, d) => {
        const [mx, my] = d3.pointer(event, svgRef.current!);
        setHovered({
          station: prof.station,
          depth: d[1],
          value: d[0],
          x: mx,
          y: my,
        });
      });
    }

    const styleAxis = (sel: d3.Selection<SVGGElement, unknown, null, undefined>) => {
      sel.selectAll('.domain').attr('stroke', 'rgba(255,255,255,0.25)');
      sel.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.15)');
      sel.selectAll('.tick text').attr('class', 'axis-label');
    };

    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(8)).call(styleAxis);

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(10).tickFormat(d => `${d}m`)).call(styleAxis);

    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 42)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(230,240,255,0.85)')
      .style('font-size', 13).style('font-weight', 500)
      .text(`${cfg.label} (${cfg.unit})`);

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -55)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(230,240,255,0.85)')
      .style('font-size', 13).style('font-weight', 500)
      .text('深度  Depth');

    if (profiles.length > 0) {
      const legend = g.append('g').attr('transform', `translate(${innerW - 140}, 8)`);
      profiles.slice(0, 6).forEach((p, i) => {
        const lg = legend.append('g').attr('transform', `translate(0, ${i * 18})`);
        lg.append('line')
          .attr('x1', 0).attr('x2', 18)
          .attr('y1', 6).attr('y2', 6)
          .attr('stroke', p.station.color)
          .attr('stroke-width', 2);
        lg.append('text')
          .attr('x', 24).attr('y', 10)
          .attr('fill', 'rgba(230,240,255,0.75)')
          .style('font-size', 10)
          .text(p.station.name);
      });
    }
  }, [stations, param, width, height, profiles, cfg]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg ref={svgRef} width={width} height={height} />
      {hovered && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(hovered.x + 16, width - 180),
            top: Math.max(hovered.y - 60, 5),
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '3px 10px' }}>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>站点:</span>
            <span style={{ fontWeight: 600, color: hovered.station.color }}>{hovered.station.name}</span>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>深度:</span>
            <span style={{ fontFamily: "'Source Code Pro', monospace" }}>{hovered.depth.toFixed(0)} m</span>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>{cfg.label}:</span>
            <span style={{ color: cfg.color, fontWeight: 600 }}>
              {hovered.value.toFixed(cfg.key === 'salinity' ? 3 : 2)} {cfg.unit}
            </span>
          </div>
        </div>
      )}
      {stations.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-ocean-200/50 text-sm">
          请选择观测站点
        </div>
      )}
    </div>
  );
};

const ThermoclineStats: React.FC<{ param: ProfileParam }> = ({ param }) => {
  const { stations, selectedStationIds } = useDataStore();
  const selectedStations = stations.filter(s => selectedStationIds.includes(s.id));

  const cfg = paramConfig[param];
  const paramName = param === 'temperature' ? '温跃层'
    : param === 'salinity' ? '盐跃层'
    : param === 'density' ? '密跃层' : '声速跃层';

  if (selectedStations.length === 0) {
    return (
      <div className="text-center text-ocean-200/50 text-sm py-6">
        暂无数据，请选择至少一个站点
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {selectedStations.map((station) => {
        const thermo = findThermoclineDepth(station, param);
        return (
          <div
            key={station.id}
            className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]
                       hover:bg-white/[0.05] transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: station.color }}
              />
              <span className="text-xs font-medium text-ocean-50 truncate">{station.name}</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ocean-200/50">{paramName}</span>
                <span className="font-mono" style={{ color: cfg.color }}>
                  {thermo ? `${thermo.depth.toFixed(0)}m` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ocean-200/50">最大梯度</span>
                <span className="font-mono text-marine-teal">
                  {thermo ? `${thermo.gradient.toFixed(3)} ${cfg.unit}/m` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ocean-200/50">最大深度</span>
                <span className="font-mono text-ocean-200/80">{station.maxDepth}m</span>
              </div>
            </div>
            <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              {thermo && (
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (thermo.depth / station.maxDepth) * 100)}%`,
                    backgroundColor: cfg.color,
                    opacity: 0.8,
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const DepthProfilePage: React.FC = () => {
  const { stations, selectedStationIds } = useDataStore();
  const [param, setParam] = React.useState<ProfileParam>('temperature');

  const selectedStations = React.useMemo(
    () => stations.filter(s => selectedStationIds.includes(s.id)),
    [stations, selectedStationIds]
  );

  const cfg = paramConfig[param];
  const Icon = cfg.icon;

  return (
    <div className="p-6 h-full flex flex-col gap-5 fade-in-stagger">
      <ChartCard className="flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs text-ocean-200/50 flex items-center gap-1.5">
            <ChevronDown className="w-3.5 h-3.5" />
            参数选择
          </span>
          <div className="flex rounded-xl bg-white/[0.04] border border-white/[0.08] p-1">
            {(Object.keys(paramConfig) as ProfileParam[]).map((key) => {
              const opt = paramConfig[key];
              const OptIcon = opt.icon;
              const active = param === key;
              return (
                <button
                  key={key}
                  onClick={() => setParam(key)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    active
                      ? 'text-white shadow-lg'
                      : 'text-ocean-200/60 hover:text-ocean-100'
                  )}
                  style={active ? { backgroundColor: `${opt.color}30`, border: `1px solid ${opt.color}50` } : {}}
                >
                  <OptIcon className="w-4 h-4" style={active ? { color: opt.color } : {}} />
                  {opt.label}
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded font-mono',
                    active ? 'bg-white/10' : 'bg-white/[0.04] text-ocean-200/40'
                  )}>
                    {opt.unit}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </ChartCard>

      <div className="grid grid-cols-4 gap-5 flex-1 min-h-0">
        <div className="col-span-3 min-h-0">
          <ChartCard
            title={`${cfg.label}垂直剖面图`}
            subtitle={`多站点对比 · ${param === 'temperature' ? '温跃层' : param === 'salinity' ? '盐跃层' : param === 'density' ? '密跃层' : '声速跃层'}虚线标记`}
            actions={
              <div className="flex items-center gap-2 text-xs text-ocean-200/50">
                <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                <span>已选 {selectedStations.length} 站</span>
              </div>
            }
            className="h-full"
          >
            <div className="w-full h-full flex items-center justify-center">
              <ProfileChart
                stations={selectedStations}
                param={param}
                width={760}
                height={520}
              />
            </div>
          </ChartCard>
        </div>

        <div className="col-span-1 min-h-0">
          <ChartCard
            title="观测站点选择"
            subtitle="点击切换显示站点"
            className="h-full"
          >
            <StationSelector />
          </ChartCard>
        </div>
      </div>

      <ChartCard
        title="跃层深度统计"
        subtitle="最大梯度法检测 · 参数随深度变化率极值位置"
        className="flex-shrink-0"
      >
        <ThermoclineStats param={param} />
      </ChartCard>
    </div>
  );
};

export default DepthProfilePage;
