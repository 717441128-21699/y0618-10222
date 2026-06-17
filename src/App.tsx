import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import TSDiagramPage from '@/pages/TSDiagramPage';
import DepthProfilePage from '@/pages/DepthProfilePage';
import HorizontalMapPage from '@/pages/HorizontalMapPage';
import SectionMapPage from '@/pages/SectionMapPage';
import TidalAnalysisPage from '@/pages/TidalAnalysisPage';
import DataExportPage from '@/pages/DataExportPage';

const App: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-ocean-gradient">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-auto scrollbar-thin">
          <Routes>
            <Route path="/" element={<Navigate to="/ts-diagram" replace />} />
            <Route path="/ts-diagram" element={<TSDiagramPage />} />
            <Route path="/depth-profile" element={<DepthProfilePage />} />
            <Route path="/horizontal-map" element={<HorizontalMapPage />} />
            <Route path="/section-map" element={<SectionMapPage />} />
            <Route path="/tidal-analysis" element={<TidalAnalysisPage />} />
            <Route path="/data-export" element={<DataExportPage />} />
            <Route path="*" element={<Navigate to="/ts-diagram" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default App;
