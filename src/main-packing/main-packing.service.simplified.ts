import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Package, PackageStatus, PackageType } from '../packages/schemas/package.schema';
import { Job, JobType, JobStatus, JobPriority } from '../jobs/schemas/job.schema';
import { BasketSize } from '../basket_sizes/schemas/basket_size.schema';
import { Cart, CartStatus } from '../carts/schemas/cart.schema';
import { Basket, BasketType, BasketStatus } from '../baskets/schemas/basket.schema';
import { SingleCalService } from '../single_cal/single_cal.service';
import { ManyCalService } from '../many_cal/many_cal.service';
import { PACKING_CONFIG, DEFAULT_DIMENSIONS } from './constants';

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
  job_id: string;
  cart_details: { baskets: any[] };
  message: string;
}

@Injectable()
export class MainPackingServiceNew {
  constructor(
    @InjectModel(Package.name) private packageModel: Model<Package>,
    @InjectModel(Job.name) private jobModel: Model<Job>,
    @InjectModel(BasketSize.name) private basketSizeModel: Model<BasketSize>,
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    @InjectModel(Basket.name) private basketModel: Model<Basket>,
    private singleCalService: SingleCalService,
    private manyCalService: ManyCalService,
  ) {}

  // Main workflow - simplified
  async processPackingWorkflow(): Promise<CartPackingResultNew> {
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

      const result = await this.packCart(packages, basketSizes, cartType, job._id.toString());
      await this.completeJob(job._id.toString(), result.success);

      return result;
    } catch (error) {
      console.error('❌ Packing workflow error:', error);
      return this.createFailedResult(`Error: ${error.message}`);
    }
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
      .select('product_list package_type package_status createdAt')
      .lean();

    // Map to ensure createdAt is present and types match
    return packages.map((pkg: any) => ({
      _id: pkg._id.toString(),
      product_list: (pkg.product_list || []).map((p: any) => ({
        _id: p._id?._id?.toString?.() || p._id?.toString?.() || p._id || '',
        product_name: p._id?.product_name || p.product_name || '',
        product_weight: p._id?.product_weight ?? p.product_weight,
        dimensions: p._id?.dimensions ?? p.dimensions,
      })),
      package_type: pkg.package_type,
      package_status: pkg.package_status,
      createdAt: pkg.createdAt ? new Date(pkg.createdAt) : new Date(),
    }));
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

  // Main packing logic - simplified
  private async packCart(
    packages: PackageForProcessing[],
    basketSizes: any[],
    cartType: '1:1' | '1:m',
    jobId: string
  ): Promise<CartPackingResultNew> {
    const cartId = `cart_${cartType}_${Date.now()}`;

    // Test with smallest basket first
    for (const basketSize of basketSizes) {
      const canFit = await this.testFirstPackageFit(packages[0], basketSize);
      if (canFit) {
        return cartType === '1:m'
          ? this.process1mCart(packages, basketSize, cartId, jobId)
          : this.process1nCart(packages, basketSize, cartId, jobId);
      }
    }

    return this.createFailedResult('No suitable basket size found');
  }

  private async packMixCart(
    packages: PackageForProcessing[],
    basketSizes: any[],
    cartType: '1:1' | '1:m',
    jobId: string
  ): Promise<CartPackingResultNew> {
    const cartId = `cart_${cartType}_${Date.now()}`;

    // Test with smallest basket first
    for (const basketSize of basketSizes) {
      const canFit = await this.testFirstPackageFit(packages[0], basketSize);
      if (canFit) {
        return cartType === '1:m'
          ? this.process1mCart(packages, basketSize, cartId, jobId)
          : this.process1nMixCart(packages, basketSize, cartId, jobId);
      }
    }

    return this.createFailedResult('No suitable basket size found');
  }

