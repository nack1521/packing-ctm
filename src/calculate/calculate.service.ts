import { Injectable } from '@nestjs/common';
import { Packer, PackingResult } from './packer';
import { PackingItem } from './packing-item';
import { PackingBin } from './packing-bin';

export interface PackageInput {
  _id?: string;
  product_id: string;
  weight: number;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  quantity: number;
  package_type: string;
  package_status: string;
  cost: number;
}

export interface BasketInput {
  basket_size_id: string;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  max_weight: number;
  cost: number;
}

export interface PackingCalculation {
  success: boolean;
  strategy_used?: string;
  fitted_items: number;
  total_items: number;
  fitted_packages: Array<{
    package_id: string;
    position: [number, number, number];
    rotation_type: number;
    dimensions: [number, number, number];
  }>;
  unfitted_packages: string[];
  total_weight: number;
  total_volume: number;
  basket_utilization: number;
}

@Injectable()
export class CalculateService {

  /**
   * Calculate optimal packing for packages in a basket
   */
  async calculatePacking(packages: PackageInput[], basket: BasketInput): Promise<PackingCalculation> {
    try {
      // Convert packages to packing items
      const packingItems = this.convertPackagesToPackingItems(packages);
      
      // Get basket dimensions
      const basketDimensions: [number, number, number] = [
        basket.dimensions.width,
        basket.dimensions.height,
        basket.dimensions.depth
      ];

      // 🔍 DEBUG: Log detailed dimensions for packing algorithm
      console.log(`\n🔍 === CALCULATE SERVICE DEBUG ===`);
      console.log(`📦 BASKET DIMENSIONS: ${basketDimensions[0]}×${basketDimensions[1]}×${basketDimensions[2]} (max weight: ${basket.max_weight})`);
      console.log(`📦 PACKAGES TO PACK:`);
      packingItems.slice(0, 5).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.partno}: ${item.width}×${item.height}×${item.depth} (weight: ${item.weight}g, updown: ${item.updown})`);
      });
      if (packingItems.length > 5) {
        console.log(`  ... and ${packingItems.length - 5} more packages`);
      }
      console.log(`🔍 === END CALCULATE SERVICE DEBUG ===\n`);

      // Create packer instance
      const packer = new Packer();

      // Use the multi-strategy packing
      const result = packer.packWithStrategies(
        packingItems,
        basketDimensions,
        basket.max_weight
      );

      // Convert result to our format
      return this.convertPackingResult(result, packages, basket);

    } catch (error) {
      console.error('Error in calculatePacking:', error);
      return {
        success: false,
        fitted_items: 0,
        total_items: packages.length,
        fitted_packages: [],
        unfitted_packages: packages.map(p => p._id || p.product_id),
        total_weight: 0,
        total_volume: 0,
        basket_utilization: 0
      };
    }
  }

  /**
   * Calculate if packages can fit in multiple basket sizes
   */
  async findOptimalBasket(packages: PackageInput[], baskets: BasketInput[]): Promise<{
    optimal_basket?: BasketInput;
    packing_result?: PackingCalculation;
    alternatives: Array<{
      basket: BasketInput;
      result: PackingCalculation;
    }>;
  }> {
    const results: Array<{
      basket: BasketInput;
      result: PackingCalculation;
    }> = [];

    // Try each basket size
    for (const basket of baskets) {
      const packingResult = await this.calculatePacking(packages, basket);
      results.push({
        basket,
        result: packingResult
      });
    }

    // Sort by success, then by utilization, then by cost
    results.sort((a, b) => {
      // First priority: success
      if (a.result.success !== b.result.success) {
        return a.result.success ? -1 : 1;
      }

      // Second priority: fitted items (more is better)
      if (a.result.fitted_items !== b.result.fitted_items) {
        return b.result.fitted_items - a.result.fitted_items;
      }

      // Third priority: utilization (higher is better)
      if (a.result.basket_utilization !== b.result.basket_utilization) {
        return b.result.basket_utilization - a.result.basket_utilization;
      }

      // Fourth priority: cost (lower is better)
      return a.basket.cost - b.basket.cost;
    });

    const optimal = results[0];

    return {
      optimal_basket: optimal.basket,
      packing_result: optimal.result,
      alternatives: results
    };
  }

  /**
   * Convert package data to packing items
   */
  private convertPackagesToPackingItems(packages: PackageInput[]): PackingItem[] {
    const packingItems: PackingItem[] = [];

    packages.forEach((pkg, index) => {
      for (let i = 0; i < pkg.quantity; i++) {
        const item = new PackingItem(
          `${pkg._id || pkg.product_id}_${i}`,
          pkg.package_type || 'Package',
          'cube', // Set to 'cube' to enable all 6 rotations
          [pkg.dimensions.width, pkg.dimensions.height, pkg.dimensions.depth],
          pkg.weight,
          1, // level
          pkg.weight * 10, // loadbear
          true, // updown - allow rotation
          '#3498db' // default color
        );

        packingItems.push(item);
      }
    });

    return packingItems;
  }

  /**
   * Convert packing result to our calculation format
   */
  private convertPackingResult(
    result: PackingResult,
    originalPackages: PackageInput[],
    basket: BasketInput
  ): PackingCalculation {
    const fittedPackages: Array<{
      package_id: string;
      position: [number, number, number];
      rotation_type: number;
      dimensions: [number, number, number];
    }> = [];

    let totalWeight = 0;
    let totalVolume = 0;

    // Process fitted items
    if (result.bin && result.bin.items) {
      for (const item of result.bin.items) {
        fittedPackages.push({
          package_id: item.partno,
          position: item.position,
          rotation_type: item.rotation_type,
          dimensions: item.getDimension()
        });

        totalWeight += item.weight;
        totalVolume += item.getVolume();
      }
    }

    // Calculate unfitted packages
    const unfittedPackages: string[] = [];
    if (result.unfitted_items) {
      unfittedPackages.push(...result.unfitted_items.map(item => item.partno));
    }

    // Calculate basket utilization
    const basketVolume = basket.dimensions.width * basket.dimensions.height * basket.dimensions.depth;
    const basketUtilization = basketVolume > 0 ? (totalVolume / basketVolume) * 100 : 0;

    return {
      success: result.success,
      strategy_used: result.strategy_used,
      fitted_items: result.fitted_items,
      total_items: result.total_items,
      fitted_packages: fittedPackages,
      unfitted_packages: unfittedPackages,
      total_weight: Math.round(totalWeight * 100) / 100,
      total_volume: Math.round(totalVolume * 100) / 100,
      basket_utilization: Math.round(basketUtilization * 100) / 100
    };
  }

  /**
   * Get packing statistics
   */
  async getPackingStats(packages: PackageInput[]): Promise<{
    total_packages: number;
    total_weight: number;
    total_volume: number;
    heaviest_package: number;
    largest_package: number;
    average_density: number;
  }> {
    let totalWeight = 0;
    let totalVolume = 0;
    let heaviest = 0;
    let largest = 0;

    for (const pkg of packages) {
      const packageWeight = pkg.weight * pkg.quantity;
      const packageVolume = pkg.dimensions.width * pkg.dimensions.height * pkg.dimensions.depth * pkg.quantity;

      totalWeight += packageWeight;
      totalVolume += packageVolume;

      if (pkg.weight > heaviest) {
        heaviest = pkg.weight;
      }

      const pkgVolume = pkg.dimensions.width * pkg.dimensions.height * pkg.dimensions.depth;
      if (pkgVolume > largest) {
        largest = pkgVolume;
      }
    }

    const averageDensity = totalVolume > 0 ? totalWeight / totalVolume : 0;

    return {
      total_packages: packages.reduce((sum, pkg) => sum + pkg.quantity, 0),
      total_weight: Math.round(totalWeight * 100) / 100,
      total_volume: Math.round(totalVolume * 100) / 100,
      heaviest_package: heaviest,
      largest_package: largest,
      average_density: Math.round(averageDensity * 1000) / 1000
    };
  }
}
