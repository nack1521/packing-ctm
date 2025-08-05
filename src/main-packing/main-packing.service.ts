import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Package, PackageStatus, PackageType } from '../packages/schemas/package.schema';
import { Job, JobType, JobStatus, JobPriority } from '../jobs/schemas/job.schema';
import { BasketSize } from '../basket_sizes/schemas/basket_size.schema';
import { Cart, CartStatus } from '../carts/schemas/cart.schema';
import { Basket, BasketType, BasketStatus } from '../baskets/schemas/basket.schema';
import { SingleCalService } from '../single_cal/single_cal.service';
import { PACKING_CONFIG, BASKET_SIZE_CONFIG } from './constants';

interface ProductInfo {
  _id: string;
  product_name: string;
  product_weight?: number;
  dimensions?: { width: number; length: number; height: number; };
}

interface PackageForProcessing {
  _id: string;
  product_list: ProductInfo[];
  package_type: PackageType;
  package_status: PackageStatus;
  createdAt: Date;
}

export interface CartPackingResultNew {
  success: boolean;
  cart_object_id: string;
  cart_type: '1:1' | '1:m';
  basket_size_used: string;
  total_baskets: number;
  packages_processed: number;
  packages_packed: number;
  packages_unpacked: number;
  job_object_id: string;
  cart_details: { baskets: any[] };
  message: string;
}

@Injectable()
export class MainPackingService {
  constructor(
    @InjectModel(Package.name) private packageModel: Model<Package>,
    @InjectModel(Job.name) private jobModel: Model<Job>,
    @InjectModel(BasketSize.name) private basketSizeModel: Model<BasketSize>,
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    @InjectModel(Basket.name) private basketModel: Model<Basket>,
    private singleCalService: SingleCalService
  ) {}

  /**
   * Helper function to get maximum baskets allowed per cart for a specific basket size
   */
  private getMaxBasketsForSize(basketSize: any): number {
    // First try to get limit by short name
    const shortName = basketSize.package_short_name?.toUpperCase();
    if (shortName && BASKET_SIZE_CONFIG.MAX_BASKETS_PER_SIZE[shortName]) {
      return BASKET_SIZE_CONFIG.MAX_BASKETS_PER_SIZE[shortName];
    }

    // Fallback to volume-based calculation
    const volume = basketSize.package_width * basketSize.package_length * basketSize.package_height;
    
    for (const config of BASKET_SIZE_CONFIG.VOLUME_BASED_LIMITS) {
      if (volume <= config.maxVolume) {
        return config.maxBaskets;
      }
    }

    // Default fallback
    return PACKING_CONFIG.BASKETS_PER_CART;
  }


  async processMixPackingWorkflow(): Promise<CartPackingResultNew> {
    try {
      const packages = await this.getUnpackPackages();
      if (!packages.length) {
        return this.createFailedResult('No unpack packages found');
      }

      const job = await this.createJob(packages.length);
      await this.updatePackageStatus(packages.map(p => p._id), PackageStatus.IN_PROCESS);

      const cartType = this.getCartType(packages[0]);
      const basketSizes = await this.getBasketSizes();

      if (!basketSizes.length) {
        await this.completeJob(job._id.toString(), false);
        return this.createFailedResult('No basket sizes available');
      }

      const result = await this.packMixCart(packages, basketSizes, cartType, job._id.toString());
      await this.completeJob(job._id.toString(), result.success);

      return result;
    } catch (error) {
      console.error('❌ Packing workflow error:', error);
      return this.createFailedResult(`Error: ${error.message}`);
    }
  }

