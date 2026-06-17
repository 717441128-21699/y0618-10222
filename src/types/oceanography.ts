export interface CTDDataPoint {
  depth: number;
  temperature: number;
  salinity: number;
  density: number;
  soundSpeed?: number;
}

export interface Station {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  date: string;
  maxDepth: number;
  data: CTDDataPoint[];
  color: string;
}

export interface TidalRecord {
  time: string;
  speed: number;
  direction: number;
  uComponent: number;
  vComponent: number;
  waterLevel?: number;
}

export interface WaterMass {
  id: string;
  name: string;
  tempRange: [number, number];
  salRange: [number, number];
  densityRange: [number, number];
  centroid: { temp: number; sal: number };
  pointCount: number;
  color: string;
  clusterIndex: number;
}

export interface ContourLine {
  value: number;
  coordinates: [number, number][];
}

export interface InterpolationGrid {
  algorithm: 'kriging' | 'idw';
  parameter: 'temperature' | 'salinity' | 'density';
  depthLevel: number;
  xMin: number; xMax: number;
  yMin: number; yMax: number;
  nx: number; ny: number;
  values: number[][];
  contours: ContourLine[];
}

export interface RoseSector {
  direction: number;
  directionLabel: string;
  frequency: number;
  avgSpeed: number;
  count: number;
}

export interface SectionPoint {
  distance: number;
  depth: number;
  value: number;
}

export type ParameterType = 'temperature' | 'salinity' | 'density';

export interface ExportConfig {
  stations: boolean;
  contours: boolean;
  waterMasses: boolean;
  coordinateSystem: 'WGS84' | 'CGCS2000';
}

export interface KMeansResult {
  centroids: number[][];
  assignments: number[];
  k: number;
  inertia: number;
}
