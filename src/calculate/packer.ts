import { PackingItem } from './packing-item';
import { PackingBin } from './packing-bin';
import { Axis } from './constants';

export interface PackingStrategy {
  name: string;
  params: {
    bigger_first: boolean;
    distribute_items: boolean;
    fix_point: boolean;
    check_stable: boolean;
    support_surface_ratio: number;
    number_of_decimals: number;
  };
}

export interface PackingResult {
  success: boolean;
  strategy_used?: string;
  fitted_items: number;
  total_items: number;
  bin?: PackingBin;
  unfitted_items: PackingItem[];
}

export class Packer {
  bins: PackingBin[];
  items: PackingItem[];
  unfit_items: PackingItem[];
  total_items: number;
  binding: string[][];

  constructor() {
    this.bins = [];
    this.items = [];
    this.unfit_items = [];
    this.total_items = 0;
    this.binding = [];
  }

  addBin(bin: PackingBin): void {
    this.bins.push(bin);
  }

  addItem(item: PackingItem): void {
    this.total_items = this.items.length + 1;
    this.items.push(item);
  }

  pack2Bin(
    bin: PackingBin,
    item: PackingItem,
    fix_point: boolean,
    check_stable: boolean,
    support_surface_ratio: number
  ): void {
    let fitted = false;
    bin.fix_point = fix_point;
    bin.check_stable = check_stable;
    bin.support_surface_ratio = support_surface_ratio;

    // If bin is empty, try to put item at origin
    if (bin.items.length === 0) {
      const response = bin.putItem(item, item.position);
      if (!response) {
        bin.unfitted_items.push(item);
      }
      return;
    }

    // Try to place item next to existing items
    for (let axis = 0; axis < 3; axis++) {
      const items_in_bin = bin.items;
      
      for (const ib of items_in_bin) {
        let pivot: [number, number, number] = [0, 0, 0];
        const dimension = ib.getDimension();
        const [w, h, d] = dimension;

        if (axis === Axis.WIDTH) {
          pivot = [ib.position[0] + w, ib.position[1], ib.position[2]];
        } else if (axis === Axis.HEIGHT) {
          pivot = [ib.position[0], ib.position[1] + h, ib.position[2]];
        } else if (axis === Axis.DEPTH) {
          pivot = [ib.position[0], ib.position[1], ib.position[2] + d];
        }

        if (bin.putItem(item, pivot, axis)) {
          fitted = true;
          break;
        }
      }
      if (fitted) {
        break;
      }
    }

    if (!fitted) {
      bin.unfitted_items.push(item);
    }
  }

  pack(
    bigger_first: boolean = false,
    distribute_items: boolean = true,
    fix_point: boolean = true,
    check_stable: boolean = true,
    support_surface_ratio: number = 0.75,
    binding: string[][] = [],
    number_of_decimals: number = 0
  ): void {
    // Set decimals
    for (const bin of this.bins) {
      bin.formatNumbers(number_of_decimals);
    }

    for (const item of this.items) {
      item.formatNumbers(number_of_decimals);
    }

    this.binding = binding;

    // Sort bins by volume
    this.bins.sort((a, b) => {
      const volumeA = a.getVolume();
      const volumeB = b.getVolume();
      return bigger_first ? volumeB - volumeA : volumeA - volumeB;
    });

    // Sort items by multiple criteria
    this.items.sort((a, b) => {
      const volumeA = a.getVolume();
      const volumeB = b.getVolume();
      return bigger_first ? volumeB - volumeA : volumeA - volumeB;
    });

    this.items.sort((a, b) => b.loadbear - a.loadbear);
    this.items.sort((a, b) => a.level - b.level);

    // Pack items into bins
    for (let idx = 0; idx < this.bins.length; idx++) {
      const bin = this.bins[idx];
      
      for (const item of this.items) {
        this.pack2Bin(bin, item, fix_point, check_stable, support_surface_ratio);
      }

      if (distribute_items) {
        // Remove fitted items from the items list
        for (const bitem of bin.items) {
          const index = this.items.findIndex(item => item.partno === bitem.partno);
          if (index !== -1) {
            this.items.splice(index, 1);
          }
        }
      }
    }

    // Put order of items in bins
    this.putOrder();

    // Add remaining items to unfit_items
    if (this.items.length > 0) {
      this.unfit_items.push(...this.items);
      this.items = [];
    }
  }

  putOrder(): void {
    for (const bin of this.bins) {
      if (bin.put_type === 2) {
        // Open top container
        bin.items.sort((a, b) => a.position[0] - b.position[0]);
        bin.items.sort((a, b) => a.position[1] - b.position[1]);
        bin.items.sort((a, b) => a.position[2] - b.position[2]);
      } else if (bin.put_type === 1) {
        // General container
        bin.items.sort((a, b) => a.position[1] - b.position[1]);
        bin.items.sort((a, b) => a.position[2] - b.position[2]);
        bin.items.sort((a, b) => a.position[0] - b.position[0]);
      }
    }
  }