  // Get packages ready for packing
  private async getUnpackPackages(): Promise<PackageForProcessing[]> {
    const packages = await this.packageModel
      .find({ package_status: PackageStatus.UNPACK })
      .populate('product_list._id', 'product_name product_weight dimensions')
      .sort({ createdAt: 1 })
      .limit(PACKING_CONFIG.PACKAGES_PER_JOB || 0)
      .select('product_list package_type package_status createdAt')
      .lean();

    // Optimized mapping with early returns and reduced nested calls
    return packages.map((pkg: any) => {
      const productList = pkg.product_list || [];
      return {
        _id: pkg._id.toString(),
        product_list: productList.map((p: any) => {
          const productData = p._id || p;
          return {
            _id: productData._id?.toString() || productData.toString() || '',
            product_name: productData.product_name || '',
            product_weight: productData.product_weight ?? 100,
            dimensions: productData.dimensions || { width: 10, length: 10, height: 10 },
          };
        }),
        package_type: pkg.package_type,
        package_status: pkg.package_status,
        createdAt: pkg.createdAt || new Date(),
      };
    });
  }

  // Create processing job
  private async createJob(packageCount: number) {
    return this.jobModel.create({
      job_type: JobType.SINGLE_CAL,
      job_status: JobStatus.IN_PROGRESS,
      job_priority: JobPriority.MEDIUM,
      total_packages: packageCount,
      processed_packages: 0,
      successful_packages: 0,
      failed_packages: 0,
    });
  }

  // Determine cart type from first package
  private getCartType(pkg: PackageForProcessing): '1:1' | '1:m' {
    return pkg.package_type === PackageType.ONE_TO_MANY ? '1:m' : '1:1';
  }

  // Get available basket sizes
  private async getBasketSizes() {
    return this.basketSizeModel
      .find({ package_use: true })
      .sort({ package_width: 1, package_length: 1, package_height: 1 })
      .lean();
  }

  private async packMixCart(
    packages: PackageForProcessing[],
    basketSizes: any[],
    cartType: '1:1' | '1:m',
    jobId: string
  ): Promise<CartPackingResultNew> {
    const cartId = `cart_${cartType}_${Date.now()}`;

    // Find first suitable basket efficiently
    const suitableBasket = basketSizes.find(basketSize => 
      this.testFirstPackageFit(packages[0], basketSize)
    );

    if (!suitableBasket) {
      return this.createFailedResult('No suitable basket size found');
    }

    return cartType === '1:m'
      ? this.process1mCart(packages, basketSizes, cartId, jobId)
      : this.process1nMixCart(packages, suitableBasket, cartId, jobId);
  }

  // Test if package fits in basket - optimized with early returns
  private testFirstPackageFit(pkg: PackageForProcessing, basketSize: any): boolean {
    const pkgDims = this.getPackageDimensions(pkg);
    const basketDims = {
      w: basketSize.package_width,
      h: basketSize.package_height,
      d: basketSize.package_length,
      maxWeight: basketSize.package_weight * 1000
    };

    // Early weight check
    if (pkgDims.weight > basketDims.maxWeight) return false;

    // Pre-compute rotations and check in one pass
    const dims = [pkgDims.w, pkgDims.h, pkgDims.d];
    const basketLimits = [basketDims.w, basketDims.h, basketDims.d];
    
    // Check all 6 rotations efficiently
    const rotations = [
      [0, 1, 2], [1, 0, 2], [2, 1, 0], 
      [0, 2, 1], [1, 2, 0], [2, 0, 1]
    ];

    return rotations.some(([i, j, k]) => 
      dims[i] <= basketLimits[0] && 
      dims[j] <= basketLimits[1] && 
      dims[k] <= basketLimits[2]
    );
  }

