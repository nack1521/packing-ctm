import { PackingItem } from './packing-item';
import { intersect, set2Decimal } from './utils';
import { Axis } from './constants';

interface FitItem {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  z1: number;
  z2: number;
}

export class PackingBin {
  partno: string;
  width: number;
  height: number;
  depth: number;
  max_weight: number;
  corner: number;
  items: PackingItem[];
  fit_items: FitItem[];
  unfitted_items: PackingItem[];
  number_of_decimals: number;
  fix_point: boolean;
  check_stable: boolean;
  support_surface_ratio: number;
  put_type: number;

  constructor(
    partno: string,
    WHD: [number, number, number],
    max_weight: number,
    corner: number = 0,
    put_type: number = 1
  ) {
    this.partno = partno;
    this.width = WHD[0];
    this.height = WHD[1];
    this.depth = WHD[2];
    this.max_weight = max_weight;
    this.corner = corner;
    this.items = [];
    this.fit_items = [{ x1: 0, x2: WHD[0], y1: 0, y2: WHD[1], z1: 0, z2: 0 }];
    this.unfitted_items = [];
    this.number_of_decimals = 0;
    this.fix_point = false;
    this.check_stable = false;
    this.support_surface_ratio = 0;
    this.put_type = put_type;
  }

  formatNumbers(number_of_decimals: number): void {
    this.width = set2Decimal(this.width, number_of_decimals);
    this.height = set2Decimal(this.height, number_of_decimals);
    this.depth = set2Decimal(this.depth, number_of_decimals);
    this.max_weight = set2Decimal(this.max_weight, number_of_decimals);
    this.number_of_decimals = number_of_decimals;
  }

  string(): string {
    return `${this.partno}(${this.width}x${this.height}x${this.depth}, max_weight:${this.max_weight}) vol(${this.getVolume()})`;
  }

  getVolume(): number {
    return set2Decimal(this.width * this.height * this.depth, this.number_of_decimals);
  }

  getTotalWeight(): number {
    let total_weight = 0;
    for (const item of this.items) {
      total_weight += item.weight;
    }
    return set2Decimal(total_weight, this.number_of_decimals);
  }

  putItem(item: PackingItem, pivot: [number, number, number], axis?: Axis): boolean {
    let fit = false;
    const valid_item_position = [...item.position] as [number, number, number];
    item.position = pivot;
    
    const rotations = item.getAvailableRotations();
    
    for (let i = 0; i < rotations.length; i++) {
      item.rotation_type = rotations[i];
      const dimension = item.getDimension();
      
      
      // Check if item fits in bin
      if (
        this.width < pivot[0] + dimension[0] ||
        this.height < pivot[1] + dimension[1] ||
        this.depth < pivot[2] + dimension[2]
      ) {
        continue;
      }

      fit = true;
      
      // Check intersection with other items
      for (const current_item_in_bin of this.items) {
        if (intersect(current_item_in_bin, item)) {
          fit = false;
          break;
        }
      }

      if (fit) {
        // Check weight constraint
        if (this.getTotalWeight() + item.weight > this.max_weight) {
          console.log(`    ❌ Exceeds weight limit: ${this.getTotalWeight() + item.weight} > ${this.max_weight}`);
          fit = false;
          return fit;
        }

        // Apply position fixing if enabled
        if (this.fix_point) {
          const [w, h, d] = dimension;
          let [x, y, z] = [pivot[0], pivot[1], pivot[2]];

          // Fix position through multiple iterations
          for (let iter = 0; iter < 3; iter++) {
            y = this.checkHeight([x, x + w, y, y + h, z, z + d]);
            x = this.checkWidth([x, x + w, y, y + h, z, z + d]);
            z = this.checkDepth([x, x + w, y, y + h, z, z + d]);
          }

          // Check stability if enabled
          if (this.check_stable) {
            const item_area_lower = dimension[0] * dimension[1];
            let support_area_upper = 0;

            for (const fitItem of this.fit_items) {
              if (z === fitItem.z2) {
                const x_overlap = Math.max(0, Math.min(x + w, fitItem.x2) - Math.max(x, fitItem.x1));
                const y_overlap = Math.max(0, Math.min(y + h, fitItem.y2) - Math.max(y, fitItem.y1));
                support_area_upper += x_overlap * y_overlap;
              }
            }

            if (support_area_upper / item_area_lower < this.support_surface_ratio) {
              const four_vertices = [
                [x, y], [x + w, y], [x, y + h], [x + w, y + h]
              ];
              
              const supported = [false, false, false, false];
              for (const fitItem of this.fit_items) {
                if (z === fitItem.z2) {
                  for (let j = 0; j < four_vertices.length; j++) {
                    const [vx, vy] = four_vertices[j];
                    if (fitItem.x1 <= vx && vx <= fitItem.x2 && 
                        fitItem.y1 <= vy && vy <= fitItem.y2) {
                      supported[j] = true;
                    }
                  }
                }
              }
              
              if (supported.includes(false)) {
                item.position = valid_item_position;
                fit = false;
                return fit;
              }
            }
          }

          this.fit_items.push({
            x1: x, x2: x + w, y1: y, y2: y + h, z1: z, z2: z + d
          });
          item.position = [set2Decimal(x), set2Decimal(y), set2Decimal(z)];
        }

        if (fit) {
          this.items.push(this.deepCopyItem(item));
          console.log(`    ✅ Successfully placed ${item.partno} with rotation ${i + 1} (type: ${rotations[i]})`);
        }
      } else {
        item.position = valid_item_position;
      }

      return fit;
    }

    item.position = valid_item_position;
    return fit;
  }

