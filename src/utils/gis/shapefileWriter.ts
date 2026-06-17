import JSZip from 'jszip';

const writeInt32LE = (buffer: Buffer, offset: number, value: number) => {
  buffer.writeInt32LE(value, offset);
};

const writeInt32BE = (buffer: Buffer, offset: number, value: number) => {
  buffer.writeInt32BE(value, offset);
};

const writeDoubleLE = (buffer: Buffer, offset: number, value: number) => {
  buffer.writeDoubleLE(value, offset);
};

const utf8ByteLength = (str: string): number => {
  return Buffer.byteLength(str, 'utf8');
};

const padStringUtf8 = (str: string, byteLength: number): string => {
  let result = str;
  while (utf8ByteLength(result) > byteLength) {
    result = result.slice(0, -1);
  }
  const padLen = byteLength - utf8ByteLength(result);
  return result + ' '.repeat(padLen);
};

interface ShapePoint {
  x: number;
  y: number;
}

interface ShapeFeature {
  type: 'point' | 'polyline' | 'polygon';
  properties: Record<string, string | number>;
  points?: ShapePoint[];
  parts?: number[];
}

const computeBBox = (features: ShapeFeature[]): [number, number, number, number] => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of features) {
    const pts = f.points || [];
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return [minX, minY, maxX, maxY];
};

const getFieldDefs = (properties: Record<string, string | number>[]) => {
  const fields: { name: string; originalKey: string; type: 'C' | 'N'; length: number; decimals: number }[] = [];
  if (properties.length === 0) return fields;

  const keys = Object.keys(properties[0]);
  for (const key of keys) {
    let isNumeric = true;
    let maxByteLen = 0;
    let maxDecimals = 0;
    for (const p of properties) {
      const val = p[key];
      const strVal = String(val ?? '');
      const byteLen = utf8ByteLength(strVal);
      maxByteLen = Math.max(maxByteLen, byteLen);
      if (typeof val !== 'number') isNumeric = false;
      else {
        const decimals = (strVal.split('.')[1] || '').length;
        maxDecimals = Math.max(maxDecimals, decimals);
      }
    }
    if (isNumeric) {
      fields.push({
        name: key.substring(0, 10),
        originalKey: key,
        type: 'N',
        length: Math.max(4, Math.min(18, maxByteLen + 2)),
        decimals: Math.min(8, maxDecimals),
      });
    } else {
      fields.push({
        name: key.substring(0, 10),
        originalKey: key,
        type: 'C',
        length: Math.max(1, Math.min(254, maxByteLen)),
        decimals: 0,
      });
    }
  }
  return fields;
};

const writeDBF = (properties: Record<string, string | number>[]): Uint8Array => {
  const fields = getFieldDefs(properties);
  const headerSize = 32 + fields.length * 32 + 1;
  const recordSize = 1 + fields.reduce((sum, f) => sum + f.length, 0);
  const totalSize = headerSize + properties.length * recordSize + 1;

  const buffer = Buffer.alloc(totalSize);

  buffer.writeUInt8(0x03, 0);
  const now = new Date();
  buffer.writeUInt8(now.getFullYear() - 1900, 1);
  buffer.writeUInt8(now.getMonth() + 1, 2);
  buffer.writeUInt8(now.getDate(), 3);
  writeInt32LE(buffer, 4, properties.length);
  writeInt32LE(buffer, 8, headerSize);
  writeInt32LE(buffer, 12, recordSize);

  let offset = 32;
  for (const f of fields) {
    buffer.write(padStringUtf8(f.name, 11), offset, 'utf8');
    offset += 11;
    buffer.write(f.type, offset, 'ascii');
    offset += 1;
    offset += 4;
    buffer.writeUInt8(f.length, offset);
    offset += 1;
    buffer.writeUInt8(f.decimals, offset);
    offset += 1;
    offset += 14;
  }
  buffer.writeUInt8(0x0D, offset);

  offset = headerSize;
  for (const p of properties) {
    buffer.writeUInt8(0x20, offset);
    offset += 1;
    for (const f of fields) {
      const rawVal = p[f.originalKey] ?? '';
      let strVal: string;
      if (f.type === 'N') {
        const num = Number(rawVal) || 0;
        strVal = padStringUtf8(num.toFixed(f.decimals), f.length);
      } else {
        strVal = padStringUtf8(String(rawVal), f.length);
      }
      buffer.write(strVal, offset, 'utf8');
      offset += f.length;
    }
  }
  buffer.writeUInt8(0x1A, offset);

  return new Uint8Array(buffer);
};

