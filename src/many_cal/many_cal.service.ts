import { Injectable } from '@nestjs/common';
import { CreateManyCalDto } from './dto/create-many_cal.dto';
import { UpdateManyCalDto } from './dto/update-many_cal.dto';
import { CalculateService, PackageInput, BasketInput } from '../calculate/calculate.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Package } from '../packages/schemas/package.schema';

export interface ManyCalPackageInput extends PackageInput {
  _id: string;
  package_status: string;
}

export interface ManyCalResult {
  success: boolean;
  total_quantity: number;
  packed_quantity: number;
  unpacked_quantity: number;
  baskets_used: number;
  package_details: {
    package_id: string;
    total_quantity: number;
    packed_quantity: number;
    unpacked_quantity: number;
  };
  basket_details: Array<{
    basket_id: string;
    basket_size: string;
    quantity_packed: number;
    total_weight: number;
    volume_utilization: number;
    packing_success_rate: number;
  }>;
  message: string;
}

@Injectable()
export class ManyCalService {
  constructor(
    private readonly calculateService: CalculateService,
    @InjectModel(Package.name) private packageModel: Model<Package>
  ) {}

  /**
   * Pack one package type across multiple baskets - many_cal logic
   * - One package (1:m) gets split across multiple baskets
   * - Each basket contains only 1 package type
   * - No re-packing - failed quantities get status "unpack"
   * - Continue packing until all quantity is packed or no more can fit
   */
  async packManyCal(packageData: ManyCalPackageInput, basketOptions: BasketInput[]): Promise<ManyCalResult> {
    console.log(`Starting many_cal packing for package ${packageData._id} with quantity ${packageData.quantity}...`);
    
    if (!packageData || packageData.quantity <= 0) {
      return {
        success: false,
        total_quantity: 0,
        packed_quantity: 0,
        unpacked_quantity: 0,
        baskets_used: 0,
        package_details: {
          package_id: packageData?._id || '',
          total_quantity: 0,
          packed_quantity: 0,
          unpacked_quantity: 0
        },
        basket_details: [],
        message: 'Invalid package data or quantity'
      };
    }

    // Try each basket size to find the best option
    for (const basketOption of basketOptions) {
      console.log(`Trying basket size: ${basketOption.basket_size_id}`);
      
      const result = await this.tryPackageInBaskets(packageData, basketOption);
      
      if (result.success && result.packed_quantity > 0) {
        console.log(`✓ Successfully packed ${result.packed_quantity}/${result.total_quantity} quantity using basket size: ${basketOption.basket_size_id}`);
        
        // Update package status in database
        await this.updatePackageStatus(packageData._id, result.packed_quantity, result.unpacked_quantity);
        
        return result;
      }
    }

    // If no basket size worked, mark all quantity as unpacked
    console.log('× No basket size could pack the package successfully');
    await this.updatePackageStatus(packageData._id, 0, packageData.quantity);

    return {
      success: false,
      total_quantity: packageData.quantity,
      packed_quantity: 0,
      unpacked_quantity: packageData.quantity,
      baskets_used: 0,
      package_details: {
        package_id: packageData._id,
        total_quantity: packageData.quantity,
        packed_quantity: 0,
        unpacked_quantity: packageData.quantity
      },
      basket_details: [],
      message: 'No suitable basket size found for the package'
    };
  }

