import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { CalculateService, PackageInput, BasketInput } from './calculate.service';

export class CalculatePackingDto {
  packages: PackageInput[];
  basket: BasketInput;
}

export class FindOptimalBasketDto {
  packages: PackageInput[];
  baskets: BasketInput[];
}

@Controller('calculate')
export class CalculateController {
  constructor(private readonly calculateService: CalculateService) {}

  @Post('packing')
  async calculatePacking(@Body() calculatePackingDto: CalculatePackingDto) {
    const { packages, basket } = calculatePackingDto;
    return await this.calculateService.calculatePacking(packages, basket);
  }

  @Post('optimal-basket')
  async findOptimalBasket(@Body() findOptimalBasketDto: FindOptimalBasketDto) {
    const { packages, baskets } = findOptimalBasketDto;
    return await this.calculateService.findOptimalBasket(packages, baskets);
  }

  @Post('stats')
  async getPackingStats(@Body() body: { packages: PackageInput[] }) {
    return await this.calculateService.getPackingStats(body.packages);
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'Calculate Service',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  }
}
