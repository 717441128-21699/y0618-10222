import React from 'react';
import { useDataStore } from '@/store/dataStore';
import { MapPin, Eye, EyeOff, Thermometer, Gauge } from 'lucide-react';

interface StationSelectorProps {
  compact?: boolean;
  showAllToggle?: boolean;
  onChange?: () => void;
}

export const StationSelector: React.FC<StationSelectorProps> = ({
  compact = false,
  showAllToggle = true,
}) => {
  const { stations, selectedStationIds, toggleStationSelection, setSelectedStations } = useDataStore();

  const allSelected = stations.length > 0 && selectedStationIds.length === stations.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedStations([]);
    } else {
      setSelectedStations(stations.map(s => s.id));
    }
  };

  if (stations.length === 0) {
    return (
      <div className="glass-card p-4 text-center text-sm text-ocean-200/60">
        暂无数据，请导入观测数据或加载演示数据
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showAllToggle && !compact && (
        <button
          onClick={toggleAll}
          className="w-full px-3 py-2 text-xs font-medium rounded-lg
                     bg-white/[0.04] border border-white/[0.08]
                     text-ocean-100 hover:bg-marine-cyan/15 hover:border-marine-cyan/30
                     hover:text-marine-cyan transition-all flex items-center justify-center gap-2"
        >
          {allSelected ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {allSelected ? '取消全选' : '全选站点'}
          <span className="ml-1 px-1.5 py-0.5 rounded bg-white/[0.08] text-[10px] font-mono">
            {selectedStationIds.length}/{stations.length}
          </span>
        </button>
      )}

      <div className={`space-y-1.5 ${compact ? '' : 'max-h-72 overflow-y-auto scrollbar-thin pr-1'}`}>
        {stations.map((station) => {
          const selected = selectedStationIds.includes(station.id);
          return (
            <button
              key={station.id}
              onClick={() => toggleStationSelection(station.id)}
              className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all text-left
                         ${selected
                           ? 'bg-white/[0.08] border border-white/[0.1]'
                           : 'hover:bg-white/[0.04] border border-transparent'}
                         `}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 transition-all
                           ${selected ? 'ring-opacity-50' : 'ring-transparent opacity-40'}`}
                style={{
                  backgroundColor: station.color,
                  boxShadow: selected ? `0 0 8px ${station.color}80` : 'none',
                  // @ts-expect-error - ringColor custom
                  '--tw-ring-color': station.color,
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-medium truncate
                                   ${selected ? 'text-ocean-50' : 'text-ocean-200/60'}`}>
                    {station.name}
                  </span>
                  <span className="text-[10px] font-mono text-ocean-200/40 flex-shrink-0">
                    {station.maxDepth}m
                  </span>
                </div>
                {!compact && (
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-ocean-200/40">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="font-mono truncate">
                      {station.longitude.toFixed(2)}°E, {station.latitude.toFixed(2)}°N
                    </span>
                  </div>
                )}
              </div>
              {selected && (
                <div className="w-1.5 h-1.5 rounded-full bg-marine-teal animate-pulse flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {!compact && (
        <div className="pt-2 border-t border-white/[0.06] grid grid-cols-2 gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-white/[0.03]">
            <Thermometer className="w-3 h-3 text-marine-coral" />
            <span className="text-ocean-200/50">剖面</span>
            <span className="ml-auto font-mono text-ocean-100">
              {stations.reduce((s, x) => s + x.data.length, 0)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-white/[0.03]">
            <Gauge className="w-3 h-3 text-marine-cyan" />
            <span className="text-ocean-200/50">最深</span>
            <span className="ml-auto font-mono text-ocean-100">
              {Math.max(...stations.map(s => s.maxDepth))}m
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
