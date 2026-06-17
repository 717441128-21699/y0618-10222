import React from 'react';
import { useDataStore } from '@/store/dataStore';
import { ChartCard } from '@/components/layout/ChartCard';
import { useWaterMass } from '@/hooks/useWaterMass';
import { useHorizontalInterpolation } from '@/hooks/useContours';
import { buildCombinedZip, downloadBlob, type ShapeFeature } from '@/utils/gis/shapefileWriter';
import { generateWaterMassPolygons } from '@/utils/gis/waterMassBoundary';
import type { ParameterType } from '@/types/oceanography';
import {
  Download, MapPin, GitBranch, Layers, Globe, FileType,
  Check, AlertCircle, Loader2, ChevronDown, Table,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type LayerKey = 'stations' | 'contours' | 'waterMasses';

const layerConfig: Record<LayerKey, {
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  filePrefix: string;
}> = {
  stations: {
    label: '站点 Shapefile',
    desc: 'Point类型 · 含坐标/深度/观测属性',
    icon: MapPin,
    color: '#2FB6B0',
    filePrefix: 'stations',
  },
  contours: {
    label: '等值线 Shapefile',
    desc: 'Polyline类型 · 温/盐/密等值线',
    icon: GitBranch,
    color: '#3E92CC',
    filePrefix: 'contours',
  },
  waterMasses: {
    label: '水团 Shapefile',
    desc: 'Polygon类型 · 50m深度层水团地理分布',
    icon: Layers,
    color: '#F4D35E',
    filePrefix: 'water_masses',
  },
};

const SwitchToggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <button
    onClick={() => onChange(!checked)}
    className={cn(
      'relative w-11 h-6 rounded-full transition-all flex-shrink-0',
      checked ? 'bg-marine-cyan' : 'bg-white/10'
    )}
    role="switch"
    aria-checked={checked}
    aria-label={label}
  >
    <span
      className={cn(
        'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md',
        'transition-transform duration-200 flex items-center justify-center',
        checked ? 'translate-x-5' : ''
      )}
    >
      {checked && <Check className="w-3 h-3 text-marine-cyan" strokeWidth={3} />}
    </span>
  </button>
);

const LayerSwitch: React.FC<{
  layer: LayerKey;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
}> = ({ layer, enabled, onToggle, disabled }) => {
  const cfg = layerConfig[layer];
  const Icon = cfg.icon;
  return (
    <div className={cn(
      'flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border transition-all',
      disabled
        ? 'border-white/[0.04] opacity-50 cursor-not-allowed'
        : enabled
          ? 'border-white/[0.12] bg-white/[0.05]'
          : 'border-white/[0.06] hover:bg-white/[0.05]'
    )}>
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: `${cfg.color}15`,
          border: `1px solid ${cfg.color}30`,
        }}
      >
        <Icon className="w-5 h-5" style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ocean-50">{cfg.label}</div>
        <div className="text-[11px] text-ocean-200/50 mt-0.5">{cfg.desc}</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <SwitchToggle checked={enabled} onChange={onToggle} label={cfg.label} />
        <span className="text-[9px] font-mono text-ocean-200/30 uppercase tracking-wider">
          {cfg.filePrefix}.shp
        </span>
      </div>
    </div>
  );
};

interface AttrTableProps {
  rows: Record<string, string | number>[];
  title: string;
}