  // Process 1:m cart (one package per basket)
  private async process1mCart(
    packages: PackageForProcessing[],
    basketSizes: any,
    cartId: string,
    jobId: string
  ): Promise<CartPackingResultNew> {
    // Only keep ONE_TO_MANY packages
    const oneToManyPackages = packages.filter(p => p.package_type === PackageType.ONE_TO_MANY);

    if (!oneToManyPackages.length) {
      return this.createFailedResult('No 1:m packages found');
    }

    // Find the smallest basket that can fit the first package
    let referenceBasket: any = null;
    for (const basketSize of basketSizes) {
      const singleCalPackages = oneToManyPackages.length
        ? oneToManyPackages[0].product_list.map((product, idx) => ({
            _id: `${oneToManyPackages[0]._id}_${idx}`,
            package_id: oneToManyPackages[0]._id,
            product_id: product._id,
            weight: product.product_weight || 100,
            w: product.dimensions?.width || 10,
            h: product.dimensions?.height || 10,
            d: product.dimensions?.length || 10,
            dimensions: {
              width: product.dimensions?.width || 10,
              height: product.dimensions?.height || 10,
              depth: product.dimensions?.length || 10,
            },
            quantity: 1,
            package_type: oneToManyPackages[0].package_type,
            package_status: oneToManyPackages[0].package_status,
            cost: 0,
          }))
        : [];

      const basketInputs = [{
        basket_size_id: basketSize._id,
        dimensions: {
          width: basketSize.package_width,
          height: basketSize.package_height,
          depth: basketSize.package_length
        },
        max_weight: basketSize.package_weight,
        cost: basketSize.package_cost || 0
      }];

      const result = await this.singleCalService.packSingleCal(singleCalPackages, basketInputs);

      if (result.success && result.cart_details?.baskets?.length === 1) {
        referenceBasket = basketSize;
        break;
      }
    }

    if (!referenceBasket) {
      return this.createFailedResult('No suitable basket found for the first package');
    }

    // Get max baskets for this specific size
    const maxBasketsForSize = this.getMaxBasketsForSize(referenceBasket);

    // Now try to pack each ONE_TO_MANY package into a basket of referenceBasket size
    const baskets: any[] = [];
    let basketCounter = 1;
    const packedIds: string[] = [];

    for (const pkg of oneToManyPackages) {
      if (baskets.length >= maxBasketsForSize) break;

      // Prepare singleCal input for this package
      const singleCalPackages = pkg.product_list.map((product, idx) => ({
        _id: `${pkg._id}_${idx}`,
        package_id: pkg._id,
        product_id: product._id,
        weight: product.product_weight || 100,
        w: product.dimensions?.width || 10,
        h: product.dimensions?.height || 10,
        d: product.dimensions?.length || 10,
        dimensions: {
          width: product.dimensions?.width || 10,
          height: product.dimensions?.height || 10,
          depth: product.dimensions?.length || 10,
        },
        quantity: 1,
        package_type: pkg.package_type,
        package_status: pkg.package_status,
        cost: 0,
      }));

      const basketInputs = [{
        basket_size_id: referenceBasket._id.toString(),
        dimensions: {
          width: referenceBasket.package_width,
          height: referenceBasket.package_height,
          depth: referenceBasket.package_length
        },
        max_weight: referenceBasket.package_weight,
        cost: referenceBasket.package_cost || 0
      }];

      const result = await this.singleCalService.packSingleCal(singleCalPackages, basketInputs);

      // Only pack if all products fit in one basket
      if (result.success && result.cart_details?.baskets?.length === 1) {
        baskets.push({
          basket_id: `${cartId}_basket${basketCounter++}`,
          products: pkg.product_list.map(product => ({
            product_name: product.product_name,
            product_object_id: product._id,
            product_count: 1,
            package_ids: [pkg._id]
          })),
          volume_utilization: Math.round(result.cart_details.baskets[0].volume_utilization || 0),
        });
        packedIds.push(pkg._id);
      }
      // If not fit, skip (throw out)
    }

    // Update package status
    await this.updatePackageStatus(packedIds, PackageStatus.PACKED);
    await this.updatePackageStatus(
      packages.map(p => p._id).filter(id => !packedIds.includes(id)),
      PackageStatus.UNPACK
    );

    const { cartDbId } = await this.createCartAndBaskets(
      cartId, '1:m', referenceBasket,
      oneToManyPackages.filter(p => packedIds.includes(p._id)),
      baskets
    );

    return {
      success: true,
      cart_object_id: cartDbId,
      cart_type: '1:m',
      basket_size_used: referenceBasket.package_name,
      total_baskets: baskets.length,
      packages_processed: oneToManyPackages.length,
      packages_packed: packedIds.length,
      packages_unpacked: oneToManyPackages.length - packedIds.length,
      job_object_id: jobId,
      cart_details: { baskets },
      message: `1:m cart: ${packedIds.length} packages in ${baskets.length} baskets (max ${maxBasketsForSize} for size ${referenceBasket.package_short_name})`
    };
  }

