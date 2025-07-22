import { Controller, Post, Get, Delete, Body, Query } from '@nestjs/common';
import { PackageGeneratorService, GeneratePackagesDto, PackageGenerationResult } from './package-generator.service';

@Controller('package-generator')
export class PackageGeneratorController {
  constructor(private readonly packageGeneratorService: PackageGeneratorService) {}

  /**
   * Generate random packages
   * Default: 80 1:1 packages and 80 1:m packages
   * 
   * @example POST /package-generator/generate
   * {
   *   "oneToOneCount": 80,
   *   "oneToManyCount": 80
   * }
   */
  @Post('generate')
  async generateRandomPackages(
    @Body() dto?: GeneratePackagesDto
  ): Promise<PackageGenerationResult> {
    return this.packageGeneratorService.generateRandomPackages(dto);
  }

  /**
   * Generate packages with specific product distribution
   * 
   * @example POST /package-generator/generate-with-distribution
   * {
   *   "productDistribution": [
   *     {
   *       "product_id": "60d5ecb74b24a9001f647a01",
   *       "one_to_one_count": 20,
   *       "one_to_many_count": 30
   *     },
   *     {
   *       "product_id": "60d5ecb74b24a9001f647a02", 
   *       "one_to_one_count": 60,
   *       "one_to_many_count": 50
   *     }
   *   ]
   * }
   */
  @Post('generate-with-distribution')
  async generatePackagesWithDistribution(
    @Body() body: {
      productDistribution: Array<{
        product_id: string;
        one_to_one_count: number;
        one_to_many_count: number;
      }>
    }
  ): Promise<PackageGenerationResult> {
    return this.packageGeneratorService.generatePackagesWithProductDistribution(
      body.productDistribution
    );
  }

  /**
   * Get all available products for reference
   * 
   * @example GET /package-generator/products
   */
  @Get('products')
  async getAllProducts() {
    return this.packageGeneratorService.getAllProducts();
  }

  /**
   * Get package generation statistics
   * 
   * @example GET /package-generator/stats
   */
  @Get('stats')
  async getPackageStats() {
    return this.packageGeneratorService.getPackageStats();
  }

  /**
   * Clear all unpack packages (for testing)
   * 
   * @example DELETE /package-generator/clear-unpack
   */
  @Delete('clear-unpack')
  async clearUnpackPackages() {
    return this.packageGeneratorService.clearUnpackPackages();
  }

  /**
   * Generate only 1:1 packages
   * 
   * @example POST /package-generator/generate-1to1
   * {
   *   "count": 50
   * }
   */
  @Post('generate-1to1')
  async generateOnly1to1Packages(
    @Body() body?: { count?: number }
  ): Promise<PackageGenerationResult> {
    const count = body?.count || 80;
    return this.packageGeneratorService.generateRandomPackages({
      oneToOneCount: count,
      oneToManyCount: 0
    });
  }

  /**
   * Generate only 1:m packages
   * 
   * @example POST /package-generator/generate-1tom
   * {
   *   "count": 50
   * }
   */
  @Post('generate-1tom')
  async generateOnly1tomPackages(
    @Body() body?: { count?: number }
  ): Promise<PackageGenerationResult> {
    const count = body?.count || 80;
    return this.packageGeneratorService.generateRandomPackages({
      oneToOneCount: 0,
      oneToManyCount: count
    });
  }

  /**
   * Quick generate only 1:1 packages with query parameter
   * 
   * @example GET /package-generator/quick-1to1?count=50
   */
  @Get('quick-1to1')
  async quickGenerate1to1(
    @Query('count') count?: string
  ): Promise<PackageGenerationResult> {
    const packageCount = count ? parseInt(count) : 80;
    return this.packageGeneratorService.generateRandomPackages({
      oneToOneCount: packageCount,
      oneToManyCount: 0
    });
  }

  /**
   * Quick generate only 1:m packages with query parameter
   * 
   * @example GET /package-generator/quick-1tom?count=50
   */
  @Get('quick-1tom')
  async quickGenerate1tom(
    @Query('count') count?: string
  ): Promise<PackageGenerationResult> {
    const packageCount = count ? parseInt(count) : 80;
    return this.packageGeneratorService.generateRandomPackages({
      oneToOneCount: 0,
      oneToManyCount: packageCount
    });
  }

  /**
   * Quick generate with query parameters
   * 
   * @example GET /package-generator/quick-generate?oneToOne=50&oneToMany=50
   */
  @Get('quick-generate')
  async quickGenerate(
    @Query('oneToOne') oneToOne?: string,
    @Query('oneToMany') oneToMany?: string
  ): Promise<PackageGenerationResult> {
    const oneToOneCount = oneToOne ? parseInt(oneToOne) : 80;
    const oneToManyCount = oneToMany ? parseInt(oneToMany) : 80;

    return this.packageGeneratorService.generateRandomPackages({
      oneToOneCount,
      oneToManyCount
    });
  }
}