const AttrTable: React.FC<AttrTableProps> = ({ rows, title }) => {
  const [scrollRef] = React.useState(() => React.createRef<HTMLDivElement>());
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0]);
  const displayRows = rows.slice(0, 20);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ocean-100 flex items-center gap-1.5">
          <Table className="w-3.5 h-3.5 text-marine-cyan" />
          {title}
        </span>
        <span className="text-[10px] font-mono text-ocean-200/40">
          {rows.length} 条 · 显示前20条
        </span>
      </div>
      <div
        ref={scrollRef}
        className="max-h-44 overflow-auto scrollbar-thin rounded-lg border border-white/[0.06]"
      >
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-ocean-950/90 backdrop-blur">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-medium text-ocean-200/60
                            border-b border-white/[0.06] whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  'border-b border-white/[0.04] last:border-0 transition-colors',
                  i % 2 === 0 ? 'bg-white/[0.015]' : '',
                  'hover:bg-white/[0.04]'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-1.5 text-ocean-200/80 font-mono whitespace-nowrap"
                  >
                    {String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DataExportPage: React.FC = () => {
  const { stations, exportConfig, setExportConfig } = useDataStore();
  const [coordSystem, setCoordSystem] = React.useState<'WGS84' | 'CGCS2000'>(exportConfig.coordinateSystem);
  const [coordOpen, setCoordOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [exportMsg, setExportMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const selectedStations = stations;
  const { waterMasses } = useWaterMass(selectedStations);
  const tempGrid = useHorizontalInterpolation(selectedStations, {
    depthLevel: 50,
    parameter: 'temperature' as ParameterType,
    algorithm: 'kriging',
  });
  const salGrid = useHorizontalInterpolation(selectedStations, {
    depthLevel: 50,
    parameter: 'salinity' as ParameterType,
    algorithm: 'kriging',
  });
  const grid = tempGrid;

  const stationAttrs: Record<string, string | number>[] = stations.slice(0, 20).map(s => ({
    station_id: s.name,
    longitude: s.longitude.toFixed(4),
    latitude: s.latitude.toFixed(4),
    max_depth: s.maxDepth,
    obs_date: s.date,
    data_points: s.data.length,
  }));

  const contourAttrs: Record<string, string | number>[] = grid?.contours.slice(0, 20).map((c, i) => ({
    contour_id: `C${String(i + 1).padStart(4, '0')}`,
    param: '温度',
    value: c.value.toFixed(2),
    unit: '°C',
    n_points: c.coordinates.length,
  })) || [];

  const waterMassAttrs: Record<string, string | number>[] = waterMasses.map(wm => ({
    mass_id: wm.id.toUpperCase(),
    name: wm.name,
    cluster: wm.clusterIndex + 1,
    T_min: wm.tempRange[0].toFixed(1),
    T_max: wm.tempRange[1].toFixed(1),
    S_min: wm.salRange[0].toFixed(2),
    S_max: wm.salRange[1].toFixed(2),
    n_points: wm.pointCount,
  }));

  const waterMassFeatures = React.useMemo(() => {
    if (!tempGrid || !salGrid || waterMasses.length === 0) return [];
    try {
      return generateWaterMassPolygons(
        {
          values: tempGrid.values,
          xMin: tempGrid.xMin, xMax: tempGrid.xMax,
          yMin: tempGrid.yMin, yMax: tempGrid.yMax,
          nx: tempGrid.nx, ny: tempGrid.ny,
        },
        {
          values: salGrid.values,
          xMin: salGrid.xMin, xMax: salGrid.xMax,
          yMin: salGrid.yMin, yMax: salGrid.yMax,
          nx: salGrid.nx, ny: salGrid.ny,
        },
        waterMasses,
        coordSystem
      );
    } catch {
      return [];
    }
  }, [tempGrid, salGrid, waterMasses, coordSystem]);

  const totalEnabled = (exportConfig.stations ? 1 : 0) + (exportConfig.contours ? 1 : 0) + (exportConfig.waterMasses ? 1 : 0);
  const totalFeatures =
    (exportConfig.stations ? stations.length : 0) +
    (exportConfig.contours ? (grid?.contours.length || 0) : 0) +
    (exportConfig.waterMasses ? waterMassFeatures.length : 0);

  const handleExport = async () => {
    if (totalEnabled === 0) {
      setExportMsg({ type: 'error', text: '请至少选择一个图层进行导出' });
      return;
    }

    setExporting(true);
    setExportMsg(null);

    try {
      const layers: { features: ShapeFeature[]; layerName: string }[] = [];
      const exportedNames: string[] = [];

      if (exportConfig.stations && stations.length > 0) {
        const features: ShapeFeature[] = stations.map(s => ({
          type: 'point',
          properties: {
            station_id: s.name,
            longitude: s.longitude,
            latitude: s.latitude,
            max_depth: s.maxDepth,
            obs_date: s.date,
            n_points: s.data.length,
          },
          points: [{ x: s.longitude, y: s.latitude }],
        }));
        layers.push({ features, layerName: 'stations' });
        exportedNames.push('站点');
      }

      if (exportConfig.contours && grid?.contours.length) {
        const features: ShapeFeature[] = grid.contours.map((c, i) => ({
          type: 'polyline',
          properties: {
            contour_id: `C${String(i + 1).padStart(4, '0')}`,
            param: 'TEMP',
            value: +c.value.toFixed(3),
            unit: 'degC',
            depth: 50,
          },
          points: c.coordinates.map(([x, y]) => ({ x, y })),
        }));
        layers.push({ features, layerName: 'contours' });
        exportedNames.push('等值线');
      }

      if (exportConfig.waterMasses && waterMassFeatures.length > 0) {
        layers.push({ features: waterMassFeatures, layerName: 'water_masses' });
        exportedNames.push('水团');
      }

      const zipBlob = await buildCombinedZip(layers, coordSystem, 'ocean_hydro_export');
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      downloadBlob(zipBlob, `ocean_hydro_${coordSystem}_${timestamp}.zip`);

      setExportMsg({
        type: 'success',
        text: `导出成功！已打包 ${exportedNames.length} 个图层到单个ZIP: ${exportedNames.join(', ')}`,
      });
    } catch (e: any) {
      setExportMsg({
        type: 'error',
        text: `导出失败: ${e?.message || '未知错误'}`,
      });
    } finally {
      setExporting(false);
    }
  };

  React.useEffect(() => {
    if (exportMsg) {
      const t = setTimeout(() => setExportMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [exportMsg]);

  return (
    <div className="p-6 h-full flex flex-col gap-5 fade-in-stagger">
      <div className="grid grid-cols-5 gap-5 flex-1 min-h-0">
        <div className="col-span-2 flex flex-col gap-5 min-h-0">
          <ChartCard
            title="图层导出配置"
            subtitle="选择需要导出的Shapefile图层"
            className="flex-shrink-0"
          >
            <div className="space-y-3">
              {(Object.keys(layerConfig) as LayerKey[]).map((key) => (
                <LayerSwitch
                  key={key}
                  layer={key}
                  enabled={exportConfig[key]}
                  onToggle={(v) => setExportConfig({ [key]: v } as any)}
                  disabled={
                    (key === 'stations' && stations.length === 0) ||
                    (key === 'contours' && (!grid || grid.contours.length === 0)) ||
                    (key === 'waterMasses' && waterMassFeatures.length === 0)
                  }
                />
              ))}
            </div>
          </ChartCard>

          <ChartCard
            title="坐标系设置"
            subtitle="输出Shapefile的坐标参考系统"
            className="flex-shrink-0"
          >
            <div className="relative">
              <button
                onClick={() => setCoordOpen(v => !v)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl
                          bg-white/[0.04] border border-white/[0.08] hover:border-marine-cyan/30
                          hover:bg-white/[0.06] transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                       style={{ backgroundColor: 'rgba(126,34,206,0.12)', border: '1px solid rgba(126,34,206,0.25)' }}>
                    <Globe className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-ocean-50">
                      {coordSystem === 'WGS84' ? 'WGS 1984 (EPSG:4326)' : 'CGCS 2000 (EPSG:4490)'}
                    </div>
                    <div className="text-[11px] text-ocean-200/50 mt-0.5">
                      {coordSystem === 'WGS84' ? '全球通用地理坐标系 · GPS基准' : '中国国家大地坐标系 · 2000系'}
                    </div>
                  </div>
                </div>
                <ChevronDown className={cn(
                  'w-4 h-4 text-ocean-200/50 transition-transform flex-shrink-0',
                  coordOpen && 'rotate-180'
                )} />
              </button>
              {coordOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-2 rounded-xl
                               bg-ocean-900/95 backdrop-blur-xl border border-white/[0.1]
                               shadow-2xl overflow-hidden">
                  {(['WGS84', 'CGCS2000'] as const).map(crs => (
                    <button
                      key={crs}
                      onClick={() => {
                        setCoordSystem(crs);
                        setExportConfig({ coordinateSystem: crs });
                        setCoordOpen(false);
                      }}
                      className={cn(
                        'w-full px-4 py-3 text-left hover:bg-white/[0.06] transition-colors flex items-center gap-3',
                        crs === coordSystem && 'bg-purple-500/10 border-l-2 border-purple-400'
                      )}
                    >
                      <Globe className="w-4 h-4 text-purple-400" />
                      <div>
                        <div className="text-sm font-medium text-ocean-50">
                          {crs === 'WGS84' ? 'WGS 1984' : 'CGCS 2000'}
                        </div>
                        <div className="text-[11px] text-ocean-200/50">
                          {crs === 'WGS84' ? 'EPSG:4326 · 国际通用' : 'EPSG:4490 · 国内标准'}
                        </div>
                      </div>
                      {crs === coordSystem && <Check className="w-4 h-4 text-purple-400 ml-auto" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <FileType className="w-4 h-4 text-ocean-200/40 flex-shrink-0" />
              <span className="text-[11px] text-ocean-200/50 leading-relaxed">
                输出格式: <span className="text-ocean-100/80 font-medium">ESRI Shapefile (.shp/.shx/.dbf/.prj)</span>
                ，打包为ZIP压缩文件，可直接导入ArcGIS/QGIS。
              </span>
            </div>
          </ChartCard>

          <ChartCard className="flex-1 min-h-0 overflow-hidden">
            <div className="h-full flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-[11px] text-ocean-200/50 mb-1">已选图层</div>
                  <div className="font-display text-xl font-semibold text-marine-cyan">
                    {totalEnabled}<span className="text-ocean-200/40 text-sm ml-1">/ 3</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-[11px] text-ocean-200/50 mb-1">要素总数</div>
                  <div className="font-display text-xl font-semibold text-marine-teal">
                    {totalFeatures}
                  </div>
                </div>
              </div>

              {exportMsg && (
                <div className={cn(
                  'p-3 rounded-xl flex items-center gap-2.5 text-sm',
                  exportMsg.type === 'success'
                    ? 'bg-marine-teal/10 border border-marine-teal/25 text-marine-teal'
                    : 'bg-marine-coral/10 border border-marine-coral/25 text-marine-coral'
                )}>
                  {exportMsg.type === 'success'
                    ? <Check className="w-4 h-4 flex-shrink-0" />
                    : <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  }
                  <span className="leading-relaxed">{exportMsg.text}</span>
                </div>
              )}

              <div className="mt-auto">
                <button
                  onClick={handleExport}
                  disabled={exporting || totalEnabled === 0}
                  className={cn(
                    'btn-primary w-full flex items-center justify-center gap-2.5 py-3.5 text-base',
                    (exporting || totalEnabled === 0) && 'opacity-50 cursor-not-allowed hover:translate-y-0 hover:shadow-none'
                  )}
                >
                  {exporting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>正在导出Shapefile...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      <span className="font-medium">导出 Shapefile ZIP</span>
                      <span className="ml-1 px-2 py-0.5 rounded-md bg-white/15 text-xs font-mono">
                        {totalLayersString(exportConfig)}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </ChartCard>
        </div>

        <div className="col-span-3 min-h-0">
          <ChartCard
            title="属性表预览"
            subtitle="即将导出的Shapefile属性表数据"
            className="h-full"
          >
            <div className="h-full flex flex-col gap-6 overflow-y-auto scrollbar-thin pr-1">
              {exportConfig.stations && (
                <AttrTable rows={stationAttrs} title={`站点图层 (${stations.length}条)`} />
              )}
              {exportConfig.contours && contourAttrs.length > 0 && (
                <AttrTable rows={contourAttrs} title={`等值线图层 (${grid?.contours.length || 0}条)`} />
              )}
              {exportConfig.waterMasses && waterMassAttrs.length > 0 && (
                <AttrTable rows={waterMassAttrs} title={`水团图层 (${waterMassFeatures.length}个面)`} />
              )}
              {!exportConfig.stations && !exportConfig.contours && !exportConfig.waterMasses && (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-center py-12">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                       style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Download className="w-8 h-8 text-ocean-200/30" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-ocean-100/60 mb-1">尚未选择导出图层</div>
                    <div className="text-[12px] text-ocean-200/40 max-w-xs">
                      在左侧配置面板中开启需要导出的图层开关，属性表预览将在此显示。
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  );
};

function totalLayersString(cfg: { stations: boolean; contours: boolean; waterMasses: boolean }): string {
  const count = (cfg.stations ? 1 : 0) + (cfg.contours ? 1 : 0) + (cfg.waterMasses ? 1 : 0);
  return `${count} 图层`;
}

export default DataExportPage;