  private async process1nMixCart(
    packages: PackageForProcessing[],
    basketSize: any,
    cartId: string,
    jobId: string,
    useProductGroups: boolean = true
  ): Promise<CartPackingResultNew> {
    const oneToOnePackages = packages
      .filter(p => p.package_type === PackageType.ONE_TO_ONE)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (!oneToOnePackages.length) {
      return this.createFailedResult('No 1:1 packages found');
    }

    // Force use only basket size "F" - get F basket from database
    const fBasket = await this.basketSizeModel.findOne({ 
      package_short_name: 'F',
      package_use: true 
    }).lean();

    if (!fBasket) {
      return this.createFailedResult('Basket size "F" not found or not available');
    }

    console.log(`Forcing use of basket size F: ${fBasket.package_name}`);

    // Create reusable basket input configuration for F basket only
    const basketInputs = [{
      basket_size_id: fBasket._id,
      dimensions: {
        width: fBasket.package_width,
        height: fBasket.package_height,
        depth: fBasket.package_length
      },
      max_weight: fBasket.package_weight,
      cost: fBasket.package_cost || 0
    }];

    // Helper function to create singleCal package format
    const createSingleCalPackage = (pkg: PackageForProcessing) => {
      const dims = this.getPackageDimensions(pkg);
      return {
        _id: pkg._id,
        package_id: pkg._id,
        product_id: pkg.product_list[0]?._id || 'unknown',
        weight: dims.weight,
        w: dims.w,
        h: dims.h,
        d: dims.d,
        dimensions: { width: dims.w, height: dims.h, depth: dims.d },
        quantity: 1,
        package_type: pkg.package_type,
        package_status: pkg.package_status,
        cost: 0
      };
    };

    let baskets: any[] = [];

    if (useProductGroups) {
      // Process by product groups using F basket only
      baskets = await this.processProductGroups(oneToOnePackages, basketInputs, cartId, createSingleCalPackage);
    } else {
      // Process all packages together (mix mode) using F basket only
      baskets = await this.processMixedPackages(oneToOnePackages, basketInputs, cartId, createSingleCalPackage);
    }

    if (!baskets.length) {
      return this.createFailedResult('No baskets could be packed with basket size F');
    }

    // Collect packed IDs and update status
    const packedIds = baskets.flatMap(basket =>
      basket.products.flatMap(prod => prod.package_object_ids || prod.package_ids || [])
    );

    await Promise.all([
      this.updatePackageStatus(packedIds, PackageStatus.PACKED),
      this.updatePackageStatus(
        packages.map(p => p._id).filter(id => !packedIds.includes(id)),
        PackageStatus.UNPACK
      )
    ]);

    const { cartDbId } = await this.createCartAndBaskets(
      cartId, '1:1', fBasket, // Use F basket instead of original basketSize
      oneToOnePackages.filter(p => packedIds.includes(p._id)),
      baskets
    );

    return {
      success: true,
      cart_object_id: cartDbId,
      cart_type: '1:1',
      basket_size_used: fBasket.package_name, // Use F basket name
      total_baskets: baskets.length,
      packages_processed: packages.length,
      packages_packed: packedIds.length,
      packages_unpacked: packages.length - packedIds.length,
      job_object_id: jobId,
      cart_details: { baskets },
      message: `1:1 mixed cart with F basket only: ${packedIds.length} packages in ${baskets.length} baskets`
    };
  }

