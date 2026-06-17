import type { KMeansResult } from '@/types/oceanography';

export const kmeans = (
  data: number[][],
  k: number,
  maxIter: number = 100,
  tol: number = 1e-4
): KMeansResult => {
  if (data.length === 0) {
    return { centroids: [], assignments: [], k: 0, inertia: 0 };
  }

  const dims = data[0].length;
  const n = data.length;

  const centroids: number[][] = [];
  const usedIndices = new Set<number>();
  for (let i = 0; i < Math.min(k, n); i++) {
    let idx: number;
    do {
      idx = Math.floor(Math.random() * n);
    } while (usedIndices.has(idx) && usedIndices.size < n);
    usedIndices.add(idx);
    centroids.push([...data[idx]]);
  }

  let assignments = new Array(n).fill(0);
  let inertia = Infinity;

  for (let iter = 0; iter < maxIter; iter++) {
    let newInertia = 0;
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let c = 0; c < centroids.length; c++) {
        let d = 0;
        for (let j = 0; j < dims; j++) {
          d += (data[i][j] - centroids[c][j]) ** 2;
        }
        if (d < minDist) {
          minDist = d;
          bestCluster = c;
        }
      }
      assignments[i] = bestCluster;
      newInertia += minDist;
    }

    const newCentroids = centroids.map(c => new Array(dims).fill(0));
    const counts = new Array(centroids.length).fill(0);
    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      counts[c]++;
      for (let j = 0; j < dims; j++) {
        newCentroids[c][j] += data[i][j];
      }
    }
    for (let c = 0; c < centroids.length; c++) {
      if (counts[c] > 0) {
        for (let j = 0; j < dims; j++) {
          newCentroids[c][j] /= counts[c];
        }
      }
    }

    let maxShift = 0;
    for (let c = 0; c < centroids.length; c++) {
      let shift = 0;
      for (let j = 0; j < dims; j++) {
        shift += (newCentroids[c][j] - centroids[c][j]) ** 2;
      }
      maxShift = Math.max(maxShift, shift);
      centroids[c] = newCentroids[c];
    }

    const improvement = Math.abs(inertia - newInertia);
    inertia = newInertia;

    if (maxShift < tol || improvement < tol * inertia) break;
  }

  return { centroids, assignments, k, inertia };
};

export const findOptimalK = (data: number[][], maxK: number = 6): number => {
  if (data.length < 5) return Math.min(2, Math.max(1, Math.floor(data.length / 2)));

  const inertias: number[] = [];
  for (let k = 1; k <= Math.min(maxK, Math.floor(data.length / 5)); k++) {
    let bestInertia = Infinity;
    for (let trial = 0; trial < 3; trial++) {
      const result = kmeans(data, k);
      if (result.inertia < bestInertia) bestInertia = result.inertia;
    }
    inertias.push(bestInertia);
  }

  if (inertias.length < 3) return 3;

  let bestK = 3;
  let bestScore = -Infinity;
  for (let i = 1; i < inertias.length - 1; i++) {
    const prevDrop = inertias[i - 1] - inertias[i];
    const nextDrop = inertias[i] - inertias[i + 1];
    const score = prevDrop / (nextDrop + 1e-10);
    if (score > bestScore) {
      bestScore = score;
      bestK = i + 1;
    }
  }

  return Math.min(bestK, maxK);
};

export const normalizeData = (data: number[][]): { normalized: number[][]; means: number[]; stds: number[] } => {
  if (data.length === 0) return { normalized: [], means: [], stds: [] };
  const dims = data[0].length;
  const means = new Array(dims).fill(0);
  const stds = new Array(dims).fill(0);

  for (const row of data) {
    for (let j = 0; j < dims; j++) means[j] += row[j];
  }
  for (let j = 0; j < dims; j++) means[j] /= data.length;

  for (const row of data) {
    for (let j = 0; j < dims; j++) {
      stds[j] += (row[j] - means[j]) ** 2;
    }
  }
  for (let j = 0; j < dims; j++) {
    const variance = stds[j] / data.length;
    const stdDev = Math.sqrt(variance);
    stds[j] = Math.max(stdDev, 0.00000001);
  }

  const normalized = data.map(row =>
    row.map((val, j) => (val - means[j]) / stds[j])
  );

  return { normalized, means, stds };
};
