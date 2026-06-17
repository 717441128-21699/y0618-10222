import React from 'react';
import * as d3 from 'd3';
import type { Station, WaterMass } from '@/types/oceanography';
import { useWaterMass, computeIsopycnals, TSPoint } from '@/hooks/useWaterMass';

interface TSScatterPlotProps {
  stations: Station[];
  width?: number;
  height?: number;
  colorBy?: 'density' | 'cluster' | 'station';
}

export const TSScatterPlot: React.FC<TSScatterPlotProps> = ({
  stations,
  width = 820,
  height = 640,
  colorBy = 'density',
}) => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = React.useState<{ point: TSPoint; x: number; y: number } | null>(null);

  const { tsPoints, waterMasses } = useWaterMass(stations);
  const margin = { top: 40, right: 60, bottom: 60, left: 70 };

  React.useEffect(() => {
    if (!svgRef.current || tsPoints.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const sMin = (d3.min(tsPoints, d => d.sal) || 30) - 0.3;
    const sMax = (d3.max(tsPoints, d => d.sal) || 37) + 0.3;
    const tMin = (d3.min(tsPoints, d => d.temp) || 0) - 1;
    const tMax = (d3.max(tsPoints, d => d.temp) || 30) + 1;

    const xScale = d3.scaleLinear().domain([sMin, sMax]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([tMin, tMax]).range([innerH, 0]);

    const densMin = d3.min(tsPoints, d => d.density) || 1020;
    const densMax = d3.max(tsPoints, d => d.density) || 1030;
    const densColor = d3.scaleSequential([densMin, densMax], d3.interpolateViridis);

    const isopycnals = computeIsopycnals(tMin, tMax, sMin, sMax, [1020, 1022, 1024, 1026, 1028, 1030]);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('g').selectAll('line.h')
      .data(xScale.ticks(8)).join('line').attr('class', 'tick-line')
      .attr('x1', d => xScale(d)).attr('x2', d => xScale(d))
      .attr('y1', 0).attr('y2', innerH);
    g.append('g').selectAll('line.v')
      .data(yScale.ticks(8)).join('line').attr('class', 'tick-line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', d => yScale(d)).attr('y2', d => yScale(d));

    const isoG = g.append('g').attr('class', 'isopycnals');
    for (const iso of isopycnals) {
      const path = d3.line<{ temp: number; sal: number }>()
        .x(d => xScale(d.sal)).y(d => yScale(d.temp))
        .curve(d3.curveMonotoneX);
      isoG.append('path')
        .datum(iso.points)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(142, 202, 230, 0.25)')
        .attr('stroke-dasharray', '4 4')
        .attr('stroke-width', 1.2)
        .attr('d', path);
      if (iso.points.length > 20) {
        const mid = iso.points[Math.floor(iso.points.length / 2)];
        isoG.append('text')
          .attr('x', xScale(mid.sal)).attr('y', yScale(mid.temp))
          .attr('fill', 'rgba(142, 202, 230, 0.5)')
          .attr('font-size', 10)
          .attr('font-family', "'Source Code Pro', monospace")
          .text(`σt=${(iso.level - 1000).toFixed(0)}`);
      }
    }

    if (waterMasses.length > 0) {
      type Pt = [number, number];
      const hullG = g.append('g').attr('class', 'watermass-hulls');
      for (const wm of waterMasses) {
        const clusterPts = tsPoints
          .filter(p => p.clusterIndex === wm.clusterIndex)
          .map(p => [xScale(p.sal), yScale(p.temp)] as Pt);
        if (clusterPts.length < 3) continue;
        const hull = d3.polygonHull(clusterPts);
        if (!hull) continue;
        const cx = d3.mean(hull, p => p[0])!;
        const cy = d3.mean(hull, p => p[1])!;
        const inflated: Pt[] = hull.map(p => [
          cx + (p[0] - cx) * 1.08, cy + (p[1] - cy) * 1.08,
        ]);
        const solidColor = wm.color.replace(/[\d.]+\)$/, '0.9)');
        hullG.append('polygon')
          .attr('points', inflated.map(p => p.join(',')).join(' '))
          .attr('fill', wm.color)
          .attr('stroke', solidColor)
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '5 3');
      }
      for (const wm of waterMasses) {
        const solidColor = wm.color.replace(/[\d.]+\)$/, '1)');
        hullG.append('circle')
          .attr('cx', xScale(wm.centroid.sal))
          .attr('cy', yScale(wm.centroid.temp))
          .attr('r', 7)
          .attr('fill', solidColor)
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5);
        hullG.append('text')
          .attr('x', xScale(wm.centroid.sal))
          .attr('y', yScale(wm.centroid.temp) + 3)
          .attr('fill', 'white')
          .attr('font-size', 8)
          .attr('font-weight', 'bold')
          .attr('text-anchor', 'middle')
          .attr('pointer-events', 'none')
          .text(wm.clusterIndex + 1);
      }
    }

    const ptsG = g.append('g').attr('class', 'scatter-points');
    const pts = ptsG.selectAll('circle')
      .data(tsPoints)
      .join('circle')
      .attr('cx', d => xScale(d.sal))
      .attr('cy', d => yScale(d.temp))
      .attr('r', 2.2)
      .attr('fill-opacity', 0.75)
      .attr('stroke-width', 0.4)
      .style('cursor', 'pointer');

    if (colorBy === 'density') {
      pts.attr('fill', d => densColor(d.density)).attr('stroke', d => densColor(d.density));
    } else if (colorBy === 'cluster') {
      pts.attr('fill', d => (waterMasses[d.clusterIndex ?? 0]?.color.replace(/[\d.]+\)$/, '0.85)') || '#888'))
         .attr('stroke', d => (waterMasses[d.clusterIndex ?? 0]?.color.replace(/[\d.]+\)$/, '1)') || '#888'));
    } else {
      pts.attr('fill', d => (stations.find(s => s.id === d.stationId)?.color || '#888'))
         .attr('stroke', d => (stations.find(s => s.id === d.stationId)?.color || '#888'));
    }

    pts.on('mouseenter', function (event, d) {
          d3.select(this).transition().duration(80).attr('r', 5).attr('fill-opacity', 1);
          const [mx, my] = d3.pointer(event, svgRef.current!);
          setHovered({ point: d, x: mx, y: my });
        })
        .on('mousemove', function (event, d) {
          const [mx, my] = d3.pointer(event, svgRef.current!);
          setHovered({ point: d, x: mx, y: my });
        })
        .on('mouseleave', function () {
          d3.select(this).transition().duration(150).attr('r', 2.2).attr('fill-opacity', 0.75);
          setHovered(null);
        });

    const styleAxis = (sel: d3.Selection<SVGGElement, unknown, null, undefined>) => {
      sel.selectAll('.domain').attr('stroke', 'rgba(255,255,255,0.25)');
      sel.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.15)');
      sel.selectAll('.tick text').attr('class', 'axis-label').attr('fill', 'rgba(230,240,255,0.65)');
    };
    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(10)).call(styleAxis);
    g.append('g').call(d3.axisLeft(yScale).ticks(10)).call(styleAxis);

    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 45)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(230,240,255,0.85)')
      .style('font-size', 13).style('font-weight', 500)
      .text('盐度  Salinity (PSU)');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -50)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(230,240,255,0.85)')
      .style('font-size', 13).style('font-weight', 500)
      .text('温度  Temperature (°C)');
  }, [tsPoints, waterMasses, width, height, colorBy, stations]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-visible">
      <svg ref={svgRef} width={width} height={height} />
      {hovered && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(hovered.x + 16, width - 200),
            top: Math.max(hovered.y - 70, 5),
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '3px 10px' }}>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>T:</span>
            <span style={{ color: '#F46036', fontWeight: 600 }}>{hovered.point.temp.toFixed(2)}°C</span>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>S:</span>
            <span style={{ color: '#3E92CC', fontWeight: 600 }}>{hovered.point.sal.toFixed(2)} PSU</span>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>σt:</span>
            <span style={{ color: '#B8E186', fontWeight: 600 }}>{(hovered.point.density - 1000).toFixed(2)} kg/m³</span>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>深度:</span>
            <span style={{ fontFamily: "'Source Code Pro', monospace" }}>{hovered.point.depth.toFixed(0)} m</span>
          </div>
        </div>
      )}
      {tsPoints.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-ocean-200/50 text-sm">
          暂无数据，请先加载站点
        </div>
      )}
    </div>
  );
};

export { computeIsopycnals };
export type { TSPoint, WaterMass };