  /**
   * Try to pack package quantity across multiple baskets of same size
   */
  private async tryPackageInBaskets(packageData: ManyCalPackageInput, basketOption: BasketInput): Promise<ManyCalResult> {
    const baskets: Array<{
      basket_id: string;
      basket_size: string;
      quantity_packed: number;
      total_weight: number;
      volume_utilization: number;
      packing_success_rate: number;
    }> = [];

    let totalPackedQuantity = 0;
    let remainingQuantity = packageData.quantity;
    let basketIndex = 1;

    // Keep creating baskets until all quantity is packed or no more can fit
    while (remainingQuantity > 0) {
      const basketId = `${basketOption.basket_size_id}_${basketIndex}`;
      console.log(`  Trying basket ${basketId} with ${remainingQuantity} remaining quantity`);

      // Create a package input with remaining quantity for this basket
      const packageForThisBasket = {
        ...packageData,
        quantity: remainingQuantity
      };

      // Try to pack as much quantity as possible in this basket
      const packingResult = await this.calculateService.calculatePacking([packageForThisBasket], basketOption);

      if (packingResult.fitted_items === 0) {
        // No items could fit in this basket - stop trying
        console.log(`  × No items could fit in basket ${basketId}`);
        break;
      }

      // Calculate how much quantity was actually packed
      const quantityPackedInBasket = packingResult.fitted_items;
      remainingQuantity -= quantityPackedInBasket;
      totalPackedQuantity += quantityPackedInBasket;

      // Add basket to results
      baskets.push({
        basket_id: basketId,
        basket_size: basketOption.basket_size_id,
        quantity_packed: quantityPackedInBasket,
        total_weight: packingResult.total_weight,
        volume_utilization: packingResult.basket_utilization,
        packing_success_rate: 100 // Since we only count successfully fitted items
      });

      console.log(`  ✓ Basket ${basketId}: packed ${quantityPackedInBasket} items`);
      basketIndex++;

      // Stop after reasonable number of baskets to prevent infinite loop
      if (basketIndex > 20) {
        console.log(`  ! Stopped after 20 baskets to prevent infinite loop`);
        break;
      }
    }

    const success = totalPackedQuantity > 0;
    const unpackedQuantity = packageData.quantity - totalPackedQuantity;

    return {
      success: success,
      total_quantity: packageData.quantity,
      packed_quantity: totalPackedQuantity,
      unpacked_quantity: unpackedQuantity,
      baskets_used: baskets.length,
      package_details: {
        package_id: packageData._id,
        total_quantity: packageData.quantity,
        packed_quantity: totalPackedQuantity,
        unpacked_quantity: unpackedQuantity
      },
      basket_details: baskets,
      message: success 
        ? `Successfully packed ${totalPackedQuantity}/${packageData.quantity} quantity in ${baskets.length} baskets`
        : 'No quantity could be packed'
    };
  }

  /**
   * Update package status in database based on packing results
   */
  private async updatePackageStatus(packageId: string, packedQuantity: number, unpackedQuantity: number): Promise<void> {
    try {
      let newStatus = 'Unpack';
      
      if (packedQuantity > 0) {
        if (unpackedQuantity > 0) {
          // Partially packed
          newStatus = 'Partially Packed';
        } else {
          // Fully packed
          newStatus = 'Packed';
        }
      }

      await this.packageModel.updateOne(
        { _id: packageId },
        { 
          package_status: newStatus,
          packed_quantity: packedQuantity,
          unpacked_quantity: unpackedQuantity
        }
      );

      console.log(`✓ Updated package ${packageId} status to "${newStatus}" (packed: ${packedQuantity}, unpacked: ${unpackedQuantity})`);
    } catch (error) {
      console.error('Error updating package status:', error);
    }
  }

  /**
   * Calculate optimal basket size for a package
   */
  async findOptimalBasketForPackage(packageData: ManyCalPackageInput, basketOptions: BasketInput[]): Promise<{
    optimal_basket?: BasketInput;
    packing_result?: ManyCalResult;
    alternatives: Array<{
      basket: BasketInput;
      result: ManyCalResult;
    }>;
  }> {
    const results: Array<{
      basket: BasketInput;
      result: ManyCalResult;
    }> = [];

    // Try each basket size
    for (const basket of basketOptions) {
      const packingResult = await this.tryPackageInBaskets(packageData, basket);
      results.push({
        basket,
        result: packingResult
      });
    }

    // Sort by success, then by packed quantity, then by baskets used (fewer is better), then by cost
    results.sort((a, b) => {
      // First priority: success
      if (a.result.success !== b.result.success) {
        return a.result.success ? -1 : 1;
      }

      // Second priority: packed quantity (more is better)
      if (a.result.packed_quantity !== b.result.packed_quantity) {
        return b.result.packed_quantity - a.result.packed_quantity;
      }

      // Third priority: fewer baskets used (more efficient)
      if (a.result.baskets_used !== b.result.baskets_used) {
        return a.result.baskets_used - b.result.baskets_used;
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

  create(createManyCalDto: CreateManyCalDto) {
    return 'This action adds a new manyCal';
  }

  findAll() {
    return `This action returns all manyCal`;
  }

  findOne(id: number) {
    return `This action returns a #${id} manyCal`;
  }

  update(id: number, updateManyCalDto: UpdateManyCalDto) {
    return `This action updates a #${id} manyCal`;
  }

  remove(id: number) {
    return `This action removes a #${id} manyCal`;
  }
}