  // Helper method for processing product groups
  private async processProductGroups(
    packages: PackageForProcessing[], 
    basketInputs: any[], 
    cartId: string, 
    createSingleCalPackage: Function
  ): Promise<any[]> {
    const productGroups = this.groupByProduct(packages);
    const allBaskets: any[] = [];
    let basketCounter = 0;
    
    // Get the basket size from basketInputs
    const basketSize = await this.basketSizeModel.findById(basketInputs[0].basket_size_id).lean();
    const maxBasketsForThisSize = basketSize ? this.getMaxBasketsForSize(basketSize) : PACKING_CONFIG.BASKETS_PER_CART;

    for (const [productName, productPackages] of productGroups) {
      if (basketCounter >= maxBasketsForThisSize) break;

      const singleCalPackages = productPackages.map(pkg => createSingleCalPackage(pkg));
      const result = await this.singleCalService.packSingleCal(singleCalPackages, basketInputs);

      if (result.success && result.cart_details.baskets.length > 0) {
        const productBaskets = result.cart_details.baskets.map((basket, idx) => ({
          basket_id: `${cartId}_${productName}_${idx + 1}`,
          products: [{
            product_name: productName,
            product_id: productPackages[0].product_list[0]?._id || 'unknown',
            package_type: productPackages[0].package_type,
            packages_count: basket.packages_packed,
            total_weight: basket.total_weight || 0,
            volume: 0,
            package_ids: basket.packed_package_ids
          }],
          usedVolume: 0,
          volume_utilization: Math.round(basket.volume_utilization || 0)
        }));

        const remainingSlots = maxBasketsForThisSize - basketCounter;
        const basketsToAdd = productBaskets.slice(0, remainingSlots);
        allBaskets.push(...basketsToAdd);
        basketCounter += basketsToAdd.length;
      }
    }

    return allBaskets;
  }

  // Helper method for processing mixed packages
  private async processMixedPackages(
    packages: PackageForProcessing[], 
    basketInputs: any[], 
    cartId: string, 
    createSingleCalPackage: Function
  ): Promise<any[]> {
    const singleCalPackages = packages.map(pkg => createSingleCalPackage(pkg));
    const result = await this.singleCalService.packSingleCal(singleCalPackages, basketInputs);

    if (!result.success || !result.cart_details.baskets.length) {
      return [];
    }

    // Get the basket size to determine max baskets
    const basketSize = await this.basketSizeModel.findById(basketInputs[0].basket_size_id).lean();
    const maxBasketsForThisSize = basketSize ? this.getMaxBasketsForSize(basketSize) : PACKING_CONFIG.BASKETS_PER_CART;

    // Limit baskets based on size-specific configuration and group packages by product
    return result.cart_details.baskets.slice(0, maxBasketsForThisSize).map((basket, idx) => {
      const packageGroups: Record<string, {
        product_name: string;
        product_id: string;
        package_type: string;
        package_ids: string[];
      }> = {};

      // Group packages by product efficiently
      for (const pkgId of basket.packed_package_ids) {
        const pkg = packages.find(p => p._id === pkgId);
        if (!pkg) continue;

        const key = `${pkg.product_list[0]?._id || 'unknown'}|${pkg.package_type}`;
        if (!packageGroups[key]) {
          packageGroups[key] = {
            product_name: pkg.product_list[0]?.product_name || 'Unknown',
            product_id: pkg.product_list[0]?._id || 'unknown',
            package_type: pkg.package_type,
            package_ids: []
          };
        }
        packageGroups[key].package_ids.push(pkgId);
      }

      const products = Object.values(packageGroups).map(group => ({
        product_name: group.product_name,
        product_object_id: group.product_id,
        product_count: group.package_ids.length,
        package_object_ids: group.package_ids
      }));

      return {
        basket_id: `${cartId}_basket${idx + 1}`,
        products,
        volume_utilization: Math.round(basket.volume_utilization || 0),
      };
    });
  }

  // Helper: Group packages by product
  private groupByProduct(packages: PackageForProcessing[]): Map<string, PackageForProcessing[]> {
    const groups = new Map();
    packages.forEach(pkg => {
      const productName = pkg.product_list[0]?.product_name || 'Unknown';
      if (!groups.has(productName)) groups.set(productName, []);
      groups.get(productName).push(pkg);
    });
    return groups;
  }

