const solveLinearSystem = (A: number[][], b: number[]): number[] => {
  const n = A.length;
  const augmented: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(augmented[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > maxVal) {
        maxVal = Math.abs(augmented[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) {
      [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];
    }

    const pivot = augmented[col][col];
    if (Math.abs(pivot) < 1e-12) continue;

    for (let row = 0; row < n; row++) {
      if (row !== col && Math.abs(augmented[row][col]) > 1e-12) {
        const factor = augmented[row][col] / pivot;
        for (let k = col; k <= n; k++) {
          augmented[row][k] -= factor * augmented[col][k];
        }
      }
    }
  }

  const solution: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    solution[i] = Math.abs(augmented[i][i]) < 1e-12 ? 0 : augmented[i][n] / augmented[i][i];
  }
  return solution;
};

const sphericalVariogram = (h: number, nugget: number, sill: number, range: number): number => {
  if (h <= 0) return 0;
  if (h >= range) return sill;
  const hr = h / range;
  return nugget + (sill - nugget) * (1.5 * hr - 0.5 * hr ** 3);
};

export class KrigingInterpolator {
  private points: { x: number; y: number; value: number }[];
  private nugget: number;
  private sill: number;
  private range: number;
  private maxNeighbors: number;

  constructor(
    samples: { x: number; y: number; value: number }[],
    range?: number,
    maxNeighbors: number = 10
  ) {
    this.points = [...samples];
    this.maxNeighbors = Math.min(maxNeighbors, samples.length);

    if (samples.length >= 2) {
      const dists: number[] = [];
      for (let i = 0; i < samples.length; i++) {
        for (let j = i + 1; j < samples.length; j++) {
          dists.push(Math.sqrt(
            (samples[i].x - samples[j].x) ** 2 +
            (samples[i].y - samples[j].y) ** 2
          ));
        }
      }
      dists.sort((a, b) => a - b);
      this.range = range ?? (dists.length > 0 ? dists[Math.floor(dists.length * 0.6)] : 10000);

      const values = samples.map(s => s.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      this.sill = Math.max(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length, 0.1);
      this.nugget = this.sill * 0.05;
    } else {
      this.nugget = 0.01;
      this.sill = 1;
      this.range = range ?? 10000;
    }
  }

  private gamma(h: number): number {
    return sphericalVariogram(h, this.nugget, this.sill, this.range);
  }

  interpolate(x: number, y: number): number {
    const n = this.points.length;
    if (n === 0) return NaN;
    if (n === 1) return this.points[0].value;

    const neighbors = this.points
      .map((p, idx) => ({
        idx,
        d: Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2),
        p,
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.maxNeighbors);

    if (neighbors[0].d < 1e-6) {
      return neighbors[0].p.value;
    }

    const m = neighbors.length;
    const A: number[][] = [];
    const b: number[] = [];

    for (let i = 0; i < m; i++) {
      const row: number[] = [];
      for (let j = 0; j < m; j++) {
        const d = Math.sqrt(
          (neighbors[i].p.x - neighbors[j].p.x) ** 2 +
          (neighbors[i].p.y - neighbors[j].p.y) ** 2
        );
        row.push(this.gamma(d));
      }
      row.push(1);
      A.push(row);
      b.push(this.gamma(neighbors[i].d));
    }
    A.push(new Array(m).fill(1).concat([0]));
    b.push(1);

    const weights = solveLinearSystem(A, b);

    let result = 0;
    for (let i = 0; i < m; i++) {
      result += weights[i] * neighbors[i].p.value;
    }

    return result;
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