const writeShpShx = (features: ShapeFeature[], shapeType: number): { shp: Uint8Array; shx: Uint8Array } => {
  const bbox = computeBBox(features);
  const [minX, minY, maxX, maxY] = bbox;

  const records: { content: Buffer; offsetWords: number; lengthWords: number }[] = [];
  let fileOffsetBytes = 100;

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    let content: Buffer;

    if (shapeType === 1) {
      content = Buffer.alloc(20);
      writeInt32LE(content, 0, 1);
      writeDoubleLE(content, 4, f.points![0].x);
      writeDoubleLE(content, 12, f.points![0].y);
    } else if (shapeType === 3 || shapeType === 5) {
      const parts = f.parts || [0];
      const nPoints = f.points!.length;
      const fb = computeBBox([f]);
      content = Buffer.alloc(44 + parts.length * 4 + nPoints * 16);
      writeInt32LE(content, 0, shapeType);
      writeDoubleLE(content, 4, fb[0]);
      writeDoubleLE(content, 12, fb[1]);
      writeDoubleLE(content, 20, fb[2]);
      writeDoubleLE(content, 28, fb[3]);
      writeInt32LE(content, 36, parts.length);
      writeInt32LE(content, 40, nPoints);
      let pOff = 44;
      for (const part of parts) {
        writeInt32LE(content, pOff, part);
        pOff += 4;
      }
      for (const pt of f.points!) {
        writeDoubleLE(content, pOff, pt.x);
        writeDoubleLE(content, pOff + 8, pt.y);
        pOff += 16;
      }
    } else {
      content = Buffer.alloc(0);
    }

    const contentLenWords = Math.ceil(content.length / 2);
    const offsetWords = fileOffsetBytes / 2;

    records.push({ content, offsetWords, lengthWords: contentLenWords });
    fileOffsetBytes += 8 + content.length;
  }

  const totalShpBytes = fileOffsetBytes;
  const shpBuffer = Buffer.alloc(totalShpBytes);

  writeInt32BE(shpBuffer, 0, 9994);
  writeInt32BE(shpBuffer, 24, totalShpBytes / 2);
  writeInt32LE(shpBuffer, 28, 1000);
  writeInt32LE(shpBuffer, 32, shapeType);
  writeDoubleLE(shpBuffer, 36, minX);
  writeDoubleLE(shpBuffer, 44, minY);
  writeDoubleLE(shpBuffer, 52, maxX);
  writeDoubleLE(shpBuffer, 60, maxY);
  writeDoubleLE(shpBuffer, 68, 0);
  writeDoubleLE(shpBuffer, 76, 0);

  let shpOffset = 100;
  const shxRecords: { offset: number; length: number }[] = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    writeInt32BE(shpBuffer, shpOffset, i);
    writeInt32BE(shpBuffer, shpOffset + 4, r.lengthWords);
    r.content.copy(shpBuffer, shpOffset + 8);
    shxRecords.push({ offset: r.offsetWords, length: r.lengthWords });
    shpOffset += 8 + r.content.length;
  }

  const shxBuffer = Buffer.alloc(100 + shxRecords.length * 8);
  shpBuffer.copy(shxBuffer, 0, 0, 100);
  writeInt32BE(shxBuffer, 24, (100 + shxRecords.length * 8) / 2);
  let shxOffset = 100;
  for (const r of shxRecords) {
    writeInt32BE(shxBuffer, shxOffset, r.offset);
    writeInt32BE(shxBuffer, shxOffset + 4, r.length);
    shxOffset += 8;
  }

  return { shp: new Uint8Array(shpBuffer), shx: new Uint8Array(shxBuffer) };
};

