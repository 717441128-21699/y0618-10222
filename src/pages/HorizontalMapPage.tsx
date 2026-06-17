import React from 'react';
import * as d3 from 'd3';
import { useDataStore } from '@/store/dataStore';
import { ChartCard } from '@/components/layout/ChartCard';
import { StationSelector } from '@/components/common/StationSelector';
import { ColorLegend } from '@/components/common/ColorLegend';
import { useHorizontalInterpolation } from '@/hooks/useContours';
import type { ParameterType, Station } from '@/types/oceanography';
import { Thermometer, Droplets, Gauge, Waves, Layers, Settings2, Compass, Ruler } from 'lucide-react';
import { getParameterScale } from '@/utils/colorScales';
import { cn } from '@/lib/utils';

type Parameter = 'temperature' | 'salinity' | 'density';

const paramConfig: Record<Parameter, {
  label: string;
  unit: string;
  icon: React.ElementType;
  colormap: (t: number) => string;
  contourPrefix: string;
}> = {
  temperature: {
    label: '温度',
    unit: '°C',
    icon: Thermometer,
    colormap: d3.interpolateTurbo,
    contourPrefix: '°C',
  },
  salinity: {
    label: '盐度',
    unit: 'PSU',
    icon: Droplets,
    colormap: d3.interpolateViridis,
    contourPrefix: '',
  },
  density: {
    label: '密度',
    unit: 'kg/m³',
    icon: Gauge,
    colormap: d3.interpolateCividis,
    contourPrefix: 'σt=',
  },
};

interface ChartCanvasProps {
  stations: Station[];
  parameter: Parameter;
  depthLevel: number;
  algorithm: 'kriging' | 'idw';
  contourStep: number;
  width?: number;
  height?: number;
}

