import { Controller, Post, Get, HttpException, HttpStatus, Query, Body } from '@nestjs/common';
import { MainPackingService} from './main-packing.service';
import { MainPackingServiceNew, CartPackingResultNew } from './main-packing.service.simplified';

@Controller('main-packing')
export class MainPackingController {
  constructor(
    private readonly mainPackingService: MainPackingServiceNew,
    private readonly mainPackingServiceOld: MainPackingService
  ) {}

  /**
   * Main endpoint: Process packing workflow
   * Processes unpack packages through the complete 3D bin packing workflow
   * 
   * @example POST /main-packing/process-packages
   * @returns CartPackingResult with job details, cart info, and packing results
   */
  @Post('process-packages')
  async processPackingWorkflow(): Promise<CartPackingResultNew> {
    return this.mainPackingService.processPackingWorkflow();
  }

  

  @Post('process-packages-mix')
  async processMixPackingWorkflow(): Promise<CartPackingResultNew> {
    return this.mainPackingService.processMixPackingWorkflow();
  }

  @Post('process')
  async processPacking() {
    const result = await this.mainPackingServiceOld.processPackingWorkflow();
    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }
    return result;
  }

  
  /**
   * Get all packed packages with their cart and basket information
   * Returns a flattened view of all packages showing which cart and basket they belong to
   * 
   * @example GET /main-packing/packages
   * @returns Array of packages with cart and basket information, sorted by creation date
   */
  @Get('packages')
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
    createdAt: Date;
  }>> {
    return this.mainPackingService.getPackedPackagesWithLocation();
  }

  /**
   * Get packing statistics
   * Returns current statistics about packages and jobs
   * 
   * @example GET /main-packing/stats
   * @returns Object with package and job statistics
   */
  @Get('stats')
  async getPackingStats(): Promise<{
    total_unpack_packages: number;
    packages_in_processing: number;
    completed_jobs_today: number;
    failed_jobs_today: number;
  }> {
    return this.mainPackingService.getPackingStats();
  }


  @Post('find')
  async findSmallestBasket(@Body() body: any): Promise<any> {
    return this.mainPackingService.findSmallestBasket(body);
  }
}