  // Implement the multi-strategy packing similar to your Python version
  packWithStrategies(packages: PackingItem[], basketDimensions: [number, number, number], maxWeight: number): PackingResult {
    if (!packages || packages.length === 0) {
      return {
        success: false,
        fitted_items: 0,
        total_items: 0,
        unfitted_items: []
      };
    }

    // Validate dimensions
    if (basketDimensions.some(dim => dim <= 0)) {
      console.error(`Invalid basket dimensions: ${basketDimensions}`);
      return {
        success: false,
        fitted_items: 0,
        total_items: packages.length,
        unfitted_items: packages
      };
    }

    // Validate packages
    for (const pkg of packages) {
      if (pkg.width <= 0 || pkg.height <= 0 || pkg.depth <= 0 || pkg.weight <= 0) {
        console.error(`Invalid package dimensions for ${pkg.partno}: ${pkg.width}×${pkg.height}×${pkg.depth}, weight: ${pkg.weight}`);
        return {
          success: false,
          fitted_items: 0,
          total_items: packages.length,
          unfitted_items: packages
        };
      }
    }

    const packingStrategies: PackingStrategy[] = [
      {
        name: 'Primary Strategy',
        params: {
          bigger_first: true,
          distribute_items: false,
          fix_point: true,
          check_stable: true,
          support_surface_ratio: 0.75,
          number_of_decimals: 0
        }
      },
      {
        name: 'Relaxed Stability',
        params: {
          bigger_first: true,
          distribute_items: false,
          fix_point: true,
          check_stable: true,
          support_surface_ratio: 0.5,
          number_of_decimals: 0
        }
      },
      {
        name: 'Minimal Stability',
        params: {
          bigger_first: true,
          distribute_items: false,
          fix_point: true,
          check_stable: true,
          support_surface_ratio: 0.3,
          number_of_decimals: 0
        }
      },
      // {
      //   name: 'Basic Packing',
      //   params: {
      //     bigger_first: true,
      //     distribute_items: false,
      //     fix_point: false,
      //     check_stable: false,
      //     support_surface_ratio: 0.0,
      //     number_of_decimals: 0
      //   }
      // }
    ];

    let bestResult: PackingResult | null = null;
    let bestFittedCount = 0;
    let bestStrategy = '';

    // Try each strategy
    for (const strategy of packingStrategies) {
      console.log(`Trying ${strategy.name}...`);

      try {
        // Create new packer for this attempt
        const testPacker = new Packer();

        // Create bin
        const basketBin = new PackingBin(
          'Basket_Test',
          basketDimensions,
          maxWeight,
          0,
          1
        );
        testPacker.addBin(basketBin);

        // Add all packages
        for (const packageItem of packages) {
          testPacker.addItem(packageItem);
        }

        // Try packing with this strategy
        testPacker.pack(
          strategy.params.bigger_first,
          strategy.params.distribute_items,
          strategy.params.fix_point,
          strategy.params.check_stable,
          strategy.params.support_surface_ratio,
          [],
          strategy.params.number_of_decimals
        );

        // Check results
        if (testPacker.bins && testPacker.bins.length > 0) {
          const binObj = testPacker.bins[0];
          const fittedCount = binObj.items.length;

          console.log(`→ ${fittedCount}/${packages.length} items fitted`);

          // If this is the best result so far, save it
          if (fittedCount > bestFittedCount) {
            bestFittedCount = fittedCount;
            bestStrategy = strategy.name;
            bestResult = {
              success: fittedCount === packages.length,
              strategy_used: strategy.name,
              fitted_items: fittedCount,
              total_items: packages.length,
              bin: binObj,
              unfitted_items: binObj.unfitted_items
            };
          }

          // If we got everything packed, use this result
          if (fittedCount === packages.length) {
            console.log(`✓ ${strategy.name} packed all items successfully!`);
            return bestResult!;
          }
        }
      } catch (error) {
        console.error(`× ${strategy.name} failed:`, error);
        continue;
      }
    }

    // Use the best result we found
    if (bestResult && bestFittedCount > 0) {
      console.log(`✓ Best result: ${bestStrategy} packed ${bestFittedCount}/${packages.length} items`);
      return bestResult;
    }

    // If all strategies failed
    console.log('× All packing strategies failed');
    return {
      success: false,
      fitted_items: 0,
      total_items: packages.length,
      unfitted_items: packages
    };
  }
}