const ChartCanvas: React.FC<ChartCanvasProps> = ({
  stations,
  parameter,
  depthLevel,
  algorithm,
  contourStep,
  width = 780,
  height = 600,
}) => {
  const svgRef = React.useRef<SVGSVGElement>(null);

  const grid = useHorizontalInterpolation(stations, {
    depthLevel,
    parameter: parameter as ParameterType,
    algorithm,
    contourStep: contourStep || undefined,
  });

  const cfg = paramConfig[parameter];

  React.useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 30, right: 60, bottom: 60, left: 70 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    if (!grid || stations.length === 0) {
      const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(230,240,255,0.4)')
        .style('font-size', 14)
        .text(stations.length < 3 ? '需要至少3个站点进行插值计算' : '正在计算...');
      return;
    }

    const lonScale = d3.scaleLinear()
      .domain([grid.xMin, grid.xMax])
      .range([0, innerW]);

    const latScale = d3.scaleLinear()
      .domain([grid.yMin, grid.yMax])
      .range([innerH, 0]);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const allVals = grid.values.flat();
    const vMin = Math.min(...allVals);
    const vMax = Math.max(...allVals);
    const colorScale = d3.scaleSequential([vMin, vMax], cfg.colormap);

    const nx = grid.nx;
    const ny = grid.ny;
    const cellW = innerW / (nx - 1);
    const cellH = innerH / (ny - 1);

    const rasterG = g.append('g').attr('class', 'raster');
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const v = (grid.values[j][i] + grid.values[j][i + 1] + grid.values[j + 1][i] + grid.values[j + 1][i + 1]) / 4;
        rasterG.append('rect')
          .attr('x', i * cellW)
          .attr('y', j * cellH)
          .attr('width', cellW + 0.5)
          .attr('height', cellH + 0.5)
          .attr('fill', colorScale(v))
          .attr('fill-opacity', 0.75);
      }
    }

    for (let i = 0; i <= 8; i++) {
      const lon = grid.xMin + (grid.xMax - grid.xMin) * (i / 8);
      g.append('line')
        .attr('x1', lonScale(lon)).attr('x2', lonScale(lon))
        .attr('y1', 0).attr('y2', innerH)
        .attr('stroke', 'rgba(255,255,255,0.07)')
        .attr('stroke-width', 1);
      if (i % 2 === 0) {
        g.append('text')
          .attr('x', lonScale(lon)).attr('y', innerH + 20)
          .attr('text-anchor', 'middle')
          .attr('fill', 'rgba(230,240,255,0.5)')
          .style('font-size', 10)
          .style('font-family', "'Source Code Pro', monospace")
          .text(`${lon.toFixed(2)}°E`);
      }
    }
    for (let i = 0; i <= 8; i++) {
      const lat = grid.yMin + (grid.yMax - grid.yMin) * (i / 8);
      g.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', latScale(lat)).attr('y2', latScale(lat))
        .attr('stroke', 'rgba(255,255,255,0.07)')
        .attr('stroke-width', 1);
      if (i % 2 === 0) {
        g.append('text')
          .attr('x', -12).attr('y', latScale(lat) + 3)
          .attr('text-anchor', 'end')
          .attr('fill', 'rgba(230,240,255,0.5)')
          .style('font-size', 10)
          .style('font-family', "'Source Code Pro', monospace")
          .text(`${lat.toFixed(2)}°N`);
      }
    }

    const contourG = g.append('g').attr('class', 'contours');
    for (const c of grid.contours) {
      const projected = c.coordinates.map(([lon, lat]) => [lonScale(lon), latScale(lat)] as [number, number]);
      if (projected.length < 2) continue;

      const midIdx = Math.floor(projected.length / 2);
      const midPt = projected[midIdx];
      const midLon = c.coordinates[midIdx][0];
      const midLat = c.coordinates[midIdx][1];

      const line = d3.line<[number, number]>().curve(d3.curveMonotoneX);
      contourG.append('path')
        .datum(projected)
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.55)')
        .attr('stroke-width', 1);

      if (midPt && projected.length > 10) {
        const vStr = parameter === 'density'
          ? `${cfg.contourPrefix}${(c.value - 1000).toFixed(1)}`
          : `${c.value.toFixed(1)}${cfg.contourPrefix}`;
        const labelG = contourG.append('g')
          .attr('transform', `translate(${midPt[0]},${midPt[1]})`);
        labelG.append('rect')
          .attr('x', -vStr.length * 3.2 - 5).attr('y', -7)
          .attr('width', vStr.length * 6.4 + 10).attr('height', 14)
          .attr('rx', 3)
          .attr('fill', 'rgba(5,20,41,0.85)')
          .attr('stroke', colorScale(c.value))
          .attr('stroke-width', 0.5);
        labelG.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', 3)
          .attr('fill', 'rgba(255,255,255,0.9)')
          .style('font-size', 9)
          .style('font-family', "'Source Code Pro', monospace")
          .style('font-weight', 600)
          .text(vStr);
      }
    }

    const stationG = g.append('g').attr('class', 'stations');
    for (const s of stations) {
      const px = lonScale(s.longitude);
      const py = latScale(s.latitude);

      stationG.append('circle')
        .attr('cx', px).attr('cy', py)
        .attr('r', 10)
        .attr('fill', s.color)
        .attr('fill-opacity', 0.15)
        .attr('stroke', s.color)
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.6);

      stationG.append('circle')
        .attr('cx', px).attr('cy', py)
        .attr('r', 4)
        .attr('fill', s.color)
        .attr('stroke', 'white')
        .attr('stroke-width', 1.2);

      stationG.append('text')
        .attr('x', px).attr('y', py - 12)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(230,240,255,0.9)')
        .style('font-size', 10)
        .style('font-weight', 600)
        .text(s.name);
    }

    svg.append('text')
      .attr('x', width / 2).attr('y', height - 10)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(230,240,255,0.55)')
      .style('font-size', 11)
      .text(`深度层: ${depthLevel}m · ${algorithm === 'kriging' ? '克里金插值' : 'IDW反距离加权'} · ${grid.contours.length}条等值线`);

  }, [grid, stations, parameter, depthLevel, algorithm, contourStep, width, height, cfg]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg ref={svgRef} width={width} height={height} />
    </div>
  );
};

