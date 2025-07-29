import { Injectable } from '@nestjs/common';
import { CreateSingleCalDto } from './dto/create-single_cal.dto';
import { UpdateSingleCalDto } from './dto/update-single_cal.dto';
import { CalculateService, PackageInput, BasketInput } from '../calculate/calculate.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Package } from '../packages/schemas/package.schema';

export interface SingleCalPackageInput extends PackageInput {
  _id: string;
  package_status: string;
}

export interface SingleCalResult {
  success: boolean;
  cart_packed: boolean;
  total_packages: number;
  packed_packages: number;
  unpacked_packages: string[];
  cart_details: {
    cart_id: string;
    basket_size: string;
    baskets: Array<{
      basket_id: string;
      packages_allocated: number;
      packages_packed: number;
      packing_success_rate: number;
      total_weight: number;
      volume_utilization: number;
      packed_package_ids: string[];
    }>;
  };
  message: string;
}

@Injectable()
export class SingleCalService {
  constructor(
    private readonly calculateService: CalculateService,
    @InjectModel(Package.name) private packageModel: Model<Package>
  ) {}

  /**
   * Pack packages into baskets - single_cal logic
   * - Multiple packages (1:1) can fit in one basket
   * - Pack until basket is full
   * - No re-packing - failed packages get status "unpack"
   * - Stop when 1 cart is successfully packed
   */
  async packSingleCal(packages: SingleCalPackageInput[], basketOptions: BasketInput[]): Promise<SingleCalResult> {
    console.log(`Starting single_cal packing for ${packages.length} packages...`);
    
    if (!packages || packages.length === 0) {
      return {
        success: false,
        cart_packed: false,
        total_packages: 0,
        packed_packages: 0,
        unpacked_packages: [],
        cart_details: {
          cart_id: '',
          basket_size: '',
          baskets: []
        },
        message: 'No packages provided for packing'
      };
    }

    // Sort packages by priority (bigger first for better packing)
    const sortedPackages = [...packages].sort((a, b) => {
      const volumeA = a.dimensions.width * a.dimensions.height * a.dimensions.depth;
      const volumeB = b.dimensions.width * b.dimensions.height * b.dimensions.depth;
      return volumeB - volumeA;
    });

    // Try each basket size to find the best fit
    for (const basketOption of basketOptions) {
      
      const cartResult = await this.tryPackCart(sortedPackages, basketOption);
      
      if (cartResult.cart_packed) {
        
        // Update package statuses in database
        await this.updatePackageStatuses(
          cartResult.cart_details.baskets.flatMap(b => b.packed_package_ids), 
          cartResult.unpacked_packages
        );
        
        return cartResult;
      }
    }

    // If no basket size worked, mark all packages as unpacked
    await this.updatePackageStatuses([], packages.map(p => p._id));

    return {
      success: false,
      cart_packed: false,
      total_packages: packages.length,
      packed_packages: 0,
      unpacked_packages: packages.map(p => p._id),
      cart_details: {
        cart_id: '',
        basket_size: '',
        baskets: []
      },
      message: 'No suitable basket size found for the packages'
    };
  }

  /**
   * Try to pack packages into baskets of a specific size
   */
  private async tryPackCart(packages: SingleCalPackageInput[], basketOption: BasketInput): Promise<SingleCalResult> {
    const cartId = `cart_${basketOption.basket_size_id}_${Date.now()}`;
    const baskets: Array<{
      basket_id: string;
      packages_allocated: number;
      packages_packed: number;
      packing_success_rate: number;
      total_weight: number;
      volume_utilization: number;
      packed_package_ids: string[];
    }> = [];

    const allPackedIds: string[] = [];
    const remainingPackages = [...packages];
    let basketIndex = 1;

    // Keep creating baskets until all packages are packed or no more can fit
    while (remainingPackages.length > 0) {
      const basketId = `${basketOption.basket_size_id}_${basketIndex}`;

      // Try to pack as many packages as possible in this basket
      const packingResult = await this.calculateService.calculatePacking(remainingPackages, basketOption);

      if (packingResult.fitted_items === 0) {
        // No packages could fit in this basket - stop trying
        break;
      }

      // Get the IDs of successfully packed packages
      const packedInThisBasket: string[] = [];
      for (const fittedPackage of packingResult.fitted_packages) {
        // Extract original package ID from fitted package ID (remove _0, _1 suffix)
        const originalPackageId = fittedPackage.package_id.replace(/_\d+$/, '');
        if (!packedInThisBasket.includes(originalPackageId)) {
          packedInThisBasket.push(originalPackageId);
        }
      }

      // Remove packed packages from remaining packages
      for (const packedId of packedInThisBasket) {
        const index = remainingPackages.findIndex(p => p._id === packedId);
        if (index !== -1) {
          remainingPackages.splice(index, 1);
          allPackedIds.push(packedId);
        }
      }

      // Add basket to results
      baskets.push({
        basket_id: basketId,
        packages_allocated: packedInThisBasket.length,
        packages_packed: packingResult.fitted_items,
        packing_success_rate: 100, // Since we only count successfully fitted packages
        total_weight: packingResult.total_weight,
        volume_utilization: packingResult.basket_utilization,
        packed_package_ids: packedInThisBasket
      });

      basketIndex++;

      // Stop after reasonable number of baskets to prevent infinite loop
      if (basketIndex > 4) {
        console.log(`  ! Stopped after 4 baskets to prevent infinite loop`);
        break;
      }
    }

    const totalPacked = allPackedIds.length;
    const unpackedIds = packages.filter(p => !allPackedIds.includes(p._id)).map(p => p._id);
    const cartPacked = totalPacked > 0; // Cart is considered packed if at least some packages were packed

    return {
      success: cartPacked,
      cart_packed: cartPacked,
      total_packages: packages.length,
      packed_packages: totalPacked,
      unpacked_packages: unpackedIds,
      cart_details: {
        cart_id: cartId,
        basket_size: basketOption.basket_size_id,
        baskets: baskets
      },
      message: cartPacked 
        ? `Successfully packed ${totalPacked}/${packages.length} packages in ${baskets.length} baskets`
        : 'No packages could be packed'
    };
  }

  /**
   * Update package statuses in database
   */
  private async updatePackageStatuses(packedIds: string[], unpackedIds: string[]): Promise<void> {
    try {
      // Update packed packages status to "packed"
      if (packedIds.length > 0) {
        await this.packageModel.updateMany(
          { _id: { $in: packedIds } },
          { package_status: 'Packed' }
        );
        console.log(`✓ Updated ${packedIds.length} packages to status "Packed"`);
      }

      // Update unpacked packages status to "unpack"
      if (unpackedIds.length > 0) {
        await this.packageModel.updateMany(
          { _id: { $in: unpackedIds } },
          { package_status: 'Unpack' }
        );
        console.log(`✓ Updated ${unpackedIds.length} packages to status "Unpack"`);
      }
    } catch (error) {
      console.error('Error updating package statuses:', error);
    }
  }

  create(createSingleCalDto: CreateSingleCalDto) {
    return 'This action adds a new singleCal';
  }

  findAll() {
    return `This action returns all singleCal`;
  }

  findOne(id: number) {
    return `This action returns a #${id} singleCal`;
  }

  update(id: number, updateSingleCalDto: UpdateSingleCalDto) {
    return `This action updates a #${id} singleCal`;
  }

  remove(id: number) {
    return `This action removes a #${id} singleCal`;
  }
}
