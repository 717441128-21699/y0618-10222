export class IDWInterpolator {
  private points: { x: number; y: number; value: number }[];
  private power: number;
  private maxNeighbors: number;

  constructor(
    samples: { x: number; y: number; value: number }[],
    power: number = 2,
    maxNeighbors: number = 12
  ) {
    this.points = [...samples];
    this.power = power;
    this.maxNeighbors = Math.min(maxNeighbors, samples.length);
  }

  interpolate(x: number, y: number): number {
    if (this.points.length === 0) return NaN;

    const distances = this.points.map(p => ({
      d: Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2),
      value: p.value,
    }));

    distances.sort((a, b) => a.d - b.d);

    const nearest = distances.slice(0, this.maxNeighbors);

    if (nearest[0].d < 1e-10) {
      return nearest[0].value;
    }

    let weightSum = 0;
    let valueSum = 0;

    for (const n of nearest) {
      const w = 1 / n.d ** this.power;
      weightSum += w;
      valueSum += w * n.value;
    }

    return weightSum === 0 ? nearest[0].value : valueSum / weightSum;
  }

  interpolateGrid(
    xMin: number, xMax: number,
    yMin: number, yMax: number,
    nx: number, ny: number
  ): number[][] {
    const grid: number[][] = [];
    for (let j = 0; j < ny; j++) {
      const row: number[] = [];
      const y = yMin + (yMax - yMin) * (j / (ny - 1));
      for (let i = 0; i < nx; i++) {
        const x = xMin + (xMax - xMin) * (i / (nx - 1));
        row.push(this.interpolate(x, y));
      }
      grid.push(row);
    }
    return grid;
  }
}