  // Test if package fits in basket
  private async testFirstPackageFit(pkg: PackageForProcessing, basketSize: any): Promise<boolean> {
    const pkgDims = this.getPackageDimensions(pkg);
    const basketDims = {
      w: basketSize.package_width,
      h: basketSize.package_height,
      d: basketSize.package_length
    };

    // Check weight
    if (pkgDims.weight > basketSize.package_weight * 1000) return false;

    // Check all 6 rotations
    const rotations = [
      [pkgDims.w, pkgDims.h, pkgDims.d],
      [pkgDims.h, pkgDims.w, pkgDims.d],
      [pkgDims.d, pkgDims.h, pkgDims.w],
      [pkgDims.w, pkgDims.d, pkgDims.h],
      [pkgDims.h, pkgDims.d, pkgDims.w],
      [pkgDims.d, pkgDims.w, pkgDims.h]
    ];

    return rotations.some(([w, h, d]) =>
      w <= basketDims.w && h <= basketDims.h && d <= basketDims.d
    );
  }

  // Process 1:m cart (one package per basket)
  private async process1mCart(
    packages: PackageForProcessing[],
    basketSize: any,
    cartId: string,
    jobId: string
  ): Promise<CartPackingResultNew> {
    const oneToManyPackages = packages.filter(p => p.package_type === PackageType.ONE_TO_MANY);

    if (!oneToManyPackages.length) {
      return this.createFailedResult('No 1:m packages found');
    }

    // Use ManyCalService for packing
    const manyCalPackages = oneToManyPackages.map(pkg => {
      const dims = this.getPackageDimensions(pkg);
      return {
        _id: pkg._id,
        package_id: pkg._id,
        product_id: pkg.product_list[0]?._id || 'unknown',
        ...dims,
        dimensions: {
          width: dims.w,
          height: dims.h,
          depth: dims.d
        },
        quantity: 1,
        package_type: pkg.package_type,
        package_status: pkg.package_status,
        cost: 0
      };
    });

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

    const result = await this.manyCalService.packManyCal(manyCalPackages[0], basketInputs);

    if (!result.success) {
      return this.createFailedResult('ManyCalService packing failed');
    }

    // Limit baskets
    const limitedBaskets = result.basket_details.slice(0, PACKING_CONFIG.BASKETS_PER_CART);
    const packedIds = limitedBaskets.map(b => b.basket_id);

    await this.updatePackageStatus(packedIds, PackageStatus.PACKED);
    await this.updatePackageStatus(
      packages.map(p => p._id).filter(id => !packedIds.includes(id)),
      PackageStatus.UNPACK
    );

    const { cartDbId } = await this.createCartAndBaskets(
      cartId, '1:m', basketSize,
      oneToManyPackages.filter(p => packedIds.includes(p._id)),
      limitedBaskets
    );

    return {
      success: true,
      cart_object_id: cartDbId,
      cart_type: '1:m',
      basket_size_used: basketSize.package_name,
      total_baskets: limitedBaskets.length,
      packages_processed: packages.length,
      packages_packed: packedIds.length,
      packages_unpacked: packages.length - packedIds.length,
      job_id: jobId,
      cart_details: { baskets: limitedBaskets },
      message: `1:m cart: ${packedIds.length} packages in ${limitedBaskets.length} baskets`
    };
  }



