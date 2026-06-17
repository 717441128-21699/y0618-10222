export const haversineDistance = (
  lon1: number, lat1: number,
  lon2: number, lat2: number
): number => {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const equirectangularApprox = (
  lon1: number, lat1: number,
  lon2: number, lat2: number
): number => {
  const toRad = Math.PI / 180;
  const x = (lon2 - lon1) * toRad * Math.cos(((lat1 + lat2) / 2) * toRad);
  const y = (lat2 - lat1) * toRad;
  return Math.sqrt(x * x + y * y) * 6371000;
};

export const projectToLocal = (
  lon: number, lat: number,
  originLon: number, originLat: number
): [number, number] => {
  const toRad = Math.PI / 180;
  const x = (lon - originLon) * toRad * Math.cos(originLat * toRad) * 6371000;
  const y = (lat - originLat) * toRad * 6371000;
  return [x, y];
};

export const unprojectFromLocal = (
  x: number, y: number,
  originLon: number, originLat: number
): [number, number] => {
  const toRad = Math.PI / 180;
  const lon = originLon + x / (6371000 * Math.cos(originLat * toRad)) / toRad;
  const lat = originLat + y / 6371000 / toRad;
  return [lon, lat];
};

export const bearing = (
  lon1: number, lat1: number,
  lon2: number, lat2: number
): number => {
  const toRad = Math.PI / 180;
  const dLon = (lon2 - lon1) * toRad;
  const y = Math.sin(dLon) * Math.cos(lat2 * toRad);
  const x =
    Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) -
    Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

export const destinationPoint = (
  lon: number, lat: number,
  distance: number, bearingDeg: number
): [number, number] => {
  const toRad = Math.PI / 180;
  const R = 6371000;
  const brng = bearingDeg * toRad;
  const lat1 = lat * toRad;
  const lon1 = lon * toRad;
  const ad = distance / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(ad) +
    Math.cos(lat1) * Math.sin(ad) * Math.cos(brng)
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(brng) * Math.sin(ad) * Math.cos(lat1),
    Math.cos(ad) - Math.sin(lat1) * Math.sin(lat2)
  );
  return [lon2 / toRad, lat2 / toRad];
};

export const interpolateAlongLine = (
  points: [number, number][],
  numPoints: number
): [number, number][] => {
  if (points.length === 0) return [];
  if (points.length === 1) return new Array(numPoints).fill([...points[0]]);

  const distances: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const d = equirectangularApprox(
      points[i - 1][0], points[i - 1][1],
      points[i][0], points[i][1]
    );
    distances.push(distances[i - 1] + d);
  }

  const total = distances[distances.length - 1];
  if (total === 0) return new Array(numPoints).fill([...points[0]]);

  const result: [number, number][] = [];
  for (let i = 0; i < numPoints; i++) {
    const target = (i / (numPoints - 1)) * total;
    let segIdx = 0;
    while (segIdx < distances.length - 1 && distances[segIdx + 1] < target) {
      segIdx++;
    }
    const segStart = distances[segIdx];
    const segEnd = distances[Math.min(segIdx + 1, distances.length - 1)];
    const t = segEnd === segStart ? 0 : (target - segStart) / (segEnd - segStart);
    result.push([
      points[segIdx][0] + (points[Math.min(segIdx + 1, points.length - 1)][0] - points[segIdx][0]) * t,
      points[segIdx][1] + (points[Math.min(segIdx + 1, points.length - 1)][1] - points[segIdx][1]) * t,
    ]);
  }

  return result;
};