const CompassRose: React.FC = () => {
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="70" height="70" viewBox="0 0 70 70">
        <circle cx="35" cy="35" r="30" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        <polygon points="35,8 40,30 35,26 30,30" fill="#F46036" stroke="#F46036" strokeWidth="0.5" />
        <polygon points="35,62 40,40 35,44 30,40" fill="rgba(255,255,255,0.5)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
        <polygon points="8,35 30,40 26,35 30,30" fill="rgba(255,255,255,0.4)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        <polygon points="62,35 40,30 44,35 40,40" fill="rgba(255,255,255,0.4)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        <circle cx="35" cy="35" r="3" fill="rgba(255,255,255,0.7)" />
        <text x="35" y="20" textAnchor="middle" fill="#F46036" fontSize="9" fontWeight="700">N</text>
        <text x="35" y="68" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="600">S</text>
        <text x="50" y="38" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="600">E</text>
        <text x="20" y="38" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="600">W</text>
      </svg>
    </div>
  );
};

const ScaleBar: React.FC = () => {
  return (
    <div className="space-y-1">
      <svg width="120" height="24" viewBox="0 0 120 24">
        <line x1="10" y1="8" x2="110" y2="8" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
        <line x1="10" y1="4" x2="10" y2="12" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
        <line x1="60" y1="4" x2="60" y2="12" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
        <line x1="110" y1="4" x2="110" y2="12" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
        <rect x="10" y="8" width="50" height="6" fill="rgba(255,255,255,0.8)" />
        <rect x="60" y="8" width="50" height="6" fill="rgba(62,146,204,0.5)" />
        <text x="10" y="22" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="'Source Code Pro', monospace">0</text>
        <text x="60" y="22" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="'Source Code Pro', monospace">10km</text>
        <text x="110" y="22" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="'Source Code Pro', monospace">20km</text>
      </svg>
    </div>
  );
};

