import { create } from 'zustand';
import type { Station, TidalRecord, ExportConfig } from '@/types/oceanography';
import { generateStations, generateTidalData } from '@/utils/mockData';

interface DataState {
  stations: Station[];
  tidalData: TidalRecord[];
  selectedStationIds: string[];
  activeTab: string;
  exportConfig: ExportConfig;
  dataLoaded: boolean;

  addStation: (s: Station) => void;
  removeStation: (id: string) => void;
  setSelectedStations: (ids: string[]) => void;
  toggleStationSelection: (id: string) => void;
  importStations: (stations: Station[]) => void;
  importTidalData: (data: TidalRecord[]) => void;
  loadDemoData: () => void;
  setActiveTab: (tab: string) => void;
  setExportConfig: (config: Partial<ExportConfig>) => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  stations: [],
  tidalData: [],
  selectedStationIds: [],
  activeTab: 'ts-diagram',
  exportConfig: {
    stations: true,
    contours: true,
    waterMasses: true,
    coordinateSystem: 'WGS84',
  },
  dataLoaded: false,

  addStation: (s) => set((state) => ({
    stations: [...state.stations, s],
    selectedStationIds: state.selectedStationIds.length === 0
      ? [s.id]
      : state.selectedStationIds,
  })),

  removeStation: (id) => set((state) => ({
    stations: state.stations.filter(s => s.id !== id),
    selectedStationIds: state.selectedStationIds.filter(sid => sid !== id),
  })),

  setSelectedStations: (ids) => set({ selectedStationIds: ids }),

  toggleStationSelection: (id) => set((state) => {
    const exists = state.selectedStationIds.includes(id);
    return {
      selectedStationIds: exists
        ? state.selectedStationIds.filter(sid => sid !== id)
        : [...state.selectedStationIds, id],
    };
  }),

  importStations: (stations) => set((state) => ({
    stations: [...state.stations, ...stations],
    selectedStationIds: state.selectedStationIds.length === 0
      ? stations.slice(0, Math.min(4, stations.length)).map(s => s.id)
      : state.selectedStationIds,
    dataLoaded: true,
  })),

  importTidalData: (data) => set({ tidalData: data, dataLoaded: true }),

  loadDemoData: () => {
    const stations = generateStations();
    const tidal = generateTidalData();
    set({
      stations,
      tidalData: tidal,
      selectedStationIds: stations.slice(0, 6).map(s => s.id),
      dataLoaded: true,
    });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setExportConfig: (config) => set((state) => ({
    exportConfig: { ...state.exportConfig, ...config },
  })),
}));