const PRJ_WKT: Record<string, string> = {
  WGS84: `GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]`,
  CGCS2000: `GEOGCS["China Geodetic Coordinate System 2000",DATUM["D_China_2000",SPHEROID["CGCS2000",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]`,
};

export const getPrjWkt = (crs: string): string => {
  return PRJ_WKT[crs] || PRJ_WKT.WGS84;
};

export const createShapefileFiles = (
  features: ShapeFeature[],
  layerName: string,
  crs: string = 'WGS84'
): { shp: Uint8Array; shx: Uint8Array; dbf: Uint8Array; prj: string; cpg: string } => {
  if (!features || features.length === 0) {
    throw new Error(`图层 ${layerName} 没有可导出的要素`);
  }

  let shapeType: number;
  if (features[0].type === 'point') shapeType = 1;
  else if (features[0].type === 'polyline') shapeType = 3;
  else shapeType = 5;

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    if (!f.points || f.points.length === 0) {
      throw new Error(`第 ${i} 个要素没有坐标点`);
    }
    if ((shapeType === 3 || shapeType === 5) && (!f.parts || f.parts.length === 0)) {
      f.parts = [0];
    }
  }

  const { shp, shx } = writeShpShx(features, shapeType);
  const dbf = writeDBF(features.map(f => f.properties));
  const prj = getPrjWkt(crs);
  const cpg = 'UTF-8';

  return { shp, shx, dbf, prj, cpg };
};

export const exportShapefile = async (
  features: ShapeFeature[],
  layerName: string,
  crs: string = 'WGS84'
): Promise<Blob> => {
  const { shp, shx, dbf, prj, cpg } = createShapefileFiles(features, layerName, crs);

  const zip = new JSZip();
  zip.file(`${layerName}.shp`, shp);
  zip.file(`${layerName}.shx`, shx);
  zip.file(`${layerName}.dbf`, dbf);
  zip.file(`${layerName}.prj`, prj);
  zip.file(`${layerName}.cpg`, cpg);

  return await zip.generateAsync({ type: 'blob' });
};

export const buildCombinedZip = async (
  layers: {
    features: ShapeFeature[];
    layerName: string;
  }[],
  crs: string = 'WGS84',
  outputName: string = 'ocean_viz_export'
): Promise<Blob> => {
  const zip = new JSZip();
  const validLayers: { layerName: string; count: number }[] = [];

  for (const layer of layers) {
    if (!layer.features || layer.features.length === 0) continue;
    try {
      const { shp, shx, dbf, prj, cpg } = createShapefileFiles(layer.features, layer.layerName, crs);
      zip.folder(layer.layerName);
      zip.file(`${layer.layerName}/${layer.layerName}.shp`, shp);
      zip.file(`${layer.layerName}/${layer.layerName}.shx`, shx);
      zip.file(`${layer.layerName}/${layer.layerName}.dbf`, dbf);
      zip.file(`${layer.layerName}/${layer.layerName}.prj`, prj);
      zip.file(`${layer.layerName}/${layer.layerName}.cpg`, cpg);
      validLayers.push({ layerName: layer.layerName, count: layer.features.length });
    } catch (e) {
      console.warn(`图层 ${layer.layerName} 导出失败:`, e);
    }
  }

  if (validLayers.length === 0) {
    throw new Error('没有可导出的有效图层');
  }

  const metaContent = [
    '海洋水文数据可视化 - Shapefile 导出说明',
    `生成时间: ${new Date().toLocaleString('zh-CN')}`,
    `坐标系: ${crs}`,
    `图层数量: ${validLayers.length}`,
    '',
    '图层清单:',
    ...validLayers.map(l => `  · ${l.layerName} (${l.count} 个要素)`),
    '',
    '编码说明:',
    '  · DBF 属性表: UTF-8 编码（.cpg 文件标识）',
    '  · PRJ 投影: 标准 WKT 格式',
    '  · SHP 几何: ESRI Shapefile 标准',
  ].join('\r\n');

  zip.file('readme.txt', metaContent);

  return await zip.generateAsync({ type: 'blob' });
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export type { ShapeFeature, ShapePoint };