  // Process 1:1 cart (multiple packages per basket)
  private async process1nCart(
    packages: PackageForProcessing[],
    basketSize: any,
    cartId: string,
    jobId: string
  ): Promise<CartPackingResultNew> {
    const oneToOnePackages = packages
      .filter(p => p.package_type === PackageType.ONE_TO_ONE)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (!oneToOnePackages.length) {
      return this.createFailedResult('No 1:1 packages found');
    }

    // Group by product
    const productGroups = this.groupByProduct(oneToOnePackages);
    const allBaskets: Array<{
      basket_id: string;
      product_name: string;
      product_id: string;
      packages_count: number;
      total_weight: number;
      volume_utilization: number;
      package_ids: string[];
    }> = [];
    let basketCounter = 0;

    for (const [productName, productPackages] of productGroups) {
      if (basketCounter >= PACKING_CONFIG.BASKETS_PER_CART) break;

      const singleCalPackages = productPackages.map(pkg => {
        const dims = this.getPackageDimensions(pkg);
        return {
          _id: pkg._id,
          package_id: pkg._id,
          product_id: pkg.product_list[0]?._id || 'unknown',
          weight: dims.weight,
          w: dims.w,
          h: dims.h,
          d: dims.d,
          dimensions: {
            width: dims.w,
            height: dims.h,
            depth: dims.d
          },
          quantity: 1,
          package_type: pkg.package_type,
          package_status: pkg.package_status,
          cost: 0
        };
      });

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

      if (result.success) {
        const productBaskets = result.cart_details.baskets.map((basket, idx) => ({
          basket_id: `${cartId}_${productName}_${idx + 1}`,
          product_name: productName,
          product_id: productPackages[0].product_list[0]?._id || 'unknown',
          packages_count: basket.packages_packed,
          total_weight: basket.total_weight || 0,
          volume_utilization: Math.round(basket.volume_utilization || 0),
          package_ids: basket.packed_package_ids
        }));

        const remainingSlots = PACKING_CONFIG.BASKETS_PER_CART - basketCounter;
        const basketsToAdd = productBaskets.slice(0, remainingSlots);
        allBaskets.push(...basketsToAdd);
        basketCounter += basketsToAdd.length;
      }
    }

    if (!allBaskets.length) {
      return this.createFailedResult('No baskets could be packed');
    }

    const packedIds = allBaskets.flatMap(b => b.package_ids);
    await this.updatePackageStatus(packedIds, PackageStatus.PACKED);
    await this.updatePackageStatus(
      packages.map(p => p._id).filter(id => !packedIds.includes(id)),
      PackageStatus.UNPACK
    );

    const { cartDbId } = await this.createCartAndBaskets(
      cartId, '1:1', basketSize,
      oneToOnePackages.filter(p => packedIds.includes(p._id)),
      allBaskets
    );

    return {
      success: true,
      cart_object_id: cartDbId,
      cart_type: '1:1',
      basket_size_used: basketSize.package_name,
      total_baskets: allBaskets.length,
      packages_processed: packages.length,
      packages_packed: packedIds.length,
      packages_unpacked: packages.length - packedIds.length,
      job_id: jobId,
      cart_details: { baskets: allBaskets },
      message: `1:1 cart: ${packedIds.length} packages in ${allBaskets.length} baskets`
    };
  }

