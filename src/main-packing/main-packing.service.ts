import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Package, PackageStatus, PackageType } from '../packages/schemas/package.schema';
import { Job, JobType, JobStatus, JobPriority } from '../jobs/schemas/job.schema';
import { BasketSize } from '../basket_sizes/schemas/basket_size.schema';
import { Cart, CartStatus } from '../carts/schemas/cart.schema';
import { Basket, BasketType, BasketStatus } from '../baskets/schemas/basket.schema';
import { SingleCalService, SingleCalPackageInput, SingleCalResult } from '../single_cal/single_cal.service';
import { ManyCalService, ManyCalPackageInput, ManyCalResult } from '../many_cal/many_cal.service';
import { BasketInput } from '../calculate/calculate.service';

export interface PackageForProcessing {
  _id: string;
  product_list: { 
    _id: string, 
    product_name: string,
    product_weight?: number,
    dimensions?: {
      width: number;
      length: number;
      height: number;
    }
  }[];
  package_type: PackageType;
  package_status: PackageStatus;
  created_at: Date;
  updated_at: Date;
}

export interface CartPackingResult {
  success: boolean;
  cart_object_id: string;
  cart_type: '1:1' | '1:m';
  basket_size_used: string;
  total_baskets: number;
  packages_processed: number;
  packages_packed: number;
  packages_unpacked: number;
  job_id: string;
  cart_details: {
    baskets: Array<{
      basket_object_id: string;
      product_name?: string; // Add product name
      product_object_id?: string; // Add product ID
      packages_count: number;
      total_weight: number;
      volume_utilization: number;
      package_object_ids: string[];
    }>;
  };
  message: string;
}

@Injectable()
export class MainPackingService {
  private readonly BASKETS_PER_CART = 4;
  private readonly TARGET_UTILIZATION_PERCENTAGE = 85; // Target 85% volume utilization per basket
  private readonly MAX_UTILIZATION_PERCENTAGE = 95; // Maximum 95% before basket is considered full

  constructor(
    @InjectModel(Package.name) private packageModel: Model<Package>,
    @InjectModel(Job.name) private jobModel: Model<Job>,
    @InjectModel(BasketSize.name) private basketSizeModel: Model<BasketSize>,
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    @InjectModel(Basket.name) private basketModel: Model<Basket>,
    private singleCalService: SingleCalService,
    private manyCalService: ManyCalService,
  ) {}

