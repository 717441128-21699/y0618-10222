import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { Station } from '@/types/oceanography';
import { stationColorPalette } from '@/utils/colorScales';
import { Thermometer, Droplets, Waves, Gauge } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type ProfileParameter = 'temperature' | 'salinity' | 'density' | 'soundSpeed';

interface ProfileChartProps {
  stations: Station[];
  selectedStationIds?: string[];
  width?: number;
  height?: number;
}

const PARAM_CONFIG: Record<ProfileParameter, {
  label: string;
  unit: string;
  color: string;
  icon: React.ReactNode;
  getValue: (d: any) => number | undefined;
}> = {
  temperature: {
    label: '温度',
    unit: '°C',
    color: '#F46036',
    icon: <Thermometer className="w-3.5 h-3.5" />,
    getValue: (d) => d.temperature,
  },
  salinity: {
    label: '盐度',
    unit: 'PSU',
    color: '#3E92CC',
    icon: <Droplets className="w-3.5 h-3.5" />,
    getValue: (d) => d.salinity,
  },
  density: {
    label: 'σt 密度',
    unit: 'kg/m³',
    color: '#B8E186',
    icon: <Waves className="w-3.5 h-3.5" />,
    getValue: (d) => d.density - 1000,
  },
  soundSpeed: {
    label: '声速',
    unit: 'm/s',
    color: '#F4D35E',
    icon: <Gauge className="w-3.5 h-3.5" />,
    getValue: (d) => d.soundSpeed,
  },
};

export const ProfileChart: React.FC<ProfileChartProps> = ({
  stations,
  selectedStationIds,
  width = 820,
  height = 640,
}) => {
  const [parameter, setParameter] = React.useState<ProfileParameter>('temperature');

  const activeStations = React.useMemo(() => {
    if (!selectedStationIds || selectedStationIds.length === 0) return stations;
    return stations.filter(s => selectedStationIds.includes(s.id));
  }, [stations, selectedStationIds]);

  const maxDepth = React.useMemo(() => {
    let max = 0;
    for (const s of activeStations) {
      for (const d of s.data) {
        max = Math.max(max, d.depth);
      }
    }
    return Math.ceil(max / 10) * 10 || 100;
  }, [activeStations]);

  const chartData = React.useMemo(() => {
    const cfg = PARAM_CONFIG[parameter];
    const datasets = activeStations.map((station, idx) => {
      const color = station.color || stationColorPalette[idx % stationColorPalette.length];
      const sorted = [...station.data].sort((a, b) => a.depth - b.depth);
      const values: { x: number; y: number }[] = [];
      for (const p of sorted) {
        const v = cfg.getValue(p);
        if (v !== undefined && v !== null && !isNaN(v)) {
          values.push({ x: v, y: p.depth });
        }
      }
      return {
        label: station.name,
        data: values,
        borderColor: color,
        backgroundColor: `${color}18`,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: 'white',
        pointHoverBorderWidth: 1.5,
        tension: 0.25,
        fill: false,
      };
    });
    return { datasets };
  }, [activeStations, parameter]);

  const options = React.useMemo((): ChartOptions<'line'> => {
    const cfg = PARAM_CONFIG[parameter];
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      interaction: {
        mode: 'nearest',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top' as const,
          align: 'end' as const,
          labels: {
            color: 'rgba(230, 240, 255, 0.75)',
            font: { size: 11, family: "'Inter', sans-serif" },
            boxWidth: 14,
            boxHeight: 14,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(10, 20, 40, 0.92)',
          titleColor: '#e6f0ff',
          bodyColor: 'rgba(230, 240, 255, 0.85)',
          borderColor: 'rgba(62, 146, 204, 0.3)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { size: 12, weight: 'bold' as const },
          bodyFont: { size: 11, family: "'Source Code Pro', monospace" },
          displayColors: true,
          callbacks: {
            title: (items) => items[0]?.dataset.label || '',
            label: (item) => {
              const val = (item.parsed as { x: number; y: number });
              return [
                `${cfg.label}: ${val.x.toFixed(2)} ${cfg.unit}`,
                `深度: ${val.y.toFixed(0)} m`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear' as const,
          position: 'top' as const,
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawTicks: false,
          },
          border: {
            color: 'rgba(255, 255, 255, 0.15)',
          },
          ticks: {
            color: 'rgba(230, 240, 255, 0.55)',
            font: { size: 10, family: "'Source Code Pro', monospace" },
            padding: 8,
            callback: (v) => Number(v).toFixed(1),
          },
          title: {
            display: true,
            text: `${cfg.label} (${cfg.unit})`,
            color: 'rgba(230, 240, 255, 0.85)',
            font: { size: 12, weight: 'normal' as const },
            padding: { top: 4, bottom: 10 },
          },
        },
        y: {
          type: 'linear' as const,
          reverse: true,
          min: 0,
          max: maxDepth,
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawTicks: false,
          },
          border: {
            color: 'rgba(255, 255, 255, 0.15)',
          },
          ticks: {
            color: 'rgba(230, 240, 255, 0.55)',
            font: { size: 10, family: "'Source Code Pro', monospace" },
            padding: 8,
            callback: (v) => `${v} m`,
          },
          title: {
            display: true,
            text: '深度 Depth (m)',
            color: 'rgba(230, 240, 255, 0.85)',
            font: { size: 12, weight: 'normal' as const },
            padding: { top: 4, bottom: 10 },
          },
        },
      },
    };
  }, [parameter, maxDepth]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center gap-1.5 mb-3">
        {(Object.keys(PARAM_CONFIG) as ProfileParameter[]).map((p) => {
          const cfg = PARAM_CONFIG[p];
          const isActive = parameter === p;
          return (
            <button
              key={p}
              onClick={() => setParameter(p)}
              className={`
                flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                transition-all duration-200
                ${isActive
                  ? 'bg-white/[0.08] text-white shadow-sm'
                  : 'text-ocean-200/55 hover:text-ocean-100 hover:bg-white/[0.04]'
                }
              `}
              style={isActive ? { borderBottom: `2px solid ${cfg.color}` } : undefined}
            >
              <span style={{ color: isActive ? cfg.color : undefined }}>{cfg.icon}</span>
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0" style={{ width: '100%' }}>
        {activeStations.length > 0 ? (
          <Line data={chartData} options={options} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ocean-200/50 text-sm">
            请选择至少一个站点以绘制深度剖面
          </div>
        )}
      </div>
    </div>
  );
};