  // Helper: Calculate package dimensions - optimized
  private getPackageDimensions(pkg: PackageForProcessing) {
    const productList = pkg.product_list;
    
    if (!productList.length) {
      throw new Error('Package has no products');
    }

    // Use single pass to calculate all metrics
    let weight = 0;
    let totalVolume = 0;
    let maxW = 0, maxH = 0, maxD = 0;

    for (const product of productList) {
      weight += product.product_weight || 100;
      
      const dims = product.dimensions || { width: 10, length: 10, height: 10 };
      const volume = dims.width * dims.length * dims.height;
      
      totalVolume += volume;
      maxW = Math.max(maxW, dims.width);
      maxH = Math.max(maxH, dims.height);
      maxD = Math.max(maxD, dims.length);
    }

    const cubeRoot = Math.cbrt(totalVolume);
    return {
      weight,
      w: Math.max(maxW, cubeRoot),
      h: Math.max(maxH, cubeRoot),
      d: Math.max(maxD, cubeRoot)
    };
  }

  // Helper: Update package status - optimized with better error handling
  private async updatePackageStatus(packageIds: string[], status: PackageStatus) {
    if (!packageIds.length) return;

    try {
      // Convert to ObjectIds more efficiently
      const validIds = packageIds.map(id => {
        return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : id;
      });

      const result = await this.packageModel.updateMany(
        { _id: { $in: validIds } },
        { package_status: status, updatedAt: new Date() }
      );

      console.log(`Updated ${result.modifiedCount} packages to status: ${status}`);
    } catch (error) {
      console.error('Error updating package status:', error);
      throw error;
    }
  }

  // Helper: Complete job
  private async completeJob(jobId: string, success: boolean) {
    await this.jobModel.findByIdAndUpdate(jobId, {
      job_status: success ? JobStatus.COMPLETED : JobStatus.CANCELLED,
      updatedAt: new Date()
    });
  }

  // Helper: Create cart and baskets in database - optimized
  private async createCartAndBaskets(
    cartId: string,
    cartType: '1:1' | '1:m',
    basketSize: any,
    packages: PackageForProcessing[],
    basketDetails: any[]
  ) {
    // Pre-create package lookup map for better performance
    const packageMap = new Map(packages.map(p => [p._id, p]));
    const basketRecords: Array<{
      _id: Types.ObjectId;
      basket_size: any;
      basket_type: BasketType;
      basket_status: BasketStatus;
      package_count: any;
    }> = [];

    const basketType = cartType === '1:m' ? BasketType.ONE_TO_MANY : BasketType.ONE_TO_ONE;
    const basketSizeData = {
      _id: new Types.ObjectId(basketSize._id),
      package_name: basketSize.package_name,
      package_width: basketSize.package_width,
      package_length: basketSize.package_length,
      package_height: basketSize.package_height,
      package_weight: basketSize.package_weight,
      package_cost: basketSize.package_cost,
    };

    // Create baskets in batch
    const basketPromises = basketDetails.map(async (detail) => {
      const allPackageIds = Array.isArray(detail.products)
        ? detail.products.flatMap(prod => prod.package_ids || prod.package_object_ids || [])
        : [];
      
      const basketPackages = allPackageIds
        .map(id => packageMap.get(id))
        .filter(Boolean);

      const basketRecord = new this.basketModel({
        basket_size: basketSizeData,
        [cartType === '1:m' ? 'single_package' : 'package_list']:
          cartType === '1:m'
            ? basketPackages[0] ? {
                _id: new Types.ObjectId(basketPackages[0]._id),
                product_list: basketPackages[0].product_list.map(p => ({
                  _id: new Types.ObjectId(p._id),
                  product_name: p.product_name
                })),
                package_type: basketPackages[0].package_type,
                package_status: PackageStatus.PACKED,
              } : null
            : basketPackages.map(pkg => ({
                _id: new Types.ObjectId(pkg._id),
                product_list: pkg.product_list.map(p => ({
                  _id: new Types.ObjectId(p._id),
                  product_name: p.product_name
                })),
                package_type: pkg.package_type,
                package_status: PackageStatus.PACKED,
              })),
        basket_type: basketType,
        basket_status: BasketStatus.PENDING,
      });

      return basketRecord.save();
    });

    const savedBaskets = await Promise.all(basketPromises);
    
    savedBaskets.forEach(savedBasket => {
      basketRecords.push({
        _id: savedBasket._id,
        basket_size: basketSizeData,
        basket_type: basketType,
        basket_status: BasketStatus.PENDING,
        package_count: 1,
      });
    });

    const cartRecord = new this.cartModel({
      basket_list: basketRecords,
      cart_status: CartStatus.PENDING,
      total_baskets: basketRecords.length,
      total_packages: packages.length,
      total_products: packages.reduce((sum, pkg) => sum + pkg.product_list.length, 0),
      total_cost: basketRecords.reduce((sum, b) => sum + (b.basket_size.package_cost || 0), 0),
    });

    const savedCart = await cartRecord.save();
    return { cartDbId: savedCart._id.toString() };
  }