  private async process1nMixCart(
    packages: PackageForProcessing[],
    basketSize: any,
    cartId: string,
    jobId: string,
    useProductGroups: boolean = false // default: mix products
  ): Promise<CartPackingResultNew> {
    const oneToOnePackages = packages
      .filter(p => p.package_type === PackageType.ONE_TO_ONE)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (!oneToOnePackages.length) {
      return this.createFailedResult('No 1:1 packages found');
    }

    const maxBasketVolume = basketSize.package_width * basketSize.package_length * basketSize.package_height;
    const baskets: any[] = [];
    let basketCounter = 1;

    if (useProductGroups) {
      // Group by product type
      const productGroups = this.groupByProduct(oneToOnePackages);
      for (const [productName, productPackages] of productGroups) {
        let currentBasket: any = {
          basket_id: `${cartId}_basket${basketCounter}`,
          products: [],
          usedVolume: 0
        };
        for (const pkg of productPackages) {
          const product = pkg.product_list[0];
          const dims = product.dimensions || { width: 10, length: 10, height: 10 };
          const volume = dims.width * dims.length * dims.height;
          const weight = product.product_weight || 100;

          // If adding this package exceeds basket volume, start new basket (if under limit)
          if (currentBasket.usedVolume + volume > maxBasketVolume) {
            currentBasket.volume_utilization = Math.round((currentBasket.usedVolume / maxBasketVolume) * 100);
            baskets.push(currentBasket);
            basketCounter++;
            if (baskets.length >= 3) break; // Limit to 4 baskets
            currentBasket = {
              basket_id: `${cartId}_basket${basketCounter}`,
              products: [],
              usedVolume: 0
            };
          }

          let basketProduct = currentBasket.products.find(p => p.product_id === product._id);
          if (!basketProduct) {
            basketProduct = {
              product_name: product.product_name,
              product_id: product._id,
              packages_count: 0,
              total_weight: 0,
              volume: 0,
              package_ids: []
            };
            currentBasket.products.push(basketProduct);
          }
          basketProduct.packages_count += 1;
          basketProduct.total_weight += weight;
          basketProduct.volume += volume;
          basketProduct.package_ids.push(pkg._id);

          currentBasket.usedVolume += volume;
        }
        if (currentBasket.products.length > 0 && baskets.length < 4) {
          currentBasket.volume_utilization = Math.round((currentBasket.usedVolume / maxBasketVolume) * 100);
          baskets.push(currentBasket);
        }
      }
    } else {
      // Mix all products in baskets (your current logic)
      let currentBasket: any = {
        basket_id: `${cartId}_basket${basketCounter}`,
        products: [],
        usedVolume: 0
      };
      for (const pkg of oneToOnePackages) {
        const product = pkg.product_list[0];
        const dims = product.dimensions || { width: 10, length: 10, height: 10 };
        const volume = dims.width * dims.length * dims.height;
        const weight = product.product_weight || 100;

        // If adding this package exceeds basket volume, start new basket (if under limit)
        if (currentBasket.usedVolume + volume > maxBasketVolume) {
          currentBasket.volume_utilization = Math.round((currentBasket.usedVolume / maxBasketVolume) * 100);
          baskets.push(currentBasket);
          basketCounter++;
          if (baskets.length >= 3) break; // Limit to 4 baskets
          currentBasket = {
            basket_id: `${cartId}_basket${basketCounter}`,
            products: [],
            usedVolume: 0
          };
        }

        let basketProduct = currentBasket.products.find(p => p.product_id === product._id);
        if (!basketProduct) {
          basketProduct = {
            product_name: product.product_name,
            product_id: product._id,
            packages_count: 0,
            total_weight: 0,
            volume: 0,
            package_ids: []
          };
          currentBasket.products.push(basketProduct);
        }
        basketProduct.packages_count += 1;
        basketProduct.total_weight += weight;
        basketProduct.volume += volume;
        basketProduct.package_ids.push(pkg._id);

        currentBasket.usedVolume += volume;
      }
      if (currentBasket.products.length > 0 && baskets.length < 4) {
        currentBasket.volume_utilization = Math.round((currentBasket.usedVolume / maxBasketVolume) * 100);
        baskets.push(currentBasket);
      }
    }

    // Collect all packed package IDs
    const packedIds = baskets.flatMap(basket =>
      basket.products.flatMap(prod => prod.package_ids)
    );

    await this.updatePackageStatus(packedIds, PackageStatus.PACKED);
    await this.updatePackageStatus(
      packages.map(p => p._id).filter(id => !packedIds.includes(id)),
      PackageStatus.UNPACK
    );

    const { cartDbId } = await this.createCartAndBaskets(
      cartId, '1:1', basketSize,
      oneToOnePackages.filter(p => packedIds.includes(p._id)),
      baskets
    );

    return {
      success: true,
      cart_object_id: cartDbId,
      cart_type: '1:1',
      basket_size_used: basketSize.package_name,
      total_baskets: baskets.length,
      packages_processed: packages.length,
      packages_packed: packedIds.length,
      packages_unpacked: packages.length - packedIds.length,
      job_id: jobId,
      cart_details: { baskets },
      message: `1:1 mixed cart: ${packedIds.length} packages in ${baskets.length} baskets (max 4)`
    };
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

  // Helper: Calculate package dimensions (simplified)
  private getPackageDimensions(pkg: PackageForProcessing) {
    const weight = pkg.product_list.reduce((sum, p) => sum + (p.product_weight || 100), 0);

    if (!pkg.product_list.length) {
        throw new Error('Package has no products');
    }

    let totalVolume = 0;
    let maxW = 0, maxH = 0, maxD = 0;

    pkg.product_list.forEach(product => {
      const dims = product.dimensions || { width: 10, length: 10, height: 10 };
      totalVolume += dims.width * dims.length * dims.height;
      maxW = Math.max(maxW, dims.width);
      maxH = Math.max(maxH, dims.height);
      maxD = Math.max(maxD, dims.length);
    });

    const cubeRoot = Math.cbrt(totalVolume);
    return {
      weight,
      w: Math.max(maxW, cubeRoot),
      h: Math.max(maxH, cubeRoot),
      d: Math.max(maxD, cubeRoot)
    };
  }

  // Helper: Update package status
  private async updatePackageStatus(packageIds: string[], status: PackageStatus) {
    if (!packageIds.length) return;

    const validIds = packageIds
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));

