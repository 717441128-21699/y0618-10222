import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ScatterChart,
  LineChart,
  Map,
  Route,
  Wind,
  Download,
  Upload,
  Database,
  Waves,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useDataStore } from '@/store/dataStore';

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: 'ts-diagram', label: 'T-S温盐图', path: '/ts-diagram', icon: ScatterChart },
  { id: 'depth-profile', label: '深度剖面', path: '/depth-profile', icon: LineChart },
  { id: 'horizontal-map', label: '水平面分布', path: '/horizontal-map', icon: Map },
  { id: 'section-map', label: '断面分析', path: '/section-map', icon: Route },
  { id: 'tidal-analysis', label: '潮流分析', path: '/tidal-analysis', icon: Wind },
  { id: 'data-export', label: '数据导出', path: '/data-export', icon: Download },
];

export const Sidebar: React.FC<{ collapsed: boolean; onToggle: () => void }> = ({ collapsed, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loadDemoData, stations } = useDataStore();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      window.dispatchEvent(new CustomEvent('import-files', { detail: files }));
    }
    e.target.value = '';
  };

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-60'} flex-shrink-0 h-screen sticky top-0 transition-all duration-300 flex flex-col
                 bg-gradient-to-b from-ocean-950 via-ocean-900 to-ocean-800
                 border-r border-white/[0.07]`}
    >
      <div className={`h-16 flex items-center ${collapsed ? 'justify-center' : 'px-5 gap-3'}
                       border-b border-white/[0.06]`}>
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-marine-cyan to-ocean-500
                        flex items-center justify-center flex-shrink-0 shadow-cyan-glow">
          <Waves className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <div className="font-display text-lg font-semibold text-ocean-50 leading-tight">
              OceanViz
            </div>
            <div className="text-[10px] text-ocean-200/50 tracking-widest uppercase">
              Hydro Analysis
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const active = location.pathname === item.path ||
            (item.path !== '/ts-diagram' && location.pathname.startsWith(item.path));
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`nav-item w-full ${active ? 'nav-item-active' : ''}`}
              style={{ animationDelay: `${idx * 0.03}s` }}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={active ? 2.2 : 1.8} />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className={`p-3 border-t border-white/[0.06] space-y-2`}>
        <button
          onClick={handleFileClick}
          className={`w-full ${collapsed ? 'justify-center' : ''}
                     flex items-center gap-2 px-3 py-2 rounded-lg
                     bg-marine-cyan/15 text-marine-cyan text-sm font-medium
                     hover:bg-marine-cyan/25 transition-colors`}
          title={collapsed ? '导入数据' : undefined}
        >
          <Upload className="w-4 h-4" />
          {!collapsed && <span>导入数据</span>}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={loadDemoData}
          className={`w-full ${collapsed ? 'justify-center' : ''}
                     flex items-center gap-2 px-3 py-2 rounded-lg
                     bg-white/[0.05] text-ocean-100 text-sm
                     hover:bg-white/[0.10] transition-colors
                     ${stations.length > 0 ? 'border border-marine-teal/30 text-marine-teal' : ''}`}
          title={collapsed ? '加载演示数据' : undefined}
        >
          <Database className="w-4 h-4" />
          {!collapsed && <span>{stations.length > 0 ? '已加载演示数据 ✓' : '加载演示数据'}</span>}
        </button>
        <button
          onClick={onToggle}
          className={`w-full flex ${collapsed ? 'justify-center' : 'justify-end'}
                     items-center px-3 py-2 rounded-lg
                     text-ocean-200/60 hover:text-ocean-50 hover:bg-white/[0.05]
                     text-xs transition-colors`}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : (
            <><span>收起</span><ChevronLeft className="w-4 h-4 ml-1" /></>
          )}
        </button>
      </div>
    </aside>
  );
};
