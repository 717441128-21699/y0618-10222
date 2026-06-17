import React from 'react';
import * as d3 from 'd3';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useDataStore } from '@/store/dataStore';
import { ChartCard } from '@/components/layout/ChartCard';
import { useRoseDiagram, aggregateTidalTimeSeries, type TimeRange } from '@/hooks/useRoseDiagram';
import { Wind, Gauge, Navigation, CalendarRange, TrendingUp, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface TidalTimeSeriesProps {
  timeRange: TimeRange;
  width?: number;
  height?: number;
}

const TidalTimeSeries: React.FC<TidalTimeSeriesProps> = ({
  timeRange,
  width = 700,
  height = 480,
}) => {
  const { tidalData } = useDataStore();
  const series = aggregateTidalTimeSeries(tidalData, timeRange, 150);

  const chartHeight = height - 90;

  const labels = series.map(d => {
    const dt = d.time;
    const h = dt.getHours().toString().padStart(2, '0');
    const m = dt.getMinutes().toString().padStart(2, '0');
    if (timeRange === 'day') return `${h}:${m}`;
    if (timeRange === 'week') return `${dt.getMonth() + 1}/${dt.getDate()} ${h}:00`;
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  });

  const maxSpeed = Math.max(...series.map(d => d.speed), 1);

  const data = {
    labels,
    datasets: [
      {
        label: '流速 (cm/s)',
        data: series.map(d => +d.speed.toFixed(2)),
        borderColor: '#3E92CC',
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 280);
          gradient.addColorStop(0, 'rgba(62,146,204,0.45)');
          gradient.addColorStop(1, 'rgba(62,146,204,0.02)');
          return gradient;
        },
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#3E92CC',
        pointHoverBorderColor: 'white',
        pointHoverBorderWidth: 1.5,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(5,20,41,0.95)',
        borderColor: 'rgba(62,146,204,0.35)',
        borderWidth: 1,
        titleColor: '#E6F0FF',
        bodyColor: '#C2D9FF',
        padding: 10,
        cornerRadius: 6,
        displayColors: false,
        titleFont: { size: 12 },
        bodyFont: { size: 12, family: "'Source Code Pro', monospace" },
        callbacks: {
          title: (items: any[]) => items[0]?.label || '',
          label: (item: any) => {
            const idx = item.dataIndex;
            const d = series[idx];
            if (!d) return '';
            const dir = d.direction.toFixed(0);
            const dirNames = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
              'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
            const dirName = dirNames[Math.round(d.direction / 22.5) % 16];
            return [
              `流速: ${d.speed.toFixed(1)} cm/s`,
              `流向: ${dir}° (${dirName})`,
              `U: ${d.u.toFixed(1)}  V: ${d.v.toFixed(1)}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
        ticks: {
          color: 'rgba(230,240,255,0.5)',
          font: { size: 10, family: "'Source Code Pro', monospace" },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 10,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255,255,255,0.08)', drawBorder: false },
        ticks: {
          color: 'rgba(230,240,255,0.55)',
          font: { size: 10, family: "'Source Code Pro', monospace" },
          callback: (v: any) => `${v} cm/s`,
        },
        title: {
          display: true,
          text: '流速  Speed',
          color: 'rgba(230,240,255,0.75)',
          font: { size: 11, weight: '500' as const },
          padding: { bottom: 8 },
        },
      },
    },
  };

  const arrowStep = Math.max(1, Math.floor(series.length / 24));

  return (
    <div className="w-full flex flex-col" style={{ height }}>
      <div style={{ height: chartHeight }}>
        <Line data={data} options={options as any} />
      </div>
      <div className="mt-2 px-6 border-t border-white/[0.05] pt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-ocean-200/40 flex items-center gap-1.5">
            <Navigation className="w-3 h-3" />
            流向指示（箭头长度=相对流速）
          </span>
        </div>
        <div className="relative h-12 overflow-hidden">
          <svg
            viewBox={`0 0 ${width} 48`}
            className="w-full h-full"
            preserveAspectRatio="none"
          >
            {series.map((d, i) => {
              if (i % arrowStep !== 0) return null;
              const x = (i / (series.length - 1)) * (width - 16) + 8;
              const cy = 24;
              const len = 6 + (d.speed / maxSpeed) * 14;
              const rad = d.direction * Math.PI / 180;
              const ex = x + Math.sin(rad) * len;
              const ey = cy - Math.cos(rad) * len;
              const ang = d.direction;
              const color = d.speed > maxSpeed * 0.65
                ? '#F46036'
                : d.speed > maxSpeed * 0.35
                ? '#F4D35E'
                : '#3E92CC';
              return (
                <g key={i} transform={`translate(${x},${cy}) rotate(${ang})`}>
                  <line
                    x1={0} y1={0}
                    x2={len} y2={0}
                    stroke={color} strokeWidth={1.8}
                    strokeLinecap="round"
                    opacity={0.85}
                  />
                  <polygon
                    points={`${len + 1},0 ${len - 4},-3.5 ${len - 4},3.5`}
                    fill={color}
                    opacity={0.9}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};

interface RoseDiagramProps {
  timeRange: TimeRange;
  width?: number;
  height?: number;
}

const RoseDiagram: React.FC<RoseDiagramProps> = ({
  timeRange,
  width = 440,
  height = 440,
}) => {
  const { tidalData } = useDataStore();
  const svgRef = React.useRef<SVGSVGElement>(null);
  const { sectors, maxFrequency, avgSpeed, maxSpeed, dominantDirection, totalRecords } = useRoseDiagram(tidalData, timeRange);

  React.useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const cx = width / 2;
    const cy = height / 2;
    const rMin = 35;
    const rMax = Math.min(width, height) / 2 - 50;

    const angScale = d3.scaleLinear().domain([0, 16]).range([-Math.PI / 2, -Math.PI / 2 + Math.PI * 2]);
    const rScale = d3.scaleLinear().domain([0, Math.max(maxFrequency * 1.1, 5)]).range([rMin, rMax]);

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    for (let i = 1; i <= 4; i++) {
      const r = rMin + (rMax - rMin) * (i / 4);
      g.append('circle')
        .attr('cx', 0).attr('cy', 0).attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.08)')
        .attr('stroke-width', 1);
      g.append('text')
        .attr('x', 4).attr('y', -r + 3)
        .attr('fill', 'rgba(230,240,255,0.35)')
        .style('font-size', 9)
        .style('font-family', "'Source Code Pro', monospace")
        .text(`${(maxFrequency * i / 4).toFixed(0)}%`);
    }

    for (let i = 0; i < 16; i++) {
      const ang = angScale(i);
      g.append('line')
        .attr('x1', Math.cos(ang) * rMin).attr('y1', Math.sin(ang) * rMin)
        .attr('x2', Math.cos(ang) * rMax).attr('y2', Math.sin(ang) * rMax)
        .attr('stroke', 'rgba(255,255,255,0.06)')
        .attr('stroke-width', 1);
      if (i % 2 === 0) {
        const lr = rMax + 18;
        const lx = Math.cos(ang) * lr;
        const ly = Math.sin(ang) * lr;
        g.append('text')
          .attr('x', lx).attr('y', ly + 3)
          .attr('text-anchor', 'middle')
          .attr('fill', sectors[i]?.directionLabel === dominantDirection
            ? '#F46036' : 'rgba(230,240,255,0.7)')
          .style('font-size', 10)
          .style('font-weight', sectors[i]?.directionLabel === dominantDirection ? 700 : 500)
          .text(sectors[i]?.directionLabel || '');
      }
    }

    const speedColor = d3.scaleLinear<string, string>()
      .domain([0, (maxSpeed || 1) / 2, maxSpeed || 1])
      .range(['#3E92CC', '#F4D35E', '#F46036']);

    const arcGen = d3.arc<any>()
      .innerRadius((_, i) => rMin)
      .outerRadius(d => rScale(d.frequency))
      .startAngle((_, i) => angScale(i) - Math.PI / 16)
      .endAngle((_, i) => angScale(i) + Math.PI / 16)
      .cornerRadius(3);

    const arcs = g.selectAll('path.sector')
      .data(sectors)
      .join('path')
      .attr('class', 'sector')
      .attr('d', (d, i) => arcGen(d, i) as string)
      .attr('fill', d => speedColor(d.avgSpeed))
      .attr('fill-opacity', d => 0.55 + (d.frequency / Math.max(maxFrequency, 1)) * 0.35)
      .attr('stroke', d => speedColor(d.avgSpeed))
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.7)
      .style('cursor', 'pointer');

    const tooltip = g.append('g').style('pointer-events', 'none');
    arcs.on('mouseenter', function (event, d) {
          d3.select(this).attr('fill-opacity', 0.9).attr('stroke-width', 2);
          const rMid = rScale(d.frequency) * 0.7;
          const idx = sectors.indexOf(d);
          const ang = angScale(idx);
          const tx = Math.cos(ang) * rMid;
          const ty = Math.sin(ang) * rMid - 25;
          const lines = [
            `${d.directionLabel} (${d.direction}°)`,
            `频率: ${d.frequency.toFixed(1)}% (${d.count}次)`,
            `平均流速: ${d.avgSpeed.toFixed(1)} cm/s`,
          ];
          const boxW = 130;
          const boxH = lines.length * 14 + 10;
          tooltip.selectAll('*').remove();
          tooltip.append('rect')
            .attr('x', tx - boxW / 2).attr('y', ty - boxH / 2)
            .attr('width', boxW).attr('height', boxH)
            .attr('rx', 5)
            .attr('fill', 'rgba(5,20,41,0.95)')
            .attr('stroke', speedColor(d.avgSpeed))
            .attr('stroke-opacity', 0.5);
          lines.forEach((line, k) => {
            tooltip.append('text')
              .attr('x', tx).attr('y', ty - boxH / 2 + 15 + k * 14)
              .attr('text-anchor', 'middle')
              .attr('fill', k === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(230,240,255,0.7)')
              .style('font-size', 10)
              .style('font-family', k > 0 ? "'Source Code Pro', monospace" : 'inherit')
              .style('font-weight', k === 0 ? 600 : 400)
              .text(line);
          });
        })
        .on('mouseleave', function () {
          d3.select(this)
            .attr('fill-opacity', d => 0.55 + ((d as any).frequency / Math.max(maxFrequency, 1)) * 0.35)
            .attr('stroke-width', 1);
          tooltip.selectAll('*').remove();
        });

    g.append('circle')
      .attr('cx', 0).attr('cy', 0).attr('r', rMin - 3)
      .attr('fill', 'rgba(5,20,41,0.8)')
      .attr('stroke', 'rgba(62,146,204,0.2)');

    const legendG = svg.append('g').attr('transform', `translate(${width - 85},${height - 70})`);
    for (let k = 0; k < 4; k++) {
      const t = k / 3;
      legendG.append('rect')
        .attr('x', 0).attr('y', k * 14)
        .attr('width', 18).attr('height', 10)
        .attr('fill', speedColor(t * maxSpeed))
        .attr('rx', 2);
      legendG.append('text')
        .attr('x', 24).attr('y', k * 14 + 8)
        .attr('fill', 'rgba(230,240,255,0.55)')
        .style('font-size', 9)
        .style('font-family', "'Source Code Pro', monospace")
        .text(`${(t * maxSpeed).toFixed(0)} cm/s`);
    }

  }, [sectors, maxFrequency, avgSpeed, maxSpeed, dominantDirection, totalRecords, width, height]);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg ref={svgRef} width={width} height={height} />
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  unit?: string;
  color: string;
  highlight?: boolean;
}> = ({ icon: Icon, label, value, unit, color, highlight }) => (
  <div className={cn(
    'glass-card p-4 flex items-center gap-4 transition-all',
    highlight && 'ring-1 ring-offset-0',
  )} style={highlight ? { boxShadow: `0 0 20px ${color}25`, borderColor: `${color}35` } : {}}>
    <div
      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: `${color}18`, border: `1px solid ${color}35` }}
    >
      <Icon className="w-5 h-5" style={{ color }} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[11px] text-ocean-200/55 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-semibold" style={{ color }}>{value}</span>
        {unit && <span className="text-xs text-ocean-200/50 font-mono">{unit}</span>}
      </div>
    </div>
  </div>
);

const TidalAnalysisPage: React.FC = () => {
  const { tidalData } = useDataStore();
  const [timeRange, setTimeRange] = React.useState<TimeRange>('week');
  const { avgSpeed, maxSpeed, dominantDirection, totalRecords } = useRoseDiagram(tidalData, timeRange);

  const rangeOptions: { value: TimeRange; label: string; desc: string }[] = [
    { value: 'day', label: '日', desc: '24小时' },
    { value: 'week', label: '周', desc: '7天' },
    { value: 'month', label: '月', desc: '30天' },
  ];

  return (
    <div className="p-6 h-full flex flex-col gap-5 fade-in-stagger">
      <ChartCard className="flex-shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-ocean-200/50">
              <CalendarRange className="w-3.5 h-3.5" />
              时间范围
            </div>
            <div className="flex rounded-xl bg-white/[0.04] border border-white/[0.08] p-1">
              {rangeOptions.map(opt => {
                const active = timeRange === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTimeRange(opt.value)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      active
                        ? 'bg-marine-cyan/20 text-marine-cyan border border-marine-cyan/30'
                        : 'text-ocean-200/60 hover:text-ocean-100'
                    )}
                  >
                    {opt.label}
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded font-mono',
                      active ? 'bg-white/10' : 'bg-white/[0.04] text-ocean-200/40'
                    )}>
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-ocean-200/50 font-mono">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-marine-teal opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-marine-teal" />
            </span>
            {totalRecords.toLocaleString()} 条观测记录
          </div>
        </div>
      </ChartCard>

      <div className="grid grid-cols-4 gap-4 flex-shrink-0">
        <StatCard
          icon={Gauge}
          label="平均流速"
          value={avgSpeed.toFixed(1)}
          unit="cm/s"
          color="#3E92CC"
        />
        <StatCard
          icon={Maximize2}
          label="最大流速"
          value={maxSpeed.toFixed(1)}
          unit="cm/s"
          color="#F46036"
          highlight
        />
        <StatCard
          icon={Navigation}
          label="优势流向"
          value={dominantDirection}
          unit=""
          color="#2FB6B0"
        />
        <StatCard
          icon={TrendingUp}
          label="潮流稳定性"
          value={avgSpeed > 0 ? Math.min(100, Math.round((maxSpeed / (avgSpeed * 2)) * 100)).toString() : '0'}
          unit="%"
          color="#F4D35E"
        />
      </div>

      <div className="grid grid-cols-3 gap-5 flex-1 min-h-0">
        <div className="col-span-2 min-h-0">
          <ChartCard
            title="流速时间序列"
            subtitle="观测站潮流流速变化 · 流向箭头指示"
            actions={
              <div className="flex items-center gap-2 text-[11px] text-ocean-200/50">
                <Wind className="w-3.5 h-3.5 text-marine-cyan" />
                Chart.js Line
              </div>
            }
            className="h-full"
          >
            <div className="w-full h-full">
              <TidalTimeSeries timeRange={timeRange} width={680} height={460} />
            </div>
          </ChartCard>
        </div>

        <div className="col-span-1 min-h-0">
          <ChartCard
            title="潮流玫瑰图"
            subtitle="各方向出现频率 · 颜色=平均流速"
            className="h-full"
          >
            <div className="w-full h-full">
              <RoseDiagram timeRange={timeRange} width={400} height={420} />
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  );
};

export default TidalAnalysisPage;