    if (validIds.length) {
      await this.packageModel.updateMany(
        { _id: { $in: validIds } },
        { package_status: status, updatedAt: new Date() }
      );
    }
  }

  // Helper: Complete job
  private async completeJob(jobId: string, success: boolean) {
    await this.jobModel.findByIdAndUpdate(jobId, {
      job_status: success ? JobStatus.COMPLETED : JobStatus.CANCELLED,
      updatedAt: new Date()
    });
  }

  // Helper: Create cart and baskets in database
  private async createCartAndBaskets(
    cartId: string,
    cartType: '1:1' | '1:m',
    basketSize: any,
    packages: PackageForProcessing[],
    basketDetails: any[]
  ) {
    const basketRecords: Array<{
      _id: Types.ObjectId;
      basket_size: any;
      basket_type: BasketType;
      basket_status: BasketStatus;
      package_count: any;
    }> = [];

    for (const detail of basketDetails) {
      // Fix: collect all package_ids from all products in the basket
      const allPackageIds = Array.isArray(detail.products)
        ? detail.products.flatMap(prod => prod.package_ids)
        : [];
      const basketPackages = packages.filter(p => allPackageIds.includes(p._id));
      const basketType = cartType === '1:m' ? BasketType.ONE_TO_MANY : BasketType.ONE_TO_ONE;

      const basketRecord = new this.basketModel({
        basket_size: {
          _id: new Types.ObjectId(basketSize._id),
          package_name: basketSize.package_name,
          package_width: basketSize.package_width,
          package_length: basketSize.package_length,
          package_height: basketSize.package_height,
          package_weight: basketSize.package_weight,
          package_cost: basketSize.package_cost,
        },
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

      const savedBasket = await basketRecord.save();
      basketRecords.push({
        _id: savedBasket._id,
        basket_size: basketRecord.basket_size,
        basket_type: basketType,
        basket_status: BasketStatus.PENDING,
        package_count: detail.packages_count,
      });
    }

    const cartRecord = new this.cartModel({
      basket_list: basketRecords,
      cart_status: CartStatus.PENDING,
      total_baskets: basketRecords.length,
      total_packages: packages.length,
      total_products: packages.reduce((sum, pkg) => sum + pkg.product_list.length, 0),
      total_cost: basketRecords.reduce((sum, b) => sum + b.basket_size.package_cost, 0),
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
      job_id: '',
      cart_details: { baskets: [] },
      message
    };
  }

  // Get packed packages with location info
  async getPackedPackagesWithLocation() {
    const baskets = await this.basketModel.find().sort({ createdAt: 1 }).lean();
    const carts = await this.cartModel.find().lean();

    const basketToCartMap = new Map();
    carts.forEach(cart => {
      cart.basket_list?.forEach(basket => {
        basketToCartMap.set(basket._id.toString(), cart._id.toString());
      });
    });

    type PackedPackageWithLocation = {
      package_id: string;
      product_list: {
        _id: string;
        product_name: string;
        product_weight: number;
        dimensions: { width: number; length: number; height: number };
      }[];
      cart_id: string;
      basket_id: string;
      createdAt: Date;
    };

    const result: PackedPackageWithLocation[] = [];
    for (const basket of baskets) {
      const cartId = basketToCartMap.get(basket._id.toString());
      if (!cartId) continue;

      const packages = [
        ...(Array.isArray(basket.package_list) ? basket.package_list : []),
        ...(basket.single_package ? [basket.single_package] : [])
      ];

      for (const packageInfo of packages) {
        const fullPackage = await this.packageModel
          .findById(packageInfo._id)
          .populate('product_list._id', 'product_name product_weight dimensions')
          .select('product_list package_type package_status createdAt')
          .lean();

        if (fullPackage) {
          result.push({
            package_id: fullPackage._id.toString(),
            product_list: (fullPackage.product_list || []).map((p: any) => ({
              _id: p._id?.toString?.() || p._id?.toString() || p._id || 'unknown',
              product_name: p._id?.product_name || p.product_name || 'Unknown',
              product_weight: p._id?.product_weight ?? p.product_weight ?? 100,
              dimensions: p._id?.dimensions ?? p.dimensions ?? { width: 10, length: 10, height: 10 }
            })),
            cart_id: cartId,
            basket_id: basket._id.toString(),
            createdAt: new Date()
          });
        }
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
}