  // Helper: Create failed result
  private createFailedResult(message: string): CartPackingResultNew {
    return {
      success: false,
      cart_object_id: '',
      cart_type: '1:1',
      basket_size_used: '',
      total_baskets: 0,
      packages_processed: 0,
      packages_packed: 0,
      packages_unpacked: 0,
      job_object_id: '',
      cart_details: { baskets: [] },
      message
    };
  }

  // Get packed packages with location info - optimized with better aggregation
  async getPackedPackagesWithLocation() {
    // Use aggregation pipeline for better performance
    const basketsWithCarts = await this.basketModel.aggregate([
      {
        $lookup: {
          from: 'carts',
          localField: '_id',
          foreignField: 'basket_list._id',
          as: 'cart_info'
        }
      },
      { $match: { 'cart_info': { $ne: [] } } },
      { $sort: { createdAt: 1 } }
    ]);

    const result: Array<{
      package_id: string;
      product_list: Array<{
        _id: string;
        product_name: string;
        product_weight: number;
        dimensions: { width: number; length: number; height: number };
      }>;
      cart_id: string;
      basket_id: string;
      createdAt: Date;
    }> = [];

    // Process in batches for better memory usage
    for (const basket of basketsWithCarts) {
      const cartId = basket.cart_info[0]?._id?.toString();
      if (!cartId) continue;

      const packages = [
        ...(Array.isArray(basket.package_list) ? basket.package_list : []),
        ...(basket.single_package ? [basket.single_package] : [])
      ];

      const packageIds = packages.map(p => p._id);
      if (packageIds.length === 0) continue;

      // Batch fetch packages
      const fullPackages = await this.packageModel
        .find({ _id: { $in: packageIds } })
        .populate('product_list._id', 'product_name product_weight dimensions')
        .select('product_list package_type package_status createdAt')
        .lean();

      for (const fullPackage of fullPackages) {
        result.push({
          package_id: fullPackage._id.toString(),
          product_list: (fullPackage.product_list || []).map((p: any) => ({
            _id: p._id?.toString() || 'unknown',
            product_name: p._id?.product_name || p.product_name || 'Unknown',
            product_weight: p._id?.product_weight ?? p.product_weight ?? 100,
            dimensions: p._id?.dimensions ?? p.dimensions ?? { width: 10, length: 10, height: 10 }
          })),
          cart_id: cartId,
          basket_id: basket._id.toString(),
          createdAt: (fullPackage as any).createdAt || new Date()
        });
      }
    }

    return result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  // Get packing statistics
  async getPackingStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [unpackCount, processingCount, completedJobs, failedJobs] = await Promise.all([
      this.packageModel.countDocuments({ package_status: PackageStatus.UNPACK }),
      this.packageModel.countDocuments({ package_status: PackageStatus.IN_PROCESS }),
      this.jobModel.countDocuments({ job_status: JobStatus.COMPLETED, createdAt: { $gte: today } }),
      this.jobModel.countDocuments({ job_status: JobStatus.CANCELLED, createdAt: { $gte: today } })
    ]);

    return {
      total_unpack_packages: unpackCount,
      packages_in_processing: processingCount,
      completed_jobs_today: completedJobs,
      failed_jobs_today: failedJobs
    };
  }

