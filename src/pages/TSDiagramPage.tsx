import React from 'react';
import { useDataStore } from '@/store/dataStore';
import { ChartCard } from '@/components/layout/ChartCard';
import { StationSelector } from '@/components/common/StationSelector';
import { TSScatterPlot } from '@/components/ts/TSScatterPlot';
import { useWaterMass } from '@/hooks/useWaterMass';
import { Layers, Palette, Droplets, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

type ColorByOption = 'density' | 'cluster' | 'station';

const colorByOptions: { value: ColorByOption; label: string; icon: React.ElementType }[] = [
  { value: 'density', label: '密度', icon: Droplets },
  { value: 'cluster', label: '聚类', icon: Hash },
  { value: 'station', label: '站点', icon: Palette },
];

const WaterMassPanel: React.FC = () => {
  const { stations, selectedStationIds } = useDataStore();
  const selectedStations = stations.filter(s => selectedStationIds.includes(s.id));
  const { waterMasses, totalPoints } = useWaterMass(selectedStations);

  if (waterMasses.length === 0) {
    return (
      <div className="glass-card p-4 text-center text-sm text-ocean-200/60">
        暂无水团数据，请选择至少3个站点
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-ocean-200/50 mb-1">
        <span className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-marine-teal" />
          识别水团
        </span>
        <span className="font-mono">{totalPoints.toLocaleString()} 数据点</span>
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin pr-1">
        {waterMasses.map((wm) => (
          <div
            key={wm.id}
            className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]
                       hover:bg-white/[0.05] transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white/20"
                style={{ backgroundColor: wm.color.replace(/[\d.]+\)$/, '1)') }}
              />
              <span className="text-sm font-medium text-ocean-50 flex-1 truncate">{wm.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] font-mono text-ocean-200/60">
                #{wm.clusterIndex + 1}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="flex items-center justify-between px-2 py-1 rounded bg-white/[0.02]">
                <span className="text-ocean-200/50">T范围</span>
                <span className="font-mono text-marine-coral">
                  {wm.tempRange[0].toFixed(1)}~{wm.tempRange[1].toFixed(1)}°
                </span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 rounded bg-white/[0.02]">
                <span className="text-ocean-200/50">S范围</span>
                <span className="font-mono text-marine-cyan">
                  {wm.salRange[0].toFixed(2)}~{wm.salRange[1].toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 rounded bg-white/[0.02] col-span-2">
                <span className="text-ocean-200/50">占比</span>
                <span className="font-mono text-marine-teal">
                  {((wm.pointCount / totalPoints) * 100).toFixed(1)}%
                  <span className="text-ocean-200/40 ml-1">({wm.pointCount})</span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TSDiagramPage: React.FC = () => {
  const { stations, selectedStationIds } = useDataStore();
  const [colorBy, setColorBy] = React.useState<ColorByOption>('density');

  const selectedStations = React.useMemo(
    () => stations.filter(s => selectedStationIds.includes(s.id)),
    [stations, selectedStationIds]
  );

  return (
    <div className="p-6 h-full">
      <div className="grid grid-cols-4 gap-5 h-full fade-in-stagger">
        <div className="col-span-3">
          <ChartCard
            title="T-S 温盐散点图"
            subtitle="等密度线叠加 · 水团团簇分析"
            actions={
              <div className="flex items-center gap-2">
                <span className="text-xs text-ocean-200/50 mr-1">着色:</span>
                <div className="flex rounded-lg bg-white/[0.04] border border-white/[0.08] p-0.5">
                  {colorByOptions.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setColorBy(opt.value)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                          colorBy === opt.value
                            ? 'bg-marine-cyan/20 text-marine-cyan border border-marine-cyan/30'
                            : 'text-ocean-200/60 hover:text-ocean-100 hover:bg-white/[0.04]'
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            }
            className="h-full"
          >
            <div className="w-full h-full flex items-center justify-center">
              <TSScatterPlot
                stations={selectedStations}
                colorBy={colorBy}
                width={780}
                height={600}
              />
            </div>
          </ChartCard>
        </div>

        <div className="col-span-1 flex flex-col gap-5 min-h-0">
          <ChartCard
            title="水团识别结果"
            subtitle="K-Means聚类 · 凸包边界"
            className="flex-shrink-0"
          >
            <WaterMassPanel />
          </ChartCard>

          <ChartCard
            title="观测站点选择"
            subtitle="点击切换显示的站点"
            className="flex-1 min-h-0"
          >
            <StationSelector />
          </ChartCard>
        </div>
      </div>
    </div>
  );
};

export default TSDiagramPage;
