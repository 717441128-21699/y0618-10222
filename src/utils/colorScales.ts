export type ColorScale = (t: number) => string;

const hexToRgb = (hex: string): [number, number, number] => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return `#${Math.round(Math.max(0, Math.min(255, r))).toString(16).padStart(2, '0')}${Math.round(Math.max(0, Math.min(255, g))).toString(16).padStart(2, '0')}${Math.round(Math.max(0, Math.min(255, b))).toString(16).padStart(2, '0')}`;
};

const interpolateColor = (c1: string, c2: string, t: number): string => {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return rgbToHex(
    r1 + (r2 - r1) * t,
    g1 + (g2 - g1) * t,
    b1 + (b2 - b1) * t
  );
};

const createMultiStopScale = (stops: [number, string][]): ColorScale => {
  return (t: number) => {
    const clamped = Math.max(0, Math.min(1, t));
    for (let i = 0; i < stops.length - 1; i++) {
      const [t1, c1] = stops[i];
      const [t2, c2] = stops[i + 1];
      if (clamped >= t1 && clamped <= t2) {
        const localT = (clamped - t1) / (t2 - t1);
        return interpolateColor(c1, c2, localT);
      }
    }
    return stops[stops.length - 1][1];
  };
};

export const oceanTemperatureScale: ColorScale = createMultiStopScale([
  [0.0, '#0A2463'],
  [0.15, '#1E4BA6'],
  [0.3, '#3E92CC'],
  [0.45, '#4ECDC4'],
  [0.6, '#B8E186'],
  [0.75, '#F4D35E'],
  [0.88, '#F46036'],
  [1.0, '#D62828'],
]);

export const oceanSalinityScale: ColorScale = createMultiStopScale([
  [0.0, '#F7FCF0'],
  [0.2, '#E0F3DB'],
  [0.4, '#CCEBC5'],
  [0.55, '#7BCCC4'],
  [0.7, '#2B8CBE'],
  [0.85, '#08589E'],
  [1.0, '#051429'],
]);

export const oceanDensityScale: ColorScale = createMultiStopScale([
  [0.0, '#FFF7FB'],
  [0.2, '#ECE7F2'],
  [0.4, '#A6BDDB'],
  [0.6, '#67A9CF'],
  [0.75, '#2B8CBE'],
  [0.9, '#0868AC'],
  [1.0, '#051429'],
]);

export const tidalCurrentScale: ColorScale = createMultiStopScale([
  [0.0, '#FFFFCC'],
  [0.2, '#C7E9B4'],
  [0.4, '#7FCDBB'],
  [0.6, '#41B6C4'],
  [0.75, '#1D91C0'],
  [0.9, '#225EA8'],
  [1.0, '#0C2C84'],
]);

export const roseDirectionScale: ColorScale = createMultiStopScale([
  [0.0, '#4ECDC4'],
  [0.33, '#F4D35E'],
  [0.66, '#F46036'],
  [1.0, '#D62828'],
]);

export const getParameterScale = (param: string): ColorScale => {
  switch (param) {
    case 'temperature': return oceanTemperatureScale;
    case 'salinity': return oceanSalinityScale;
    case 'density': return oceanDensityScale;
    default: return oceanTemperatureScale;
  }
};

export interface LegendStop {
  value: number;
  label: string;
  color: string;
}

export const generateLegendStops = (
  min: number, max: number,
  scale: ColorScale,
  steps: number = 6
): LegendStop[] => {
  const stops: LegendStop[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const value = min + (max - min) * t;
    stops.push({
      value,
      label: value.toFixed(1),
      color: scale(t),
    });
  }
  return stops;
};

export const stationColorPalette = [
  '#3E92CC',
  '#F46036',
  '#2FB6B0',
  '#F4D35E',
  '#8B5CF6',
  '#EF4444',
  '#10B981',
  '#EC4899',
  '#6366F1',
  '#F59E0B',
];

export const waterMassColorPalette = [
  'rgba(62, 146, 204, 0.35)',
  'rgba(244, 96, 54, 0.35)',
  'rgba(47, 182, 176, 0.35)',
  'rgba(244, 211, 94, 0.35)',
  'rgba(139, 92, 246, 0.35)',
  'rgba(79, 70, 229, 0.35)',
];

export const waterMassBorderPalette = [
  '#3E92CC',
  '#F46036',
  '#2FB6B0',
  '#F4D35E',
  '#8B5CF6',
  '#4F46E5',
];
