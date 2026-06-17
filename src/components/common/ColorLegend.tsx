import React from 'react';
import type { ColorScale, LegendStop } from '@/utils/colorScales';
import { generateLegendStops } from '@/utils/colorScales';

interface ColorLegendProps {
  min: number;
  max: number;
  scale: ColorScale;
  title?: string;
  unit?: string;
  orientation?: 'vertical' | 'horizontal';
  steps?: number;
  className?: string;
}

export const ColorLegend: React.FC<ColorLegendProps> = ({
  min,
  max,
  scale,
  title,
  unit,
  orientation = 'vertical',
  steps = 6,
  className = '',
}) => {
  const stops = React.useMemo(
    () => generateLegendStops(min, max, scale, steps),
    [min, max, scale, steps]
  );

  if (orientation === 'horizontal') {
    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {title && (
          <div className="text-[11px] text-ocean-200/60 font-medium flex items-center gap-1">
            {title}
            {unit && <span className="text-ocean-200/40">({unit})</span>}
          </div>
        )}
        <div className="h-5 rounded-md overflow-hidden relative" style={{
          background: `linear-gradient(to right, ${stops.map(s => s.color).join(', ')})`,
        }} />
        <div className="flex justify-between text-[10px] font-mono text-ocean-200/50">
          {stops.filter((_, i) => i % Math.ceil(steps / 5) === 0 || i === stops.length - 1)
            .map((s, i) => (
              <span key={i}>{s.label}</span>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${className}`}>
      <div className="flex flex-col items-center">
        <div
          className="w-5 rounded-md overflow-hidden"
          style={{
            height: orientation === 'vertical' ? 200 : 24,
            background: `linear-gradient(to top, ${stops.map(s => s.color).join(', ')})`,
          }}
        />
      </div>
      <div className="flex flex-col">
        {title && (
          <div className="text-[11px] text-ocean-200/70 font-medium mb-1.5 flex items-center gap-1">
            {title}
            {unit && <span className="text-ocean-200/40">({unit})</span>}
          </div>
        )}
        <div className="flex flex-col justify-between flex-1 py-0.5">
          {stops.slice().reverse().map((s, i) => (
            <div key={i} className="text-[10px] font-mono text-ocean-200/55 leading-none py-[3px]">
              {s.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export { type LegendStop };