  async findSmallestBasket(input: any): Promise<any> {
    // Get all basket sizes, sorted smallest first
    if (!input || typeof input !== 'object' || !Array.isArray(input.products)) {
      return { success: false, message: 'Invalid input: products array is required' };
    }
    const basketSizes = await this.basketSizeModel
      .find({ package_use: true })
      .sort({ package_width: 1, package_length: 1, package_height: 1 })
      .lean();

    if (!basketSizes.length) {
      return { success: false, message: 'No basket sizes available' };
    }

    // Prepare product(s) info
    const products = (input.products || []).map((p: any) => ({
      product_name: p.name,
      product_weight: p.weight,
      dimensions: {
        width: p.dimension_width,
        length: p.dimension_length,
        height: p.dimension_height,
        depth: p.dimension_length,
      },
    }));

    // One product type: try all baskets with 6 rotations
    if (input.package_type === 'one_product_type' && products.length === 1) {
      const prod = products[0];
      for (const basket of basketSizes) {
        const basketDims = {
          w: basket.package_width,
          h: basket.package_height,
          d: basket.package_length,
          maxWeight: basket.package_weight * 1000,
        };
        const prodWeight = prod.product_weight || 100;
        if (prodWeight > basketDims.maxWeight) continue;

        const rotations = [
          [prod.dimensions.width, prod.dimensions.height, prod.dimensions.length],
          [prod.dimensions.height, prod.dimensions.width, prod.dimensions.length],
          [prod.dimensions.length, prod.dimensions.height, prod.dimensions.width],
          [prod.dimensions.width, prod.dimensions.length, prod.dimensions.height],
          [prod.dimensions.height, prod.dimensions.length, prod.dimensions.width],
          [prod.dimensions.length, prod.dimensions.width, prod.dimensions.height],
        ];

        for (const [w, h, d] of rotations) {
          if (w <= basketDims.w && h <= basketDims.h && d <= basketDims.d) {
            return {
              success: true,
              basket: basket,
              rotation: { width: w, height: h, length: d },
              message: `Fits in basket "${basket.package_name}" with rotation`,
            };
          }
        }
      }
      return { success: false, message: 'No basket can fit this product' };
    }

    // Many product type: use singleCalService to try all baskets
    if (input.package_type === 'many_product_type' && products.length > 0) {
      for (const basket of basketSizes) {
        const singleCalPackages = products.map((prod, idx) => ({
          _id: idx.toString(),
          package_id: idx.toString(),
          product_id: idx.toString(),
          weight: prod.product_weight || 100,
          w: prod.dimensions.width,
          h: prod.dimensions.height,
          d: prod.dimensions.length || prod.dimensions.depth,
          dimensions: {
            width: prod.dimensions.width,
            height: prod.dimensions.height,
            depth: prod.dimensions.length || prod.dimensions.depth,
          },
          quantity: 1,
          package_type: 'ONE_TO_ONE',
          package_status: 'UNPACK',
          cost: 0,
        }));

        const basketInputs = [{
          basket_size_id: basket._id.toString(),
          dimensions: {
            width: basket.package_width,
            height: basket.package_height,
            depth: basket.package_length,
          },
          max_weight: basket.package_weight,
          cost: basket.package_cost || 0,
        }];

        // Try packing
        const result = await this.singleCalService.packSingleCal(singleCalPackages, basketInputs);
        if (result.success && result.cart_details?.baskets?.length === 1) {
          return {
            success: true,
            basket: basket,
            message: `All products fit in basket "${basket.package_name}"`,
            details: result.cart_details.baskets[0],
          };
        }
      }
      return { success: false, message: 'No basket can fit all products in one basket' };
    }

    return { success: false, message: 'Invalid input or unsupported package_type' };
  }
}
