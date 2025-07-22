import { Controller, Post, Get } from '@nestjs/common';
import { MainPackingService, CartPackingResult } from './main-packing.service';

@Controller('main-packing')
export class MainPackingController {
  constructor(private readonly mainPackingService: MainPackingService) {}

  /**
   * Main endpoint: Process packing workflow
   * Processes unpack packages through the complete 3D bin packing workflow
   * 
   * @example POST /main-packing/process-packages
   * @returns CartPackingResult with job details, cart info, and packing results
   */
  @Post('process-packages')
  async processPackingWorkflow(): Promise<CartPackingResult> {
    return this.mainPackingService.processPackingWorkflow();
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
    created_at: Date;
  }>> {
    return this.mainPackingService.getPackedPackagesWithLocation();
  }
}