const HorizontalMapPage: React.FC = () => {
  const { stations, selectedStationIds } = useDataStore();
  const [parameter, setParameter] = React.useState<Parameter>('temperature');
  const [depthLevel, setDepthLevel] = React.useState(20);
  const [algorithm, setAlgorithm] = React.useState<'kriging' | 'idw'>('kriging');
  const [contourStep, setContourStep] = React.useState(1);

  const selectedStations = React.useMemo(
    () => stations.filter(s => selectedStationIds.includes(s.id)),
    [stations, selectedStationIds]
  );

  const cfg = paramConfig[parameter];
  const ParamIcon = cfg.icon;

  const depthMarks = [0, 50, 100, 200, 500, 1000, 1500];

  const grid = useHorizontalInterpolation(selectedStations, {
    depthLevel,
    parameter: parameter as ParameterType,
    algorithm,
    contourStep: contourStep || undefined,
  });

  const legendScale = getParameterScale(parameter);

  let valueMin = 0, valueMax = 1;
  if (grid && grid.values.length > 0) {
    valueMin = Infinity;
    valueMax = -Infinity;
    for (const row of grid.values) {
      for (const v of row) {
        if (isFinite(v)) {
          valueMin = Math.min(valueMin, v);
          valueMax = Math.max(valueMax, v);
        }
      }
    }
    if (!isFinite(valueMin) || !isFinite(valueMax)) {
      valueMin = 0; valueMax = 1;
    }
    if (valueMin === valueMax) {
      valueMax = valueMin + 1;
    }
  }

  return (
    <div className="p-6 h-full flex flex-col gap-5 fade-in-stagger">
      <ChartCard className="flex-shrink-0">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 items-end">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-ocean-200/50">
              <Waves className="w-3.5 h-3.5" />
              参数选择
            </div>
            <div className="flex rounded-xl bg-white/[0.04] border border-white/[0.08] p-1">
              {(Object.keys(paramConfig) as Parameter[]).map((key) => {
                const opt = paramConfig[key];
                const OptIcon = opt.icon;
                const active = parameter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setParameter(key)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                      active
                        ? 'bg-marine-cyan/20 text-marine-cyan border border-marine-cyan/30'
                        : 'text-ocean-200/60 hover:text-ocean-100'
                    )}
                  >
                    <OptIcon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-ocean-200/50">
                <Layers className="w-3.5 h-3.5" />
                深度层
              </div>
              <span className="text-xs font-mono text-marine-cyan font-semibold">{depthLevel}m</span>
            </div>
            <div className="px-2">
              <input
                type="range"
                min={0}
                max={1500}
                step={5}
                value={depthLevel}
                onChange={(e) => setDepthLevel(+e.target.value)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer
                          bg-white/[0.08] accent-marine-cyan"
              />
              <div className="flex justify-between mt-1 text-[9px] font-mono text-ocean-200/40">
                {depthMarks.map(m => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-ocean-200/50">
              <Settings2 className="w-3.5 h-3.5" />
              插值算法
            </div>
            <div className="flex rounded-xl bg-white/[0.04] border border-white/[0.08] p-1">
              {(['kriging', 'idw'] as const).map((algo) => {
                const active = algorithm === algo;
                return (
                  <button
                    key={algo}
                    onClick={() => setAlgorithm(algo)}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                      active
                        ? 'bg-marine-teal/20 text-marine-teal border border-marine-teal/30'
                        : 'text-ocean-200/60 hover:text-ocean-100'
                    )}
                  >
                    {algo === 'kriging' ? 'Kriging' : 'IDW'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-ocean-200/50">
                <ParamIcon className="w-3.5 h-3.5" />
                等值线间距 ({cfg.unit})
              </div>
            </div>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={contourStep}
              onChange={(e) => setContourStep(+e.target.value)}
              className="input-field text-sm font-mono"
              placeholder="输入间距"
            />
          </div>
        </div>
      </ChartCard>

      <div className="grid grid-cols-4 gap-5 flex-1 min-h-0">
        <div className="col-span-3 min-h-0">
          <ChartCard
            title={`${cfg.label}水平面分布图 · ${depthLevel}m层`}
            subtitle={`${algorithm === 'kriging' ? '克里金插值' : 'IDW反距离加权'} · 等值线叠加`}
            actions={
              <div className="flex items-center gap-3">
                <ColorLegend
                  min={valueMin}
                  max={valueMax}
                  scale={legendScale}
                  title={cfg.label}
                  unit={parameter === 'density' ? 'σt' : cfg.unit}
                />
              </div>
            }
            className="h-full"
          >
            <div className="w-full h-full flex items-center justify-center">
              <ChartCanvas
                stations={selectedStations}
                parameter={parameter}
                depthLevel={depthLevel}
                algorithm={algorithm}
                contourStep={contourStep}
                width={760}
                height={560}
              />
            </div>
          </ChartCard>
        </div>

        <div className="col-span-1 min-h-0 flex flex-col gap-5">
          <ChartCard
            title="观测站点选择"
            subtitle="点击切换显示站点"
            className="flex-1 min-h-0"
          >
            <StationSelector />
          </ChartCard>

          <div className="grid grid-cols-2 gap-4 flex-shrink-0">
            <ChartCard className="items-center justify-center flex flex-col py-4">
              <div className="text-[10px] text-ocean-200/50 mb-2 flex items-center gap-1">
                <Compass className="w-3 h-3" />
                指北针
              </div>
              <CompassRose />
            </ChartCard>
            <ChartCard className="items-center justify-center flex flex-col py-4">
              <div className="text-[10px] text-ocean-200/50 mb-2 flex items-center gap-1">
                <Ruler className="w-3 h-3" />
                比例尺
              </div>
              <ScaleBar />
            </ChartCard>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HorizontalMapPage;
