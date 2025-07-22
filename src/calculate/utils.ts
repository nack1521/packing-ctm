export function intersect(item1: PackingItem, item2: PackingItem): boolean {
  const dim1 = item1.getDimension();
  const dim2 = item2.getDimension();
  
  const [x1, y1, z1] = item1.position;
  const [x2, y2, z2] = item2.position;
  
  const [w1, h1, d1] = dim1;
  const [w2, h2, d2] = dim2;

  return !(
    x1 + w1 <= x2 || x2 + w2 <= x1 ||
    y1 + h1 <= y2 || y2 + h2 <= y1 ||
    z1 + d1 <= z2 || z2 + d2 <= z1
  );
}

export function set2Decimal(value: number, decimals: number = 0): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

import { PackingItem } from './packing-item';
