import React from 'react';
import { useLocation } from 'react-router-dom';
import { Layers, Info, Calendar, MapPin } from 'lucide-react';
import { useDataStore } from '@/store/dataStore';

const pageTitles: Record<string, { title: string; subtitle: string; icon: React.ElementType }> = {
  '/ts-diagram': {
    title: '温盐图(T-S Diagram)',
    subtitle: '识别水团分布与特征 · 聚类分析',
    icon: Layers,
  },
  '/depth-profile': {
    title: '深度剖面图',
    subtitle: '温盐密参数随深度变化 · 多站点对比',
    icon: Layers,
  },
  '/horizontal-map': {
    title: '水平面分布图',
    subtitle: 'Kriging/IDW插值 · 等温线等盐线 · 海图叠加',
    icon: Layers,
  },
  '/section-map': {
    title: '断面温度场',
    subtitle: '沿航线温度分布 · 洋流锋面识别',
    icon: Layers,
  },
  '/tidal-analysis': {
    title: '潮流特征分析',
    subtitle: '流速流向时间序列 · 玫瑰图频率统计',
    icon: Layers,
  },
  '/data-export': {
    title: '数据导出中心',
    subtitle: 'Shapefile格式导出 · GIS系统集成',
    icon: Layers,
  },
};

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { stations, selectedStationIds, dataLoaded, loadDemoData } = useDataStore();

  const pageInfo = pageTitles[location.pathname] || pageTitles['/ts-diagram'];
  const Icon = pageInfo.icon;

  React.useEffect(() => {
    if (!dataLoaded) {
      loadDemoData();
    }
  }, [dataLoaded, loadDemoData]);

  return (
    <header className="h-16 flex items-center justify-between px-6 sticky top-0 z-30
                       bg-ocean-950/60 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-marine-cyan/15 border border-marine-cyan/30
                        flex items-center justify-center">
          <Icon className="w-5 h-5 text-marine-cyan" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold text-ocean-50 tracking-tight leading-none">
            {pageInfo.title}
          </h1>
          <p className="text-xs text-ocean-200/60 mt-1 flex items-center gap-1">
            <Info className="w-3 h-3" />
            {pageInfo.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="hidden lg:flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <MapPin className="w-3.5 h-3.5 text-marine-cyan" />
            <span className="text-ocean-200/80">
              <span className="font-mono text-marine-cyan font-semibold">{stations.length}</span>
              <span className="text-ocean-200/50 mx-1">/</span>
              <span className="text-ocean-200/60">观测站点</span>
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full
                               bg-marine-teal opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-marine-teal"></span>
            </span>
            <span className="text-ocean-200/80">
              已选
              <span className="font-mono text-marine-teal font-semibold mx-1">
                {selectedStationIds.length}
              </span>
              站
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <Calendar className="w-3.5 h-3.5 text-marine-sand" />
            <span className="font-mono text-ocean-200/80">2025夏季航次</span>
          </div>
        </div>
      </div>
    </header>
  );
};
