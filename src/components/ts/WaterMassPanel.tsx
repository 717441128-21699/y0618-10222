import React from 'react';
import type { WaterMass } from '@/types/oceanography';
import { waterMassBorderPalette } from '@/utils/colorScales';

interface WaterMassPanelProps {
  waterMasses: WaterMass[];
  totalPoints?: number;
}

export const WaterMassPanel: React.FC<WaterMassPanelProps> = ({
  waterMasses,
  totalPoints,
}) => {
  const total = totalPoints ?? waterMasses.reduce((sum, wm) => sum + wm.pointCount, 0);

  if (waterMasses.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-ocean-200/50 text-sm">
        暂无水团数据，请先加载站点并执行聚类分析
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div className="text-xs text-ocean-200/50 font-medium">
          共识别 <span className="text-ocean-100 font-semibold">{waterMasses.length}</span> 个水团
          {total > 0 && (
            <span className="text-ocean-200/40 ml-2">
              (样本 {total.toLocaleString()})
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {waterMasses.map((wm, idx) => {
          const borderColor = waterMassBorderPalette[idx % waterMassBorderPalette.length];
          const solidFill = wm.color.replace(/[\d.]+\)$/, '0.18)');
          const percent = total > 0 ? (wm.pointCount / total) * 100 : 0;

          return (
            <div
              key={wm.id}
              className="rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.01]"
              style={{
                background: `linear-gradient(135deg, ${solidFill} 0%, rgba(255,255,255,0.02) 100%)`,
                border: `1px solid ${borderColor}33`,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-lg"
                  style={{ background: borderColor }}
                >
                  {wm.clusterIndex + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-ocean-50 truncate">
                        {wm.name}
                      </h4>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-md font-mono"
                        style={{ background: `${borderColor}22`, color: borderColor }}
                      >
                        {(percent).toFixed(1)}%
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-ocean-200/50 flex-shrink-0 ml-2">
                      n={wm.pointCount.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-ocean-800/60 text-ocean-200/70 border border-white/[0.04]">
                      <span style={{ color: '#F46036' }}>T</span>
                      <span className="font-mono">
                        {wm.tempRange[0].toFixed(1)}~{wm.tempRange[1].toFixed(1)}°C
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-ocean-800/60 text-ocean-200/70 border border-white/[0.04]">
                      <span style={{ color: '#3E92CC' }}>S</span>
                      <span className="font-mono">
                        {wm.salRange[0].toFixed(1)}~{wm.salRange[1].toFixed(1)}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-ocean-800/60 text-ocean-200/70 border border-white/[0.04]">
                      <span style={{ color: '#B8E186' }}>σt</span>
                      <span className="font-mono">
                        {(wm.densityRange[0] - 1000).toFixed(1)}~{(wm.densityRange[1] - 1000).toFixed(1)}
                      </span>
                    </span>
                  </div>

                  <div className="relative w-full h-2 bg-ocean-900/80 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${percent}%`,
                        background: `linear-gradient(90deg, ${borderColor}99, ${borderColor})`,
                      }}
                    />
                    <div className="absolute inset-0 pointer-events-none">
                      {[0.25, 0.5, 0.75].map((t, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 w-px bg-white/[0.06]"
                          style={{ left: `${t * 100}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