  private checkDepth(unfix_point: number[]): number {
    const z_ranges: [number, number][] = [[0, 0], [this.depth, this.depth]];
    
    for (const fitItem of this.fit_items) {
      const x_overlap = this.hasOverlap(unfix_point[0], unfix_point[1], fitItem.x1, fitItem.x2);
      const y_overlap = this.hasOverlap(unfix_point[2], unfix_point[3], fitItem.y1, fitItem.y2);
      
      if (x_overlap && y_overlap) {
        z_ranges.push([fitItem.z1, fitItem.z2]);
      }
    }
    
    const top_depth = unfix_point[5] - unfix_point[4];
    z_ranges.sort((a, b) => a[1] - b[1]);
    
    for (let j = 0; j < z_ranges.length - 1; j++) {
      if (z_ranges[j + 1][0] - z_ranges[j][1] >= top_depth) {
        return z_ranges[j][1];
      }
    }
    
    return unfix_point[4];
  }

  private checkWidth(unfix_point: number[]): number {
    const x_ranges: [number, number][] = [[0, 0], [this.width, this.width]];
    
    for (const fitItem of this.fit_items) {
      const z_overlap = this.hasOverlap(unfix_point[4], unfix_point[5], fitItem.z1, fitItem.z2);
      const y_overlap = this.hasOverlap(unfix_point[2], unfix_point[3], fitItem.y1, fitItem.y2);
      
      if (z_overlap && y_overlap) {
        x_ranges.push([fitItem.x1, fitItem.x2]);
      }
    }
    
    const top_width = unfix_point[1] - unfix_point[0];
    x_ranges.sort((a, b) => a[1] - b[1]);
    
    for (let j = 0; j < x_ranges.length - 1; j++) {
      if (x_ranges[j + 1][0] - x_ranges[j][1] >= top_width) {
        return x_ranges[j][1];
      }
    }
    
    return unfix_point[0];
  }

  private checkHeight(unfix_point: number[]): number {
    const y_ranges: [number, number][] = [[0, 0], [this.height, this.height]];
    
    for (const fitItem of this.fit_items) {
      const x_overlap = this.hasOverlap(unfix_point[0], unfix_point[1], fitItem.x1, fitItem.x2);
      const z_overlap = this.hasOverlap(unfix_point[4], unfix_point[5], fitItem.z1, fitItem.z2);
      
      if (x_overlap && z_overlap) {
        y_ranges.push([fitItem.y1, fitItem.y2]);
      }
    }
    
    const top_height = unfix_point[3] - unfix_point[2];
    y_ranges.sort((a, b) => a[1] - b[1]);
    
    for (let j = 0; j < y_ranges.length - 1; j++) {
      if (y_ranges[j + 1][0] - y_ranges[j][1] >= top_height) {
        return y_ranges[j][1];
      }
    }
    
    return unfix_point[2];
  }

  private hasOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
    return Math.max(start1, start2) < Math.min(end1, end2);
  }

  private deepCopyItem(item: PackingItem): PackingItem {
    const newItem = new PackingItem(
      item.partno,
      item.name,
      item.itemType,
      [item.width, item.height, item.depth],
      item.weight,
      item.level,
      item.loadbear,
      item.updown,
      item.color
    );
    
    newItem.rotation_type = item.rotation_type;
    newItem.position = [...item.position] as [number, number, number];
    newItem.number_of_decimals = item.number_of_decimals;
    
    return newItem;
  }

  clearBin(): void {
    this.items = [];
    this.fit_items = [{ x1: 0, x2: this.width, y1: 0, y2: this.height, z1: 0, z2: 0 }];
  }
}
