import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from '../products/schemas/product.schema';
import { Package, PackageStatus, PackageType } from '../packages/schemas/package.schema';

export interface GeneratePackagesDto {
  oneToOneCount?: number;
  oneToManyCount?: number;
}

export interface PackageGenerationResult {
  success: boolean;
  generated_packages: number;
  breakdown: {
    one_to_one: number;
    one_to_many: number;
  };
  package_ids: string[];
  message: string;
}

@Injectable()
export class PackageGeneratorService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Package.name) private packageModel: Model<Package>
  ) {}

  /**
   * Generate random packages using existing products
   * Default: 80 1:1 packages and 80 1:m packages
   */
  async generateRandomPackages(dto?: GeneratePackagesDto): Promise<PackageGenerationResult> {
    const oneToOneCount = dto?.oneToOneCount || 80;
    const oneToManyCount = dto?.oneToManyCount || 80;

    try {
      console.log(`🎲 Generating ${oneToOneCount} 1:1 packages and ${oneToManyCount} 1:m packages...`);

      // Step 1: Get all product ObjectIds
      const products = await this.productModel.find().lean().exec();
      
      if (products.length === 0) {
        return {
          success: false,
          generated_packages: 0,
          breakdown: { one_to_one: 0, one_to_many: 0 },
          package_ids: [],
          message: 'No products found in database. Please create products first.'
        };
      }

      console.log(`📦 Found ${products.length} products to use for package generation`);

      // Step 2: Generate 1:1 packages (ONE_TO_ONE) - Single product per package
      const oneToOnePackages: Array<any> = [];
      for (let i = 0; i < oneToOneCount; i++) {
        const randomProduct = this.getRandomProduct(products);
        
        const packageData = {
          product_list: [{
            _id: randomProduct._id,
            product_name: randomProduct.product_name
          }],
          package_type: PackageType.ONE_TO_ONE,
          package_status: PackageStatus.UNPACK,
          createdAt: this.getRandomDateBetween(new Date('2025-06-01'), new Date('2025-07-31')),
          updatedAt: new Date()
        };

        oneToOnePackages.push(packageData);
      }

      // Step 3: Generate 1:m packages (ONE_TO_MANY) - Multiple products per package
      const oneToManyPackages: Array<any> = [];
      for (let i = 0; i < oneToManyCount; i++) {
        // Generate 5-20 random products for each ONE_TO_MANY package
        const productCount = Math.floor(Math.random() * 16) + 5; // 5 to 20 products
        const selectedProducts: Array<{ _id: any; product_name: string }> = [];
        
        for (let j = 0; j < productCount; j++) {
          const randomProduct = this.getRandomProduct(products);
          selectedProducts.push({
            _id: randomProduct._id,
            product_name: randomProduct.product_name
          });
        }
        
        const packageData = {
          product_list: selectedProducts,
          package_type: PackageType.ONE_TO_MANY,
          package_status: PackageStatus.UNPACK,
          createdAt: this.getRandomDateBetween(new Date('2025-06-01'), new Date('2025-07-31')),
          updatedAt: new Date()
        };

        oneToManyPackages.push(packageData);
      }

      // Step 4: Insert all packages to database
      const allPackages = [...oneToOnePackages, ...oneToManyPackages];
      const insertedPackages = await this.packageModel.insertMany(allPackages);

      console.log(`✅ Successfully generated ${insertedPackages.length} packages`);

      return {
        success: true,
        generated_packages: insertedPackages.length,
        breakdown: {
          one_to_one: oneToOneCount,
          one_to_many: oneToManyCount
        },
        package_ids: insertedPackages.map(pkg => pkg._id.toString()),
        message: `Successfully generated ${oneToOneCount} 1:1 packages and ${oneToManyCount} 1:m packages`
      };

    } catch (error) {
      console.error('❌ Error generating packages:', error);
      return {
        success: false,
        generated_packages: 0,
        breakdown: { one_to_one: 0, one_to_many: 0 },
        package_ids: [],
        message: `Error generating packages: ${error.message}`
      };
    }
  }

  /**
   * Generate packages with specific product distributions
   */
  async generatePackagesWithProductDistribution(
    productDistribution: Array<{
      product_id: string;
      one_to_one_count: number;
      one_to_many_count: number;
    }>
  ): Promise<PackageGenerationResult> {
    try {
      let totalOneToOne = 0;
      let totalOneToMany = 0;
      const allPackages: Array<any> = [];

      for (const distribution of productDistribution) {
        // Get product details
        const product = await this.productModel.findById(distribution.product_id).lean().exec();
        if (!product) {
          console.warn(`⚠️ Product ${distribution.product_id} not found, skipping...`);
          continue;
        }

        // Generate 1:1 packages for this product
        for (let i = 0; i < distribution.one_to_one_count; i++) {
          allPackages.push({
            product_list: [{
              _id: product._id,
              product_name: product.product_name
            }],
            package_type: PackageType.ONE_TO_ONE,
            package_status: PackageStatus.UNPACK,
            createdAt: this.getRandomDateBetween(new Date('2025-06-01'), new Date('2025-07-31')),
            updatedAt: new Date()
          });
          totalOneToOne++;
        }

        // Generate 1:m packages for this product (with multiple products)
        for (let i = 0; i < distribution.one_to_many_count; i++) {
          // For 1:m, include this specific product plus 1-4 additional random products
          const additionalProductCount = Math.floor(Math.random() * 4) + 1; // 1 to 4 additional
          const selectedProducts = [
            {
              _id: product._id,
              product_name: product.product_name
            }
          ];

          // Add random additional products
          const allProducts = await this.productModel.find().lean().exec();
          for (let j = 0; j < additionalProductCount; j++) {
            const randomProduct = this.getRandomProduct(allProducts);
            selectedProducts.push({
              _id: randomProduct._id,
              product_name: randomProduct.product_name
            });
          }

          allPackages.push({
            product_list: selectedProducts,
            package_type: PackageType.ONE_TO_MANY,
            package_status: PackageStatus.UNPACK,
            createdAt: this.getRandomDateBetween(new Date('2025-06-01'), new Date('2025-07-31')),
            updatedAt: new Date()
          });
          totalOneToMany++;
        }
      }

      // Insert all packages
      const insertedPackages = await this.packageModel.insertMany(allPackages);

      return {
        success: true,
        generated_packages: insertedPackages.length,
        breakdown: {
          one_to_one: totalOneToOne,
          one_to_many: totalOneToMany
        },
        package_ids: insertedPackages.map(pkg => pkg._id.toString()),
        message: `Successfully generated ${totalOneToOne} 1:1 and ${totalOneToMany} 1:m packages with custom distribution`
      };

    } catch (error) {
      console.error('❌ Error generating packages with distribution:', error);
      return {
        success: false,
        generated_packages: 0,
        breakdown: { one_to_one: 0, one_to_many: 0 },
        package_ids: [],
        message: `Error generating packages: ${error.message}`
      };
    }
  }

  /**
   * Clear all unpack packages (for testing)
   */
  async clearUnpackPackages(): Promise<{
    success: boolean;
    deleted_count: number;
    message: string;
  }> {
    try {
      const result = await this.packageModel.deleteMany({ 
        package_status: PackageStatus.UNPACK 
      });

      return {
        success: true,
        deleted_count: result.deletedCount || 0,
        message: `Successfully deleted ${result.deletedCount || 0} unpack packages`
      };
    } catch (error) {
      console.error('❌ Error clearing packages:', error);
      return {
        success: false,
        deleted_count: 0,
        message: `Error clearing packages: ${error.message}`
      };
    }
  }

  /**
   * Get package generation statistics
   */
  async getPackageStats(): Promise<{
    total_packages: number;
    unpack_packages: number;
    one_to_one_packages: number;
    one_to_many_packages: number;
    processing_packages: number;
    packed_packages: number;
    available_products: number;
  }> {
    const [
      totalPackages,
      unpackPackages,
      oneToOnePackages,
      oneToManyPackages,
      processingPackages,
      packedPackages,
      totalProducts
    ] = await Promise.all([
      this.packageModel.countDocuments(),
      this.packageModel.countDocuments({ package_status: PackageStatus.UNPACK }),
      this.packageModel.countDocuments({ package_type: PackageType.ONE_TO_ONE }),
      this.packageModel.countDocuments({ package_type: PackageType.ONE_TO_MANY }),
      this.packageModel.countDocuments({ package_status: PackageStatus.IN_PROCESS }),
      this.packageModel.countDocuments({ package_status: PackageStatus.PACKED }),
      this.productModel.countDocuments()
    ]);

    return {
      total_packages: totalPackages,
      unpack_packages: unpackPackages,
      one_to_one_packages: oneToOnePackages,
      one_to_many_packages: oneToManyPackages,
      processing_packages: processingPackages,
      packed_packages: packedPackages,
      available_products: totalProducts
    };
  }

  /**
   * Get random product from array
   */
  private getRandomProduct(products: any[]): any {
    const randomIndex = Math.floor(Math.random() * products.length);
    return products[randomIndex];
  }

  /**
   * Get random date between two dates
   */
  private getRandomDateBetween(startDate: Date, endDate: Date): Date {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    const randomTime = startTime + Math.random() * (endTime - startTime);
    return new Date(randomTime);
  }

  /**
   * Get all products (for reference)
   */
  async getAllProducts(): Promise<Array<{
    _id: string;
    product_name: string;
    product_weight: number;
    dimensions: {
      width: number;
      length: number;
      height: number;
    };
  }>> {
    const products = await this.productModel.find().lean().exec();
    return products.map(product => ({
      _id: product._id.toString(),
      product_name: product.product_name,
      product_weight: product.product_weight,
      dimensions: product.dimensions
    }));
  }
}
