import Papa from 'papaparse';
import type { Station, CTDDataPoint, TidalRecord } from '@/types/oceanography';
import { stationColorPalette } from '@/utils/colorScales';

const safeNumber = (val: unknown, fallback: number = 0): number => {
  if (typeof val === 'number') return val;
  const n = parseFloat(String(val ?? ''));
  return isNaN(n) ? fallback : n;
};

export const parseCTDCSV = async (file: File): Promise<Station[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        try {
          const rows = results.data;
          if (rows.length === 0) {
            resolve([]);
            return;
          }

          const stationGroups = new Map<string, {
            name: string;
            lon: number;
            lat: number;
            date: string;
            data: CTDDataPoint[];
          }>();

          for (const row of rows) {
            const stationId = String(row.station_id || row.Station || row.station || 'ST01');
            const stationName = String(row.station_name || stationId);

            if (!stationGroups.has(stationId)) {
              stationGroups.set(stationId, {
                name: stationName,
                lon: safeNumber(row.longitude || row.lon || row.Lon, 121.5),
                lat: safeNumber(row.latitude || row.lat || row.Lat, 29.5),
                date: String(row.date || row.Date || '2025-06-01'),
                data: [],
              });
            }

            const group = stationGroups.get(stationId)!;
            const depth = safeNumber(row.depth || row.Depth || row.Pressure, 0);
            const temp = safeNumber(row.temperature || row.Temperature || row.T, 20);
            const sal = safeNumber(row.salinity || row.Salinity || row.S, 34);
            const sigmaT = safeNumber(row.density || row.Density || row.SigmaT || row.sigma_t, 1024);

            group.data.push({
              depth,
              temperature: temp,
              salinity: sal,
              density: sigmaT > 50 ? sigmaT : sigmaT + 1000,
              soundSpeed: safeNumber(row.sound_speed || row.SV || undefined as unknown as number, 1500),
            });
          }

          const stations: Station[] = [];
          let colorIdx = 0;
          for (const [id, group] of stationGroups.entries()) {
            group.data.sort((a, b) => a.depth - b.depth);
            stations.push({
              id: `imported-${id}-${Date.now()}-${colorIdx}`,
              name: group.name,
              longitude: group.lon,
              latitude: group.lat,
              date: group.date,
              maxDepth: group.data.length > 0 ? group.data[group.data.length - 1].depth : 100,
              data: group.data,
              color: stationColorPalette[colorIdx % stationColorPalette.length],
            });
            colorIdx++;
          }

          resolve(stations);
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => reject(err),
    });
  });
};

export const parseTidalCSV = async (file: File): Promise<TidalRecord[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        try {
          const records: TidalRecord[] = [];
          for (const row of results.data) {
            const time = String(row.time || row.Time || row.datetime || row.date || new Date().toISOString());
            const speed = safeNumber(row.speed || row.current_speed || row.Speed || row.Velocity, 0);
            const direction = safeNumber(row.direction || row.dir || row.Direction || row.cur_dir, 0);

            const dirRad = direction * Math.PI / 180;
            const u = speed * Math.sin(dirRad);
            const v = speed * Math.cos(dirRad);

            records.push({
              time: time.includes('T') ? time : new Date(time).toISOString(),
              speed,
              direction,
              uComponent: safeNumber(row.u || row.U || u, u),
              vComponent: safeNumber(row.v || row.V || v, v),
              waterLevel: row.water_level || row.level || row.tide ? safeNumber(row.water_level || row.level || row.tide, 0) : undefined,
            });
          }
          resolve(records);
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => reject(err),
    });
  });
};

export const generateCTDCSVTemplate = (): string => {
  return [
    'station_id,station_name,longitude,latitude,date,depth,temperature,salinity,density,sound_speed',
    'ST-A01,站点A01,121.50,30.10,2025-06-01,0,25.5,32.0,1022.5,1530.2',
    'ST-A01,站点A01,121.50,30.10,2025-06-01,10,24.8,32.5,1023.1,1525.8',
    'ST-A01,站点A01,121.50,30.10,2025-06-01,50,18.2,33.8,1024.5,1510.3',
    'ST-A02,站点A02,122.20,29.90,2025-06-01,0,27.2,34.5,1023.0,1540.1',
  ].join('\n');
};
