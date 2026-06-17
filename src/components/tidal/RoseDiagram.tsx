import React from 'react';
import * as d3 from 'd3';
import type { RoseSector } from '@/types/oceanography';
import { tidalCurrentScale } from '@/utils/colorScales';

interface RoseDiagramProps {
  sectors: RoseSector[];
  maxFrequency: number;
  width?: number;
  height?: number;
  unit?: string;
}

const DIR_LABELS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export const RoseDiagram: React.FC<RoseDiagramProps> = ({
  sectors,
  maxFrequency,
  width = 520,
  height = 520,
  unit = 'm/s',
}) => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = React.useState<{
    sector: RoseSector;
    x: number;
    y: number;
  } | null>(null);

  React.useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 60;

    const g = svg.append('g')
      .attr('transform', `translate(${cx}, ${cy})`);

    const maxFreq = Math.max(maxFrequency, 0.1);
    const rScale = d3.scaleLinear()
      .domain([0, maxFreq])
      .range([0, radius])
      .nice();

    const ringTicks = 5;
    const tickValues = rScale.ticks(ringTicks).filter(v => v > 0);

    for (const v of tickValues) {
      g.append('circle')
        .attr('r', rScale(v))
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.08)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3 3');
      g.append('text')
        .attr('x', 4)
        .attr('y', -rScale(v))
        .attr('fill', 'rgba(230,240,255,0.4)')
        .attr('font-size', 9)
        .attr('font-family', "'Source Code Pro', monospace")
        .attr('alignment-baseline', 'middle')
        .text(`${v.toFixed(1)}%`);
    }

    for (let i = 0; i < 16; i++) {
      const angle = (i * 22.5 - 90) * Math.PI / 180;
      const isCardinal = i % 4 === 0;
      const lineR = isCardinal ? radius * 1.02 : radius * 0.98;
      g.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', Math.cos(angle) * lineR)
        .attr('y2', Math.sin(angle) * lineR)
        .attr('stroke', isCardinal ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)')
        .attr('stroke-width', isCardinal ? 1 : 0.7);

      const labelR = radius * (isCardinal ? 1.18 : 1.1);
      const labelAngle = angle;
      const lx = Math.cos(labelAngle) * labelR;
      const ly = Math.sin(labelAngle) * labelR;
      const label = g.append('text')
        .attr('x', lx)
        .attr('y', ly)
        .attr('text-anchor', 'middle')
        .attr('alignment-baseline', 'middle')
        .attr('font-family', "'Inter', sans-serif")
        .attr('font-size', isCardinal ? 13 : 10)
        .attr('font-weight', isCardinal ? 600 : 400)
        .attr('fill', isCardinal ? 'rgba(230,240,255,0.85)' : 'rgba(230,240,255,0.5)');

      if (DIR_LABELS[i] === 'N') {
        label.attr('font-size', 14)
          .attr('font-weight', 700)
          .attr('fill', '#4ECDC4');
      }
      label.text(DIR_LABELS[i]);
    }

    g.append('circle')
      .attr('r', 4)
      .attr('fill', 'rgba(255,255,255,0.6)')
      .attr('stroke', 'rgba(62, 146, 204, 0.4)')
      .attr('stroke-width', 1.5);

    if (sectors.length > 0) {
      const maxAvgSpeed = d3.max(sectors, s => s.avgSpeed) || 1;
      const speedColor = d3.scaleSequential([0, maxAvgSpeed], d3.interpolateViridis);

      for (let i = 0; i < sectors.length; i++) {
        const s = sectors[i];
        if (!s || s.frequency <= 0) continue;

        const startAngle = (i * 22.5 - 90 - 11.25) * Math.PI / 180;
        const endAngle = (i * 22.5 - 90 + 11.25) * Math.PI / 180;
        const r = rScale(s.frequency);

        const r0 = 0;
        const r1 = r;
        const a0 = startAngle;
        const a1 = endAngle;

        const path = d3.path();
        path.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
        path.arc(0, 0, r1, a0, a1);
        path.lineTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
        path.closePath();

        const speedNorm = maxAvgSpeed > 0 ? s.avgSpeed / maxAvgSpeed : 0;
        const baseColor = tidalCurrentScale(speedNorm);
        const r_c = parseInt(baseColor.slice(1, 3), 16);
        const g_c = parseInt(baseColor.slice(3, 5), 16);
        const b_c = parseInt(baseColor.slice(5, 7), 16);
        const fillColor = `rgba(${r_c}, ${g_c}, ${b_c}, 0.75)`;
        const strokeColor = `rgba(${r_c}, ${g_c}, ${b_c}, 0.95)`;

        const pathEl = g.append('path')
          .attr('d', path.toString())
          .attr('fill', fillColor)
          .attr('stroke', strokeColor)
          .attr('stroke-width', 1.2)
          .attr('cursor', 'pointer')
          .style('transition', 'all 0.15s ease');

        pathEl.on('mouseenter', function (event) {
          d3.select(this)
            .attr('stroke-width', 2)
            .attr('fill', `rgba(${r_c}, ${g_c}, ${b_c}, 0.92)`);
          const [mx, my] = d3.pointer(event, svgRef.current!);
          setHovered({ sector: s, x: mx, y: my });
        })
        .on('mousemove', function (event) {
          const [mx, my] = d3.pointer(event, svgRef.current!);
          setHovered(prev => prev ? { ...prev, x: mx, y: my } : { sector: s, x: mx, y: my });
        })
        .on('mouseleave', function () {
          d3.select(this)
            .attr('stroke-width', 1.2)
            .attr('fill', fillColor);
          setHovered(null);
        });
      }
    }

    const centerLabel = g.append('g')
      .attr('text-anchor', 'middle');

    centerLabel.append('text')
      .attr('y', -4)
      .attr('font-size', 9)
      .attr('fill', 'rgba(230,240,255,0.4)')
      .attr('font-family', "'Source Code Pro', monospace")
      .text('频率');

    centerLabel.append('text')
      .attr('y', 10)
      .attr('font-size', 8)
      .attr('fill', 'rgba(230,240,255,0.3)')
      .attr('font-family', "'Source Code Pro', monospace")
      .text('(% of obs)');
  }, [sectors, maxFrequency, width, height]);

  const maxAvgSpeed = React.useMemo(() => {
    return d3.max(sectors, s => s.avgSpeed) || 0;
  }, [sectors]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="relative" style={{ width, height }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="overflow-visible"
          onMouseLeave={() => setHovered(null)}
        />
        {hovered && (
          <div
            className="chart-tooltip"
            style={{
              left: Math.min(hovered.x + 14, width - 190),
              top: Math.max(hovered.y - 70, 5),
            }}
          >
            <div className="flex flex-col gap-1" style={{ fontSize: 11 }}>
              <div className="flex items-center justify-between gap-3 pb-1 border-b border-white/10">
                <span className="text-ocean-200/50">流向</span>
                <span className="text-ocean-50 font-bold tracking-wide">
                  {hovered.sector.directionLabel}
                  <span className="text-ocean-200/40 font-normal ml-1 font-mono text-[10px]">
                    {hovered.sector.direction.toFixed(0)}°
                  </span>
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '3px 10px' }}>
                <span className="text-ocean-200/55">频率:</span>
                <span style={{ color: '#4ECDC4', fontWeight: 600 }}>
                  {hovered.sector.frequency.toFixed(2)}%
                </span>
                <span className="text-ocean-200/55">记录数:</span>
                <span style={{ fontFamily: "'Source Code Pro', monospace" }}>
                  {hovered.sector.count.toLocaleString()}
                </span>
                <span className="text-ocean-200/55">平均流速:</span>
                <span style={{ color: '#F4D35E', fontWeight: 600 }}>
                  {hovered.sector.avgSpeed.toFixed(2)} {unit}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <div
              className="w-16 h-3 rounded-sm"
              style={{
                background: `linear-gradient(to right, ${
                  Array.from({ length: 7 }, (_, i) => tidalCurrentScale(i / 6))
                    .join(', ')
                })`,
              }}
            />
            <div className="flex justify-between w-16 text-[9px] font-mono text-ocean-200/50 -mt-1">
              <span>0</span>
              <span>{maxAvgSpeed.toFixed(1)}</span>
            </div>
          </div>
          <div className="text-[10px] text-ocean-200/50 font-medium">
            平均流速 ({unit})
          </div>
        </div>
      </div>
    </div>
  );
};