  /**
   * Main workflow: Process unpack packages into cart with baskets
   * Enhanced with 3D bin packing algorithm integration
   */
  async processPackingWorkflow(): Promise<CartPackingResult> {
    console.log('🚀 Starting main packing workflow with 3D bin packing algorithms...');

    let unpackPackages: PackageForProcessing[] = [];
    let jobId = '';
    
    try {
      // Step 1: Get unpack packages sorted by date
      unpackPackages = await this.getUnpackPackagesSortedByDate();
      
      if (unpackPackages.length === 0) {
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
          message: 'No unpack packages found'
        };
      }

      console.log(`📦 Found ${unpackPackages.length} unpack packages to process`);

      // Step 2: Create job and update package statuses
      jobId = await this.createJobAndUpdatePackages(unpackPackages);
      
      // Step 3: Get prototype package and determine cart type
      const prototypePackage = unpackPackages[0];
      const cartType = this.determineCartType(prototypePackage);
      
      // Step 4: Find available basket sizes
      const basketSizes = await this.findOptimalBasketSize(cartType);
      
      // Step 5: Pack cart using actual algorithms with multiple basket size attempts
      const result = await this.packCartWithAlgorithm(unpackPackages, basketSizes, cartType, jobId);
      
      // Step 6: Finalize job based on packing result
      await this.finalizeJob(jobId, result);
      
      console.log(`🎯 Packing completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      return result;

    } catch (error) {
      console.error('❌ Error in main packing workflow:', error);
      
      // Handle failed workflow - reset all packages to UNPACK
      if (unpackPackages.length > 0) {
        await this.handlePackingFailure(unpackPackages, jobId);
      }
      
      return {
        success: false,
        cart_object_id: '',
        cart_type: '1:1', 
        basket_size_used: '',
        total_baskets: 0,
        packages_processed: 0,
        packages_packed: 0,
        packages_unpacked: unpackPackages.length,
        job_id: jobId,
        cart_details: { baskets: [] },
        message: `Error in packing workflow: ${error.message}`
      };
    }
  }

  /**
   * Handle packing failure - Reset all packages to UNPACK status
   */
  private async handlePackingFailure(packages: PackageForProcessing[], jobId: string): Promise<void> {
    console.log(`🔄 Handling packing failure - resetting ${packages.length} packages to UNPACK status`);
    
    try {
      // Reset all packages back to UNPACK status
      const allPackageIds = packages.map(pkg => pkg._id);
      if (allPackageIds.length > 0) {
        await this.updatePackagesStatus(allPackageIds, PackageStatus.UNPACK);
        console.log(`✅ Reset ${allPackageIds.length} packages to UNPACK status after failure`);
      }

      // Update job status to cancelled if jobId exists
      if (jobId && Types.ObjectId.isValid(jobId)) {
        await this.jobModel.updateOne(
          { _id: new Types.ObjectId(jobId) },
          { 
            job_status: JobStatus.CANCELLED,
            job_description: 'Workflow failed - packages reset to UNPACK',
            actual_end_date: new Date(),
            updatedAt: new Date()
          }
        );
        console.log(`✅ Updated job ${jobId} status to CANCELLED`);
      }

    } catch (error) {
      console.error(`❌ Error handling packing failure:`, error);
    }
  }

  /**
   * Step 1: Get unpack packages sorted by creation date with product dimensions
   */
  private async getUnpackPackagesSortedByDate(): Promise<PackageForProcessing[]> {
    console.log('📋 Fetching unpack packages with product dimensions sorted by creation date...');
    
    const packages = await this.packageModel
      .find({ package_status: PackageStatus.UNPACK })
      .sort({ createdAt: 1 }) // Oldest first (use createdAt instead of created_at)
      .select('_id product_list package_type package_status createdAt updatedAt')
      .populate('product_list._id', 'product_name product_weight dimensions')
      .lean();

    const processedPackages: PackageForProcessing[] = packages.map(pkg => ({
      _id: pkg._id.toString(),
      product_list: pkg.product_list.map((p: any) => {
        // Handle cases where product might not be populated correctly
        const productId = p._id?._id?.toString() || p._id?.toString() || p.toString();
        const productName = p._id?.product_name || p.product_name || 'Unknown Product';
        const productWeight = p._id?.product_weight || p.product_weight || 100; // Default 100g
        const dimensions = p._id?.dimensions || p.dimensions || { width: 10, length: 10, height: 10 }; // Default dimensions
        
        return {
          _id: productId,
          product_name: productName,
          product_weight: productWeight,
          dimensions: dimensions
        };
      }),
      package_type: pkg.package_type,
      package_status: pkg.package_status,
      created_at: (pkg as any).createdAt || new Date(),
      updated_at: (pkg as any).updatedAt || new Date()
    }));

    console.log(`📦 Found ${processedPackages.length} unpack packages with product dimensions`);
    console.log(`📋 Sample package structure:`, processedPackages[0] ? {
      _id: processedPackages[0]._id,
      product_count: processedPackages[0].product_list.length,
      first_product: {
        id: processedPackages[0].product_list[0]?._id,
        name: processedPackages[0].product_list[0]?.product_name,
        weight: processedPackages[0].product_list[0]?.product_weight,
        dimensions: processedPackages[0].product_list[0]?.dimensions
      }
    } : 'No packages found');
    
    return processedPackages;
  }

  /**
   * Step 2: Create job and update package statuses to IN_PROCESS
   */
  private async createJobAndUpdatePackages(packages: PackageForProcessing[]): Promise<string> {
    console.log(`🏗️ Creating job and updating ${packages.length} packages to IN_PROCESS...`);
    
    // Determine job type based on package analysis
    const packageTypes = packages.map(p => p.package_type);
    const hasOneToOne = packageTypes.includes(PackageType.ONE_TO_ONE);
    const hasOneToMany = packageTypes.includes(PackageType.ONE_TO_MANY);
    
    let jobType: JobType;
    if (hasOneToMany) {
      jobType = JobType.MANY_CAL;
    } else {
      jobType = JobType.SINGLE_CAL;
    }

    // Use the first package as the prototype for package_info (as per schema requirement)
    const prototypePackage = packages[0];
    
    console.log(`🔍 Creating job for prototype package:`, {
      _id: prototypePackage._id,
      product_count: prototypePackage.product_list.length,
      package_type: prototypePackage.package_type
    });

    // Validate ObjectIds before conversion
    if (!Types.ObjectId.isValid(prototypePackage._id)) {
      throw new Error(`Invalid package ID: ${prototypePackage._id}`);
    }

    // Validate and convert product list
    const validatedProductList = prototypePackage.product_list.map((product, index) => {
      if (!product._id || !Types.ObjectId.isValid(product._id)) {
        console.warn(`⚠️ Invalid product ID at index ${index}:`, product);
        // Create a dummy ObjectId for invalid products
        return {
          _id: new Types.ObjectId(),
          product_name: product.product_name || 'Unknown Product'
        };
      }
      return {
        _id: new Types.ObjectId(product._id),
        product_name: product.product_name || 'Unknown Product'
      };
    });

    // Create job record with correct schema format and proper ObjectId conversion
    const job = new this.jobModel({
      package_info: {
        _id: new Types.ObjectId(prototypePackage._id),
        product_list: validatedProductList,
        package_type: prototypePackage.package_type,
        package_status: prototypePackage.package_status
      },
      job_type: jobType,
      job_status: JobStatus.IN_PROGRESS,
      job_priority: JobPriority.MEDIUM,
      job_description: `Processing ${packages.length} packages with 3D bin packing algorithm`,
      scheduled_start_date: new Date(),
      total_calendar_entries: packages.length,
      total_duration_minutes: packages.length * 10 // Estimate 10 minutes per package
    });

    const savedJob = await job.save();
    console.log(`✅ Job created with ID: ${savedJob._id}`);

    // Update all packages to IN_PROCESS status
    const validPackageIds = packages
      .filter(p => Types.ObjectId.isValid(p._id))
      .map(p => new Types.ObjectId(p._id));
    
    if (validPackageIds.length === 0) {
      throw new Error('No valid package IDs found for status update');
    }
    
    console.log(`🔄 Updating ${validPackageIds.length} valid packages to IN_PROCESS status`);
    
    await this.packageModel.updateMany(
      { _id: { $in: validPackageIds } },
      { 
        package_status: PackageStatus.IN_PROCESS,
        updatedAt: new Date()
      }
    );

    console.log(`✅ Updated ${validPackageIds.length} packages to IN_PROCESS status`);
    return savedJob._id.toString();
  }

  /**
   * Step 6: Finalize job - Complete or cancel based on packing result
   */
  private async finalizeJob(jobId: string, packingResult: CartPackingResult): Promise<void> {
    console.log(`🏁 Finalizing job ${jobId}...`);
    
    try {
      if (!Types.ObjectId.isValid(jobId)) {
        throw new Error(`Invalid job ID: ${jobId}`);
      }

      const jobObjectId = new Types.ObjectId(jobId);
      
      if (packingResult.success && packingResult.packages_packed > 0) {
        // Success: Update job to COMPLETED and remove from jobs collection after a delay
        console.log(`✅ Job ${jobId}: SUCCESS - ${packingResult.packages_packed} packages packed`);
        
        await this.jobModel.updateOne(
          { _id: jobObjectId },
          { 
            job_status: JobStatus.COMPLETED,
            job_description: `Completed: ${packingResult.message}`,
            actual_end_date: new Date(),
            updatedAt: new Date()
          }
        );

        // Schedule job removal after 1 hour (for logging/audit purposes)
        // In production, you might want to move to an archive collection instead
        setTimeout(async () => {
          try {
            await this.jobModel.deleteOne({ _id: jobObjectId });
            console.log(`🗑️ Archived completed job ${jobId}`);
          } catch (error) {
            console.error(`⚠️ Failed to archive job ${jobId}:`, error);
          }
        }, 60 * 60 * 1000); // 1 hour delay

        console.log(`✅ Job ${jobId} marked as COMPLETED and scheduled for archival`);
        
      } else {
        // Failed: Update job to CANCELLED
        console.log(`❌ Job ${jobId}: FAILED - ${packingResult.message}`);
        
        await this.jobModel.updateOne(
          { _id: jobObjectId },
          { 
            job_status: JobStatus.CANCELLED,
            job_description: `Failed: ${packingResult.message}`,
            actual_end_date: new Date(),
            updatedAt: new Date()
          }
        );

        // For failed jobs, also schedule removal but after longer delay
        setTimeout(async () => {
          try {
            await this.jobModel.deleteOne({ _id: jobObjectId });
            console.log(`🗑️ Archived failed job ${jobId}`);
          } catch (error) {
            console.error(`⚠️ Failed to archive failed job ${jobId}:`, error);
          }
        }, 24 * 60 * 60 * 1000); // 24 hour delay for failed jobs

        console.log(`❌ Job ${jobId} marked as CANCELLED and scheduled for archival`);
      }

    } catch (error) {
      console.error(`❌ Error finalizing job ${jobId}:`, error);
      
      // Try to update job status to indicate error
      try {
        const jobObjectId = new Types.ObjectId(jobId);
        await this.jobModel.updateOne(
          { _id: jobObjectId },
          { 
            job_status: JobStatus.CANCELLED,
            job_description: `System error: ${error.message}`,
            actual_end_date: new Date(),
            updatedAt: new Date()
          }
        );
      } catch (updateError) {
        console.error(`❌ Failed to update job status after error:`, updateError);
      }
    }
  }

  /**
   * Step 3: Determine cart type from package analysis
   * Priority: 1:1 packages get 1:1 carts, 1:m packages get 1:m carts
   */
  private determineCartType(prototypePackage: PackageForProcessing): '1:1' | '1:m' {
    const cartType = prototypePackage.package_type === PackageType.ONE_TO_MANY ? '1:m' : '1:1';
    console.log(`🎯 Determined cart type: ${cartType} based on prototype package type ${prototypePackage.package_type}`);
    console.log(`⚠️ Note: 1:1 and 1:m packages cannot be mixed in the same cart`);
    return cartType;
  }

  /**
   * Step 4: Find optimal basket size by trying multiple sizes
   */
  private async findOptimalBasketSize(cartType: '1:1' | '1:m'): Promise<any[]> {
    console.log(`🔍 Finding all available basket sizes for ${cartType} cart...`);
    
    // Get all available basket sizes, sorted by volume (smallest first for better optimization)
    const basketSizes = await this.basketSizeModel
      .find()
      .sort({ package_width: 1, package_length: 1, package_height: 1 })
      .lean();
    
    if (!basketSizes || basketSizes.length === 0) {
      throw new Error('No basket sizes available');
    }
    
    console.log(`📏 Found ${basketSizes.length} basket sizes available:`);
    basketSizes.forEach(size => {
      const volume = size.package_width * size.package_length * size.package_height;
      console.log(`  - ${size.package_name}: ${size.package_width}x${size.package_length}x${size.package_height} (${volume} cubic units)`);
    });
    
    return basketSizes;
  }

  /**
   * Step 5: Pack cart using actual 3D bin packing algorithms with multiple basket sizes
   */
  private async packCartWithAlgorithm(
    packages: PackageForProcessing[], 
    basketSizes: any[],
    cartType: '1:1' | '1:m',
    jobId: string
  ): Promise<CartPackingResult> {
    const cartId = `cart_${cartType}_${Date.now()}`;
    
    console.log(`🎯 Trying to pack ${packages.length} packages using ${basketSizes.length} basket sizes...`);

    // Try each basket size until one works
    for (let i = 0; i < basketSizes.length; i++) {
      const basketSize = basketSizes[i];
      console.log(`📦 Attempt ${i + 1}/${basketSizes.length}: Trying basket size ${basketSize.package_name} (${basketSize.package_width}x${basketSize.package_length}x${basketSize.package_height})`);
      
      try {
        let result: CartPackingResult;
        
        if (cartType === '1:m') {
          result = await this.process1mCart(packages, basketSize, cartId, jobId);
        } else {
          result = await this.process11Cart(packages, basketSize, cartId, jobId);
        }
        
        if (result.success && result.packages_packed > 0) {
          console.log(`✅ SUCCESS with basket size ${basketSize.package_name}: ${result.packages_packed} packages packed`);
          return result;
        } else {
          console.log(`❌ FAILED with basket size ${basketSize.package_name}: ${result.message}`);
          
          // If it's not the last basket size, continue trying
          if (i < basketSizes.length - 1) {
            console.log(`🔄 Trying next basket size...`);
            continue;
          }
        }
        
      } catch (error) {
        console.error(`❌ Error with basket size ${basketSize.package_name}:`, error);
        
        // If it's not the last basket size, continue trying
        if (i < basketSizes.length - 1) {
          console.log(`🔄 Trying next basket size due to error...`);
          continue;
        }
      }
    }

    // If all basket sizes failed, return final failure result
    console.log(`❌ All ${basketSizes.length} basket sizes failed!`);
    
    return await this.createFailedCartResult(
      cartId,
      cartType,
      'All basket sizes',
      jobId,
      `Failed to pack with all ${basketSizes.length} available basket sizes`,
      packages
    );
  }

  /**
   * Process 1:m cart using ManyCalService with real 3D bin packing algorithm
   * Each package goes into separate baskets (cannot combine)
   */
  private async process1mCart(
    packages: PackageForProcessing[], 
    basketSize: any, 
    cartId: string,
    jobId: string
  ): Promise<CartPackingResult> {
    console.log(`🎯 Processing 1:m cart with ManyCalService - ${packages.length} packages`);
    
    try {
      // Filter only 1:m packages (cannot mix with 1:1)
      const oneToManyPackages = packages.filter(pkg => pkg.package_type === PackageType.ONE_TO_MANY);
      const oneToOnePackages = packages.filter(pkg => pkg.package_type === PackageType.ONE_TO_ONE);
      
      if (oneToOnePackages.length > 0) {
        console.warn(`⚠️ Found ${oneToOnePackages.length} 1:1 packages in 1:m cart - these will not be packed`);
      }
      
      if (oneToManyPackages.length === 0) {
        return await this.createFailedCartResult(cartId, '1:m', basketSize.package_name, jobId, 'No 1:m packages found for 1:m cart', packages);
      }

      // For 1:m, we typically process one package type with multiple quantities across baskets
      // Take the first package as the representative (in real scenario, all should be the same type)
      const packageToProcess = oneToManyPackages[0];
      
      // Calculate actual package dimensions from product data
      const packageDimensions = this.calculatePackageDimensions(packageToProcess);
      
      // Convert package to ManyCalService format
      const manyCalPackage: ManyCalPackageInput = {
        _id: packageToProcess._id,
        product_id: packageToProcess.product_list[0]?._id || 'unknown',
        weight: packageDimensions.weight,
        dimensions: packageDimensions.dimensions,
        quantity: oneToManyPackages.length, // Total quantity across all packages
        package_type: packageToProcess.package_type,
        package_status: packageToProcess.package_status,
        cost: 0
      };

      // Convert basket sizes to ManyCalService format
      const basketInputs: BasketInput[] = [{
        basket_size_id: basketSize._id,
        dimensions: {
          width: basketSize.package_width || 50,
          height: basketSize.package_height || 50,
          depth: basketSize.package_length || 50
        },
        max_weight: basketSize.package_weight || 1000,
        cost: basketSize.package_cost || 0
      }];

      console.log(`📦 Calling ManyCalService with quantity ${manyCalPackage.quantity}`);
      console.log(`📏 Package dimensions: W:${packageDimensions.dimensions.width}cm x H:${packageDimensions.dimensions.height}cm x D:${packageDimensions.dimensions.depth}cm (${packageDimensions.weight}g)`);
      console.log(`📐 Basket dimensions: W:${basketSize.package_width}cm x L:${basketSize.package_length}cm x H:${basketSize.package_height}cm`);
      console.log(`🔍 Fit check: Package(${packageDimensions.dimensions.width}x${packageDimensions.dimensions.height}x${packageDimensions.dimensions.depth}) vs Basket(${basketSize.package_width}x${basketSize.package_length}x${basketSize.package_height})`);
      
      // 📋 LOG ALL PACKAGES BEFORE MANYCAL PROCESSING
      console.log(`\n📋 === LOGGING ALL ${oneToManyPackages.length} PACKAGES BEFORE MANYCAL ===`);
      oneToManyPackages.forEach((pkg, index) => {
        const pkgDims = this.calculatePackageDimensions(pkg);
        console.log(`📦 Package ${index + 1}/${oneToManyPackages.length}:`);
        console.log(`   - ID: ${pkg._id}`);
        console.log(`   - Type: ${pkg.package_type}`);
        console.log(`   - Status: ${pkg.package_status}`);
        console.log(`   - Products: ${pkg.product_list.length} items`);
        console.log(`   - Weight: ${pkgDims.weight}g`);
        console.log(`   - Dimensions: ${pkgDims.dimensions.width}x${pkgDims.dimensions.height}x${pkgDims.dimensions.depth}cm`);
        console.log(`   - Volume: ${pkgDims.dimensions.width * pkgDims.dimensions.height * pkgDims.dimensions.depth} cubic cm`);
        pkg.product_list.forEach((product, pIndex) => {
          console.log(`     ${pIndex + 1}. ${product.product_name} (${product.product_weight}g) [${product.dimensions?.width}x${product.dimensions?.length}x${product.dimensions?.height}cm]`);
        });
      });
      console.log(`📋 === END PACKAGE LOGGING BEFORE MANYCAL ===\n`);
      
      // Use ManyCalService for real 3D bin packing
      const manyCalResult: ManyCalResult = await this.manyCalService.packManyCal(
        manyCalPackage, 
        basketInputs
      );
      
      if (!manyCalResult.success || manyCalResult.packed_quantity === 0) {
        console.log(`❌ ManyCalService packing failed`);
        return await this.createFailedCartResult(cartId, '1:m', basketSize.package_name, jobId, 'ManyCalService packing algorithm failed', packages);
      }

      console.log(`✅ ManyCalService packing successful: ${manyCalResult.packed_quantity} items packed across ${manyCalResult.baskets_used} baskets`);

      // Convert ManyCalResult to basket details format for database creation
      // Enforce BASKETS_PER_CART limit
      const limitedBasketDetails = manyCalResult.basket_details.slice(0, this.BASKETS_PER_CART);
      console.log(`📦 ManyCal returned ${manyCalResult.basket_details.length} baskets, limiting to ${this.BASKETS_PER_CART}`);
      
      const basketDetails = limitedBasketDetails.map((calBasket, index) => ({
        basket_id: `${cartId}_basket_${index + 1}`,
        product_name: packageToProcess.product_list[0]?.product_name || 'Unknown Product', // Add product name for 1:m
        product_id: packageToProcess.product_list[0]?._id || 'unknown', // Add product ID for 1:m
        packages_count: calBasket.quantity_packed,
        total_weight: calBasket.total_weight || 0,
        volume_utilization: Math.round(calBasket.volume_utilization || 0),
        package_ids: [packageToProcess._id] // Single package ID per basket in 1:m
      }));
      
      // Mark packages as packed (up to the packed quantity from limited baskets)
      const totalPackedFromLimitedBaskets = limitedBasketDetails.reduce((sum, calBasket) => sum + calBasket.quantity_packed, 0);
      const packedPackageIds = oneToManyPackages.slice(0, totalPackedFromLimitedBaskets).map(pkg => pkg._id);
      
      // Update package statuses to packed
      await this.updatePackagesStatus(packedPackageIds, PackageStatus.PACKED);
      
      // Update remaining packages back to unpack (including 1:1 packages that can't be mixed)
      const allPackageIds = packages.map(pkg => pkg._id);
      const unpackedPackageIds = allPackageIds.filter(id => !packedPackageIds.includes(id));
      if (unpackedPackageIds.length > 0) {
        await this.updatePackagesStatus(unpackedPackageIds, PackageStatus.UNPACK);
      }

      // Create Cart and Basket records in database
      const { cartDbId, basketDbIds } = await this.createCartAndBaskets(
        cartId,
        '1:m',
        basketSize,
        oneToManyPackages.filter(pkg => packedPackageIds.includes(pkg._id)), // Only packed 1:m packages
        basketDetails
      );

      return {
        success: true,
        cart_object_id: cartDbId,
        cart_type: '1:m',
        basket_size_used: basketSize.package_name,
        total_baskets: basketDetails.length,
        packages_processed: packages.length,
        packages_packed: packedPackageIds.length,
        packages_unpacked: unpackedPackageIds.length,
        job_id: jobId,
        cart_details: { baskets: basketDetails.map(basket => ({
          basket_object_id: basket.basket_id,
          product_name: basket.product_name, // Include product name
          product_object_id: basket.product_id, // Include product ID
          packages_count: basket.packages_count,
          total_weight: basket.total_weight,
          volume_utilization: basket.volume_utilization,
          package_object_ids: basket.package_ids
        })) },
        message: `1:m cart packed with ManyCalService: ${packedPackageIds.length} packages across ${basketDetails.length} baskets (avg utilization: ${Math.round(basketDetails.reduce((sum, b) => sum + b.volume_utilization, 0) / basketDetails.length)}%)`
      };

    } catch (error) {
      console.error('❌ Error in process1mCart:', error);
      return await this.createFailedCartResult(cartId, '1:m', basketSize.package_name, jobId, `ManyCalService packing error: ${error.message}`, packages);
    }
  }

  /**
   * Process 1:1 cart using SingleCalService with real 3D bin packing algorithm
   * 1:1 baskets can store multiple packages until reaching target utilization percentage
   */
  private async process11Cart(
    packages: PackageForProcessing[], 
    basketSize: any, 
    cartId: string,
    jobId: string
  ): Promise<CartPackingResult> {
    console.log(`🎯 Processing 1:1 cart with SingleCalService - ${packages.length} packages`);
    
    try {
      // Filter only 1:1 packages (cannot mix with 1:m)
      const oneToOnePackages = packages.filter(pkg => pkg.package_type === PackageType.ONE_TO_ONE);
      const oneToManyPackages = packages.filter(pkg => pkg.package_type === PackageType.ONE_TO_MANY);
      
      if (oneToManyPackages.length > 0) {
        console.warn(`⚠️ Found ${oneToManyPackages.length} 1:m packages in 1:1 cart - these will not be packed`);
      }
      
      if (oneToOnePackages.length === 0) {
        return await this.createFailedCartResult(cartId, '1:1', basketSize.package_name, jobId, 'No 1:1 packages found for 1:1 cart', packages);
      }

      // Convert packages to SingleCalService format with actual dimensions
      // First, group packages by product to ensure same products go in same baskets
      const packagesByProduct = new Map<string, PackageForProcessing[]>();
      
      oneToOnePackages.forEach(pkg => {
        // Use first product ID as the grouping key (since 1:1 packages have only 1 product)
        const productId = pkg.product_list[0]?._id || 'unknown';
        const productName = pkg.product_list[0]?.product_name || 'Unknown Product';
        const groupKey = `${productId}_${productName}`;
        
        if (!packagesByProduct.has(groupKey)) {
          packagesByProduct.set(groupKey, []);
        }
        packagesByProduct.get(groupKey)!.push(pkg);
      });
      
      console.log(`📊 Grouped ${oneToOnePackages.length} packages into ${packagesByProduct.size} product groups:`);
      packagesByProduct.forEach((packages, productKey) => {
        const samplePackage = packages[0];
        console.log(`  - ${productKey}: ${packages.length} packages of ${samplePackage.product_list[0]?.product_name}`);
      });

      const singleCalPackages: SingleCalPackageInput[] = oneToOnePackages.map(pkg => {
        const packageDimensions = this.calculatePackageDimensions(pkg);
        
        return {
          _id: pkg._id,
          package_id: pkg._id,
          product_id: pkg.product_list[0]?._id || 'unknown',
          weight: packageDimensions.weight,
          dimensions: packageDimensions.dimensions,
          quantity: 1,
          package_type: pkg.package_type,
          package_status: pkg.package_status,
          cost: 0
        };
      });

      // Convert basket sizes to SingleCalService format
      const basketInputs: BasketInput[] = [{
        basket_size_id: basketSize._id,
        dimensions: {
          width: basketSize.package_width || 50,
          height: basketSize.package_height || 50,
          depth: basketSize.package_length || 50
        },
        max_weight: basketSize.package_weight || 1000,
        cost: basketSize.package_cost || 0
      }];

      console.log(`📦 Calling SingleCalService with ${singleCalPackages.length} packages`);
      console.log(`📏 Sample package dimensions: ${singleCalPackages[0] ? `W:${singleCalPackages[0].dimensions.width}cm x H:${singleCalPackages[0].dimensions.height}cm x D:${singleCalPackages[0].dimensions.depth}cm` : 'none'}`);
      console.log(`📐 Basket dimensions: W:${basketSize.package_width}cm x L:${basketSize.package_length}cm x H:${basketSize.package_height}cm`);
      
      // 📋 LOG ALL PACKAGES BEFORE SINGLECAL PROCESSING
      console.log(`\n📋 === LOGGING ALL ${oneToOnePackages.length} PACKAGES BEFORE SINGLECAL ===`);
      oneToOnePackages.forEach((pkg, index) => {
        const pkgDims = this.calculatePackageDimensions(pkg);
        console.log(`📦 Package ${index + 1}/${oneToOnePackages.length}:`);
        console.log(`   - ID: ${pkg._id}`);
        console.log(`   - Type: ${pkg.package_type}`);
        console.log(`   - Status: ${pkg.package_status}`);
        console.log(`   - Products: ${pkg.product_list.length} items`);
        console.log(`   - Weight: ${pkgDims.weight}g`);
        console.log(`   - Dimensions: ${pkgDims.dimensions.width}x${pkgDims.dimensions.height}x${pkgDims.dimensions.depth}cm`);
        console.log(`   - Volume: ${pkgDims.dimensions.width * pkgDims.dimensions.height * pkgDims.dimensions.depth} cubic cm`);
        pkg.product_list.forEach((product, pIndex) => {
          console.log(`     ${pIndex + 1}. ${product.product_name} (${product.product_weight}g) [${product.dimensions?.width}x${product.dimensions?.length}x${product.dimensions?.height}cm]`);
        });
      });
      console.log(`📋 === END PACKAGE LOGGING BEFORE SINGLECAL ===\n`);
      
      // Process each product group separately to ensure same products in same baskets
      const allBasketDetails: Array<{
        basket_id: string;
        product_name?: string; // Add product name
        product_id?: string; // Add product ID
        packages_count: number;
        total_weight: number;
        volume_utilization: number;
        package_ids: string[];
      }> = [];
      
      let allPackedPackageIds: string[] = [];
      let basketCounter = 0;
      
      console.log(`🎯 Processing ${packagesByProduct.size} product groups separately...`);
      
      for (const [productKey, productPackages] of packagesByProduct) {
        // Check if we've reached the basket limit
        if (basketCounter >= this.BASKETS_PER_CART) {
          console.log(`⚠️ Reached basket limit (${this.BASKETS_PER_CART}), remaining ${packagesByProduct.size - Array.from(packagesByProduct.keys()).indexOf(productKey)} product groups will not be packed`);
          break;
        }
        
        const remainingBaskets = this.BASKETS_PER_CART - basketCounter;
        console.log(`\n📦 Processing product group: ${productKey} (${productPackages.length} packages, ${remainingBaskets} baskets remaining)`);
        
        // Convert this product group to SingleCal format
        const productGroupSingleCalPackages = productPackages.map(pkg => {
          const packageDimensions = this.calculatePackageDimensions(pkg);
          return {
            _id: pkg._id,
            package_id: pkg._id,
            product_id: pkg.product_list[0]?._id || 'unknown',
            weight: packageDimensions.weight,
            dimensions: packageDimensions.dimensions,
            quantity: 1,
            package_type: pkg.package_type,
            package_status: pkg.package_status,
            cost: 0
          };
        });
        
        // Use SingleCalService for this product group only
        console.log(`🔄 Calling SingleCalService for ${productKey} with ${productGroupSingleCalPackages.length} packages`);
        const productGroupResult: SingleCalResult = await this.singleCalService.packSingleCal(
          productGroupSingleCalPackages, 
          basketInputs
        );
        
        if (productGroupResult.success && productGroupResult.cart_packed) {
          // Limit baskets for this product group based on remaining basket count
          const availableBaskets = Math.min(productGroupResult.cart_details.baskets.length, remainingBaskets);
          const limitedProductBaskets = productGroupResult.cart_details.baskets.slice(0, availableBaskets);
          
          console.log(`✅ Product group ${productKey}: ${productGroupResult.packed_packages} packages packed in ${limitedProductBaskets.length} baskets`);
          
          // Add baskets from this product group to the overall result
          const productBasketDetails = limitedProductBaskets.map((calBasket, index) => {
            // Get product info from the first package in this group
            const samplePackage = productPackages[0];
            const productName = samplePackage.product_list[0]?.product_name || 'Unknown Product';
            const productId = samplePackage.product_list[0]?._id || 'unknown';
            
            return {
              basket_id: `${cartId}_basket_${basketCounter + index + 1}`,
              product_name: productName, // Add product name to basket details
              product_id: productId, // Add product ID to basket details  
              packages_count: calBasket.packages_packed,
              total_weight: calBasket.total_weight || 0,
              volume_utilization: Math.round(calBasket.volume_utilization || 0),
              package_ids: calBasket.packed_package_ids
            };
          });
          
          allBasketDetails.push(...productBasketDetails);
          
          // Track packed package IDs from this product group
          const productPackedIds = limitedProductBaskets.flatMap(basket => basket.packed_package_ids);
          allPackedPackageIds.push(...productPackedIds);
          
          basketCounter += limitedProductBaskets.length;
          
          console.log(`📊 Running totals: ${allPackedPackageIds.length} packages in ${basketCounter} baskets`);
        } else {
          console.log(`❌ Product group ${productKey}: packing failed`);
        }
      }
      
      if (allPackedPackageIds.length === 0) {
        console.log(`❌ No packages could be packed across all product groups`);
        return await this.createFailedCartResult(cartId, '1:1', basketSize.package_name, jobId, 'SingleCalService packing algorithm failed for all product groups', packages);
      }

      console.log(`✅ Overall SingleCal packing successful: ${allPackedPackageIds.length} packages packed across ${allBasketDetails.length} baskets`);
      
      const basketDetails = allBasketDetails;
      
      // Extract packed package IDs from all baskets
      const packedPackageIds = allPackedPackageIds;
      
      // Update package statuses to packed
      await this.updatePackagesStatus(packedPackageIds, PackageStatus.PACKED);
      console.log(`✅ Updated ${packedPackageIds.length} packages to PACKED status`);
      
      // Update remaining packages back to unpack (including 1:m packages that can't be mixed)
      const allPackageIds = packages.map(pkg => pkg._id);
      const unpackedPackageIds = allPackageIds.filter(id => !packedPackageIds.includes(id));
      if (unpackedPackageIds.length > 0) {
        await this.updatePackagesStatus(unpackedPackageIds, PackageStatus.UNPACK);
        console.log(`🔄 Updated ${unpackedPackageIds.length} unpacked packages back to UNPACK status`);
      }

      // Create Cart and Basket records in database
      const { cartDbId, basketDbIds } = await this.createCartAndBaskets(
        cartId,
        '1:1',
        basketSize,
        oneToOnePackages.filter(pkg => packedPackageIds.includes(pkg._id)), // Only packed 1:1 packages
        basketDetails
      );

      // Create detailed baskets for response format (using product-grouped baskets)
      const responseBasketsDetails = allBasketDetails.map((basketDetail, index) => ({
        basket_id: basketDetail.basket_id,
        product_name: basketDetail.product_name, // Include product name in response
        product_id: basketDetail.product_id, // Include product ID in response
        basket_type: '1:1' as BasketType,
        basket_size_id: basketSize._id,
        basket_size_name: basketSize.package_name,
        dimensions: {
          width: basketSize.package_width || 0,
          height: basketSize.package_height || 0,
          length: basketSize.package_length || 0
        },
        max_weight: basketSize.package_weight || 1000,
        total_weight: basketDetail.total_weight,
        total_volume: 0,
        volume_utilization: basketDetail.volume_utilization,
        packages: basketDetail.package_ids.map(packageId => {
          const originalPkg = oneToOnePackages.find(p => p._id === packageId);
          const packageDims = originalPkg ? this.calculatePackageDimensions(originalPkg) : null;
          
          return {
            package_id: packageId,
            product_id: originalPkg?.product_list[0]?._id || 'unknown',
            weight: packageDims?.weight || 100,
            volume: packageDims ? (packageDims.dimensions.width * packageDims.dimensions.height * packageDims.dimensions.depth) : 1000,
            dimensions: {
              width: packageDims?.dimensions.width || 10,
              height: packageDims?.dimensions.height || 10,
              length: packageDims?.dimensions.depth || 10
            },
            position: {
              x: 0,
              y: 0,
              z: 0
            },
            quantity: 1
          };
        })
      }));

      return {
        success: true,
        cart_object_id: cartDbId,
        cart_type: '1:1',
        basket_size_used: basketSize.package_name,
        total_baskets: basketDetails.length,
        packages_processed: packages.length,
        packages_packed: packedPackageIds.length,
        packages_unpacked: unpackedPackageIds.length,
        job_id: jobId,
        cart_details: { baskets: basketDetails.map(basket => ({
          basket_object_id: basket.basket_id,
          product_name: basket.product_name, // Include product name
          product_object_id: basket.product_id, // Include product ID
          packages_count: basket.packages_count,
          total_weight: basket.total_weight,
          volume_utilization: basket.volume_utilization,
          package_object_ids: basket.package_ids
        })) },
        message: `1:1 cart packed with SingleCalService (product-grouped): ${packedPackageIds.length} packages across ${basketDetails.length} baskets (avg utilization: ${Math.round(basketDetails.reduce((sum, b) => sum + b.volume_utilization, 0) / basketDetails.length)}%)`
      };

    } catch (error) {
      console.error('❌ Error in process11Cart:', error);
      return await this.createFailedCartResult(cartId, '1:1', basketSize.package_name, jobId, `SingleCalService packing error: ${error.message}`, packages);
    }
  }

  /**
   * Utilization-based packing algorithm for 1:1 packages
   * Keeps adding packages to baskets until target utilization is reached
   */
  private async packWithUtilizationTarget(
    packages: PackageForProcessing[],
    basketSize: any,
    cartType: '1:1'
  ): Promise<any> {
    console.log(`🔄 Starting utilization-based packing for ${packages.length} packages`);
    
    const baskets: Array<{
      basket_id: string;
      packages_count: number;
      total_weight: number;
      volume_used: number;
      volume_capacity: number;
      package_ids: string[];
      current_utilization: number;
    }> = [];

    const basketCapacity = this.calculateBasketVolume(basketSize);
    let remainingPackages = [...packages];
    let basketIndex = 0;

    // Keep packing until we run out of packages or baskets
    while (remainingPackages.length > 0 && basketIndex < this.BASKETS_PER_CART) {
      const basketId = `${basketSize.package_name}_${basketIndex + 1}`;
      
      console.log(`📦 Packing basket ${basketIndex + 1}/${this.BASKETS_PER_CART}`);
      
      // Pack this basket with utilization targeting
      const basketResult = this.packSingleBasketWithUtilization(
        remainingPackages,
        basketId,
        basketCapacity,
        basketSize
      );

      if (basketResult.package_ids.length > 0) {
        baskets.push(basketResult);
        
        // Remove packed packages from remaining list
        remainingPackages = remainingPackages.filter(
          pkg => !basketResult.package_ids.includes(pkg._id)
        );
        
        console.log(`✅ Basket ${basketIndex + 1}: ${basketResult.packages_count} packages, ${basketResult.current_utilization}% utilization`);
      } else {
        console.log(`⚠️ Basket ${basketIndex + 1}: No packages could fit`);
        break; // No more packages can fit
      }
      
      basketIndex++;
    }

    console.log(`📊 Packing summary: ${baskets.length} baskets, ${packages.length - remainingPackages.length} packages packed`);

    return {
      success: baskets.length > 0,
      baskets: baskets,
      total_packed_items: packages.length - remainingPackages.length,
      algorithm_used: "Utilization-based packing with target optimization"
    };
  }

  /**
   * Pack a single basket with utilization targeting
   * Keep adding packages until target utilization is reached
   */
  private packSingleBasketWithUtilization(
    availablePackages: PackageForProcessing[],
    basketId: string,
    basketCapacity: number,
    basketSize: any
  ): {
    basket_id: string;
    packages_count: number;
    total_weight: number;
    volume_used: number;
    volume_capacity: number;
    package_ids: string[];
    current_utilization: number;
  } {
    const packedPackageIds: string[] = [];
    let totalWeight = 0;
    let totalVolumeUsed = 0;
    
    console.log(`🎯 Packing basket ${basketId} - Target: ${this.TARGET_UTILIZATION_PERCENTAGE}%, Max: ${this.MAX_UTILIZATION_PERCENTAGE}%`);

    // Sort packages by size (smallest first for better packing efficiency)
    const sortedPackages = [...availablePackages].sort((a, b) => {
      const volumeA = this.estimatePackageVolume(a, basketSize);
      const volumeB = this.estimatePackageVolume(b, basketSize);
      return volumeA - volumeB;
    });

    for (const pkg of sortedPackages) {
      // Skip if already packed
      if (packedPackageIds.includes(pkg._id)) continue;
      
      const packageVolume = this.estimatePackageVolume(pkg, basketSize);
      const packageWeight = this.calculatePackageDimensions(pkg).weight;
      
      // Calculate utilization if we add this package
      const newVolumeUsed = totalVolumeUsed + packageVolume;
      const newUtilization = (newVolumeUsed / basketCapacity) * 100;
      
      // Check if adding this package would exceed maximum utilization
      if (newUtilization > this.MAX_UTILIZATION_PERCENTAGE) {
        console.log(`🚫 Package ${pkg._id} would exceed max utilization (${newUtilization.toFixed(1)}% > ${this.MAX_UTILIZATION_PERCENTAGE}%)`);
        continue;
      }
      
      // Add the package
      packedPackageIds.push(pkg._id);
      totalWeight += packageWeight;
      totalVolumeUsed = newVolumeUsed;
      
      console.log(`✅ Added package ${pkg._id} - Current utilization: ${newUtilization.toFixed(1)}%`);
      
      // Check if we've reached the target utilization
      if (newUtilization >= this.TARGET_UTILIZATION_PERCENTAGE) {
        console.log(`🎯 Target utilization ${this.TARGET_UTILIZATION_PERCENTAGE}% reached (${newUtilization.toFixed(1)}%)`);
        break;
      }
    }

    const currentUtilization = (totalVolumeUsed / basketCapacity) * 100;
    
    return {
      basket_id: basketId,
      packages_count: packedPackageIds.length,
      total_weight: totalWeight,
      volume_used: totalVolumeUsed,
      volume_capacity: basketCapacity,
      package_ids: packedPackageIds,
      current_utilization: currentUtilization
    };
  }

  /**
   * Create baskets array from utilization-based packing result
   */
  private createBasketsFromUtilizationResult(packingResult: any, basketSize: any): Array<{
    basket_id: string;
    packages_count: number;
    total_weight: number;
    volume_utilization: number;
    package_ids: string[];
  }> {
    const baskets: Array<{
      basket_id: string;
      packages_count: number;
      total_weight: number;
      volume_utilization: number;
      package_ids: string[];
    }> = [];
    
    // Extract basket information from packing result
    if (packingResult.baskets && Array.isArray(packingResult.baskets)) {
      packingResult.baskets.forEach((basket: any, index: number) => {
        baskets.push({
          basket_id: basket.basket_id || `${basketSize.package_name}_${index + 1}`,
          packages_count: basket.packages_count || 0,
          total_weight: basket.total_weight || 0,
          volume_utilization: Math.round(basket.current_utilization || 0),
          package_ids: basket.package_ids || []
        });
      });
    }
    
    return baskets;
  }

  /**
   * Calculate total package dimensions and weight from all products in the package
   * Uses smart packing strategy to optimize dimensions
   */
  private calculatePackageDimensions(pkg: PackageForProcessing): {
    weight: number;
    dimensions: { width: number; height: number; depth: number };
  } {
    // Calculate total weight of all products in the package
    const totalWeight = pkg.product_list.reduce((sum, product) => 
      sum + (product.product_weight || 100), 0
    );

    if (pkg.product_list.length === 0) {
      return {
        weight: totalWeight || 100,
        dimensions: { width: 10, height: 10, depth: 10 }
      };
    }

    // For package dimensions, use smart packing strategy instead of just stacking
    // Strategy: Try to arrange products efficiently within reasonable bounds
    
    let totalVolume = 0;
    let maxWidth = 0;
    let maxLength = 0;
    let maxHeight = 0;

    // First, get individual product dimensions and total volume
    pkg.product_list.forEach(product => {
      if (product.dimensions) {
        const { width, length, height } = product.dimensions;
        totalVolume += width * length * height;
        maxWidth = Math.max(maxWidth, width);
        maxLength = Math.max(maxLength, length);
        maxHeight = Math.max(maxHeight, height);
      } else {
        // Default dimensions if not available
        totalVolume += 10 * 10 * 10;
        maxWidth = Math.max(maxWidth, 10);
        maxLength = Math.max(maxLength, 10);
        maxHeight = Math.max(maxHeight, 10);
      }
    });

    // Smart packing: Try to fit products efficiently
    // Approach: Use cube root of total volume as base, then adjust for reasonable proportions
    const baseDimension = Math.cbrt(totalVolume);
    
    // Try to keep reasonable proportions - avoid extremely tall packages
    // Maximum height should not exceed 1.5x the largest individual product height
    const reasonableMaxHeight = Math.max(maxHeight, baseDimension * 1.2);
    
    // Calculate width and depth based on remaining volume after setting reasonable height
    const remainingVolume = totalVolume / reasonableMaxHeight;
    const baseWidthDepth = Math.sqrt(remainingVolume);
    
    // Ensure minimum dimensions from largest individual products
    const finalWidth = Math.max(maxWidth, baseWidthDepth);
    const finalDepth = Math.max(maxLength, baseWidthDepth);
    const finalHeight = Math.min(reasonableMaxHeight, totalVolume / (finalWidth * finalDepth));

    // Apply some reasonable limits to prevent extreme dimensions
    const result = {
      weight: totalWeight,
      dimensions: {
        width: Math.max(5, Math.min(50, finalWidth)),    // Min 5cm, Max 50cm
        height: Math.max(5, Math.min(30, finalHeight)),  // Min 5cm, Max 30cm (reasonable for most baskets)
        depth: Math.max(5, Math.min(50, finalDepth))     // Min 5cm, Max 50cm
      }
    };

    console.log(`📏 Package ${pkg._id}: ${pkg.product_list.length} products -> ${JSON.stringify(result.dimensions)}cm (${result.weight}g)`);
    
    return result;
  }

  /**
   * Estimate package volume within a basket using actual product dimensions
   */
  private estimatePackageVolume(pkg: PackageForProcessing, basketSize: any): number {
    const packageDimensions = this.calculatePackageDimensions(pkg);
    const packageVolume = packageDimensions.dimensions.width * 
                         packageDimensions.dimensions.height * 
                         packageDimensions.dimensions.depth;
    
    // Ensure it doesn't exceed basket capacity
    const basketCapacity = this.calculateBasketVolume(basketSize);
    return Math.min(packageVolume, basketCapacity * 0.8); // Max 80% of basket for a single package
  }

  /**
   * Calculate total basket volume capacity
   */
  private calculateBasketVolume(basketSize: any): number {
    return basketSize.package_width * basketSize.package_length * basketSize.package_height;
  }
  private createBasketsFromManyCalResult(packingResult: any, basketSize: any): Array<{
    basket_id: string;
    packages_count: number;
    total_weight: number;
    volume_utilization: number;
    package_ids: string[];
  }> {
    const baskets: Array<{
      basket_id: string;
      packages_count: number;
      total_weight: number;
      volume_utilization: number;
      package_ids: string[];
    }> = [];
    
    // Extract basket information from packing result
    if (packingResult.baskets && Array.isArray(packingResult.baskets)) {
      packingResult.baskets.forEach((basket: any, index: number) => {
        baskets.push({
          basket_id: `${basketSize.package_name}_${index + 1}`,
          packages_count: basket.packages_count || 0,
          total_weight: basket.total_weight || 0,
          volume_utilization: Math.round((basket.volume_used / basket.volume_capacity) * 100) || 0,
          package_ids: basket.package_ids || []
        });
      });
    }
    
    return baskets;
  }

  /**
   * Helper method: Create baskets array from SingleCalService result
   */
  private createBasketsFromSingleCalResult(packingResult: any, basketSize: any): Array<{
    basket_id: string;
    packages_count: number;
    total_weight: number;
    volume_utilization: number;
    package_ids: string[];
  }> {
    const baskets: Array<{
      basket_id: string;
      packages_count: number;
      total_weight: number;
      volume_utilization: number;
      package_ids: string[];
    }> = [];
    
    // Extract basket information from packing result
    if (packingResult.baskets && Array.isArray(packingResult.baskets)) {
      packingResult.baskets.forEach((basket: any, index: number) => {
        baskets.push({
          basket_id: `${basketSize.package_name}_${index + 1}`,
          packages_count: basket.packages_count || 0,
          total_weight: basket.total_weight || 0,
          volume_utilization: Math.round((basket.volume_used / basket.volume_capacity) * 100) || 0,
          package_ids: basket.package_ids || []
        });
      });
    }
    
    return baskets;
  }

  /**
   * Helper method: Extract all package IDs that were successfully packed
   */
  private extractPackedPackageIds(baskets: Array<{ package_ids: string[] }>): string[] {
    const packedIds: string[] = [];
    baskets.forEach(basket => {
      packedIds.push(...basket.package_ids);
    });
    return packedIds;
  }

  /**
   * Helper method: Update package statuses
   */
  private async updatePackagesStatus(packageIds: string[], status: PackageStatus): Promise<void> {
    if (packageIds.length > 0) {
      // Filter and validate ObjectIds
      const validObjectIds = packageIds
        .filter(id => id && Types.ObjectId.isValid(id))
        .map(id => new Types.ObjectId(id));
      
      if (validObjectIds.length > 0) {
        console.log(`🔄 Updating ${validObjectIds.length} packages to ${status} status`);
        await this.packageModel.updateMany(
          { _id: { $in: validObjectIds } },
          { 
            package_status: status,
            updatedAt: new Date()
          }
        );
      } else {
        console.warn(`⚠️ No valid package IDs found for status update to ${status}`);
      }
    }
  }

  /**
   * Create Cart and Basket records in database after successful packing
   */
  private async createCartAndBaskets(
    cartId: string,
    cartType: '1:1' | '1:m',
    basketSize: any,
    packages: PackageForProcessing[],
    basketDetails: Array<{
      basket_id: string;
      product_name?: string; // Add product name
      product_id?: string; // Add product ID
      packages_count: number;
      total_weight: number;
      volume_utilization: number;
      package_ids: string[];
    }>
  ): Promise<{ cartDbId: string; basketDbIds: string[] }> {
    console.log(`🗄️ Creating Cart and Basket records in database...`);

    try {
      // Create basket records first
      const basketRecords: any[] = [];
      const basketDbIds: string[] = [];

      for (const basketDetail of basketDetails) {
        const basketType = cartType === '1:m' ? BasketType.ONE_TO_MANY : BasketType.ONE_TO_ONE;
        
        // Get packages for this basket
        const basketPackages = packages.filter(pkg => basketDetail.package_ids.includes(pkg._id));

        let basketRecord;

        if (cartType === '1:m') {
          // For 1:m, use single_package field
          basketRecord = new this.basketModel({
            basket_size: {
              _id: Types.ObjectId.isValid(basketSize._id) ? new Types.ObjectId(basketSize._id) : new Types.ObjectId(),
              package_id: basketSize.package_id,
              package_name: basketSize.package_name,
              package_width: basketSize.package_width,
              package_length: basketSize.package_length,
              package_height: basketSize.package_height,
              package_weight: basketSize.package_weight,
              package_cost: basketSize.package_cost,
            },
            single_package: basketPackages.length > 0 ? {
              _id: Types.ObjectId.isValid(basketPackages[0]._id) ? new Types.ObjectId(basketPackages[0]._id) : new Types.ObjectId(),
              product_list: basketPackages[0].product_list.map(product => ({
                _id: Types.ObjectId.isValid(product._id) ? new Types.ObjectId(product._id) : new Types.ObjectId(),
                product_name: product.product_name || 'Unknown Product'
              })),
              package_type: basketPackages[0].package_type,
              package_status: PackageStatus.PACKED,
            } : null,
            package_list: [], // Empty for 1:m
            basket_type: basketType,
            basket_status: BasketStatus.PENDING,
          });
        } else {
          // For 1:1, use package_list field
          basketRecord = new this.basketModel({
            basket_size: {
              _id: Types.ObjectId.isValid(basketSize._id) ? new Types.ObjectId(basketSize._id) : new Types.ObjectId(),
              package_id: basketSize.package_id,
              package_name: basketSize.package_name,
              package_width: basketSize.package_width,
              package_length: basketSize.package_length,
              package_height: basketSize.package_height,
              package_weight: basketSize.package_weight,
              package_cost: basketSize.package_cost,
            },
            package_list: basketPackages.map(pkg => ({
              _id: Types.ObjectId.isValid(pkg._id) ? new Types.ObjectId(pkg._id) : new Types.ObjectId(),
              product_list: pkg.product_list.map(product => ({
                _id: Types.ObjectId.isValid(product._id) ? new Types.ObjectId(product._id) : new Types.ObjectId(),
                product_name: product.product_name || 'Unknown Product'
              })),
              package_type: pkg.package_type,
              package_status: PackageStatus.PACKED,
            })),
            single_package: null, // Null for 1:1
            basket_type: basketType,
            basket_status: BasketStatus.PENDING,
          });
        }

        const savedBasket = await basketRecord.save();
        
        // Get product info for this basket (for 1:1 carts with product grouping)
        const productInfo = basketPackages.length > 0 ? {
          product_name: basketDetail.product_name || basketPackages[0].product_list[0]?.product_name || 'Unknown Product',
          product_id: basketDetail.product_id || basketPackages[0].product_list[0]?._id || 'unknown'
        } : { product_name: 'Unknown Product', product_id: 'unknown' };
        
        basketRecords.push({
          _id: savedBasket._id,
          basket_size: basketRecord.basket_size,
          basket_type: basketType.toString(),
          basket_status: BasketStatus.PENDING,
          package_count: basketDetail.packages_count,
          total_products: basketPackages.reduce((total, pkg) => total + pkg.product_list.length, 0),
          product_name: productInfo.product_name, // Add product name to database record
          product_id: productInfo.product_id, // Add product ID to database record
        });
        basketDbIds.push(savedBasket._id.toString());
      }

      // Calculate totals
      const totalBaskets = basketRecords.length;
      const totalPackages = packages.length;
      const totalProducts = packages.reduce((total, pkg) => total + pkg.product_list.length, 0);
      const totalCost = basketRecords.reduce((total, basket) => total + basket.basket_size.package_cost, 0);

      // Create cart record
      const cartRecord = new this.cartModel({
        basket_list: basketRecords,
        cart_status: CartStatus.PENDING,
        total_baskets: totalBaskets,
        total_packages: totalPackages,
        total_products: totalProducts,
        total_cost: totalCost,
      });

      const savedCart = await cartRecord.save();
      console.log(`✅ Cart saved to database with ID: ${savedCart._id}`);
      console.log(`✅ ${basketDbIds.length} Baskets saved to database`);

      return {
        cartDbId: savedCart._id.toString(),
        basketDbIds: basketDbIds,
      };

    } catch (error) {
      console.error('❌ Error creating Cart and Baskets in database:', error);
      throw error;
    }
  }

  /**
   * Helper method: Create failed cart result and reset package statuses
   */
  private async createFailedCartResult(
    cartId: string,
    cartType: '1:1' | '1:m',
    basketSizeName: string,
    jobId: string,
    errorMessage: string,
    packages?: PackageForProcessing[]
  ): Promise<CartPackingResult> {
    console.log(`❌ Creating failed cart result: ${errorMessage}`);
    
    // If packages provided, reset them to UNPACK status
    if (packages && packages.length > 0) {
      console.log(`🔄 Resetting ${packages.length} packages to UNPACK status due to packing failure`);
      const allPackageIds = packages.map(pkg => pkg._id);
      await this.updatePackagesStatus(allPackageIds, PackageStatus.UNPACK);
    }

    return {
      success: false,
      cart_object_id: cartId,
      cart_type: cartType,
      basket_size_used: basketSizeName,
      total_baskets: 0,
      packages_processed: packages?.length || 0,
      packages_packed: 0,
      packages_unpacked: packages?.length || 0,
      job_id: jobId,
      cart_details: { baskets: [] },
      message: errorMessage
    };
  }

  /**
   * Get packing statistics
   */
  async getPackingStats(): Promise<{
    total_unpack_packages: number;
    packages_in_processing: number;
    completed_jobs_today: number;
    failed_jobs_today: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [unpackCount, processingCount, completedJobs, failedJobs] = await Promise.all([
      this.packageModel.countDocuments({ package_status: PackageStatus.UNPACK }),
      this.packageModel.countDocuments({ package_status: PackageStatus.IN_PROCESS }),
      this.jobModel.countDocuments({ 
        job_status: JobStatus.COMPLETED,
        createdAt: { $gte: today }
      }),
      this.jobModel.countDocuments({ 
        job_status: JobStatus.CANCELLED,
        createdAt: { $gte: today }
      })
    ]);

    return {
      total_unpack_packages: unpackCount,
      packages_in_processing: processingCount,
      completed_jobs_today: completedJobs,
      failed_jobs_today: failedJobs
    };
  }

  /**
   * Get all packed packages with their cart and basket information
   * Returns a flattened view showing which cart and basket each package belongs to
   */
  async getPackedPackagesWithLocation(): Promise<Array<{
    package_id: string;
    product_list: Array<{
      _id: string;
      product_name: string;
      product_weight: number;
      dimensions: {
        width: number;
        length: number;
        height: number;
      };
    }>;
    cart_id: string;
    basket_id: string;
    created_at: Date;
  }>> {
    console.log('📋 Fetching all packages with cart and basket information...');

    try {
      const result: Array<{
        package_id: string;
        product_list: Array<{
          _id: string;
          product_name: string;
          product_weight: number;
          dimensions: {
            width: number;
            length: number;
            height: number;
          };
        }>;
        cart_id: string;
        basket_id: string;
        created_at: Date;
      }> = [];

      // Get all baskets with their packages
      const baskets = await this.basketModel
        .find()
        .sort({ createdAt: 1 })
        .lean();

      // Get all carts to map basket IDs to cart IDs
      const carts = await this.cartModel
        .find()
        .lean();

      console.log(`�️ Found ${baskets.length} baskets and ${carts.length} carts`);

      // Create a map of basket ID to cart ID
      const basketToCartMap = new Map<string, string>();
      
      for (const cart of carts) {
        if (cart.basket_list && Array.isArray(cart.basket_list)) {
          for (const basketSummary of cart.basket_list) {
            basketToCartMap.set(basketSummary._id.toString(), cart._id.toString());
          }
        }
      }

      // Process each basket to extract packages
      for (const basket of baskets) {
        const basketId = basket._id.toString();
        const cartId = basketToCartMap.get(basketId);

        if (!cartId) {
          console.warn(`⚠️ No cart found for basket ${basketId}`);
          continue;
        }

        // Get packages from this basket
        const packagesFromBasket: any[] = [];

        // Check package_list (for 1:1 baskets)
        if ((basket as any).package_list && Array.isArray((basket as any).package_list)) {
          packagesFromBasket.push(...(basket as any).package_list);
        }

        // Check single_package (for 1:m baskets)
        if ((basket as any).single_package && (basket as any).single_package._id) {
          packagesFromBasket.push((basket as any).single_package);
        }

        // Process each package in this basket
        for (const packageInfo of packagesFromBasket) {
          // Get full package details with populated product information
          const fullPackage = await this.packageModel
            .findById(packageInfo._id)
            .populate('product_list._id', 'product_name product_weight dimensions')
            .lean();

          if (fullPackage) {
            // Process product list with populated data
            const productList = fullPackage.product_list.map((p: any) => {
              const productId = p._id?._id?.toString() || p._id?.toString() || p.toString();
              const productName = p._id?.product_name || p.product_name || 'Unknown Product';
              const productWeight = p._id?.product_weight || p.product_weight || 100;
              const dimensions = p._id?.dimensions || p.dimensions || { 
                width: 10, length: 10, height: 10 
              };
              
              return {
                _id: productId,
                product_name: productName,
                product_weight: productWeight,
                dimensions: {
                  width: dimensions.width || 10,
                  length: dimensions.length || 10,
                  height: dimensions.height || 10
                }
              };
            });

            result.push({
              package_id: fullPackage._id.toString(),
              product_list: productList,
              cart_id: cartId,
              basket_id: basketId,
              created_at: (fullPackage as any).createdAt || new Date()
            });
          }
        }
      }

      // Sort by creation date (oldest first)
      result.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

      console.log(`✅ Found ${result.length} packages with location information`);
      
      return result;

    } catch (error) {
      console.error('❌ Error fetching packages with location:', error);
      throw error;
    }
  }
}
