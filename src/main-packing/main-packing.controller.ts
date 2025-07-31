import { Controller, Post, Get, HttpException, HttpStatus, Query, Body } from '@nestjs/common';
import { MainPackingService, CartPackingResultNew} from './main-packing.service';

@Controller('main-packing')
export class MainPackingController {
  constructor(
    private readonly mainPackingService: MainPackingService
  ) {}

  

  @Post('process-packages-mix')
  async processMixPackingWorkflow(): Promise<CartPackingResultNew> {
    return this.mainPackingService.processMixPackingWorkflow();
  }

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