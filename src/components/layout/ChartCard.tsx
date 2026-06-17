import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface ChartCardProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  actions,
  children,
  className = '',
  bodyClassName = '',
  headerClassName = '',
}) => {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div
      className={`glass-card flex flex-col overflow-hidden transition-all duration-300
                  ${expanded ? 'fixed inset-6 z-50' : ''}
                  ${className}`}
    >
      {(title || actions) && (
        <div className={`flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]
                         bg-gradient-to-r from-white/[0.02] to-transparent ${headerClassName}`}>
          <div>
            {title && (
              <h3 className="card-title flex items-center gap-2">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-ocean-200/50 mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded-md text-ocean-200/50 hover:text-ocean-50
                         hover:bg-white/[0.08] transition-colors"
              title={expanded ? '还原' : '全屏'}
            >
              {expanded
                ? <Minimize2 className="w-4 h-4" />
                : <Maximize2 className="w-4 h-4" />
              }
            </button>
          </div>
        </div>
      )}
      <div className={`flex-1 p-4 overflow-auto scrollbar-thin ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
};
