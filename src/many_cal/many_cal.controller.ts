import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ManyCalService } from './many_cal.service';
import { CreateManyCalDto } from './dto/create-many_cal.dto';
import { UpdateManyCalDto } from './dto/update-many_cal.dto';

export class PackManyCalDto {
  package: {
    _id: string;
    product_id: string;
    weight: number;
    dimensions: {
      width: number;
      height: number;
      depth: number;
    };
    quantity: number;
    package_type: string;
    package_status: string;
    cost: number;
  };
  basketOptions: Array<{
    basket_size_id: string;
    dimensions: {
      width: number;
      height: number;
      depth: number;
    };
    max_weight: number;
    cost: number;
  }>;
}

export class FindOptimalBasketDto {
  package: {
    _id: string;
    product_id: string;
    weight: number;
    dimensions: {
      width: number;
      height: number;
      depth: number;
    };
    quantity: number;
    package_type: string;
    package_status: string;
    cost: number;
  };
  basketOptions: Array<{
    basket_size_id: string;
    dimensions: {
      width: number;
      height: number;
      depth: number;
    };
    max_weight: number;
    cost: number;
  }>;
}

@Controller('many-cal')
export class ManyCalController {
  constructor(private readonly manyCalService: ManyCalService) {}

  @Post('pack')
  async packManyCal(@Body() packDto: PackManyCalDto) {
    return await this.manyCalService.packManyCal(packDto.package, packDto.basketOptions);
  }

  @Post('optimal-basket')
  async findOptimalBasket(@Body() findOptimalDto: FindOptimalBasketDto) {
    return await this.manyCalService.findOptimalBasketForPackage(findOptimalDto.package, findOptimalDto.basketOptions);
  }

  @Post()
  create(@Body() createManyCalDto: CreateManyCalDto) {
    return this.manyCalService.create(createManyCalDto);
  }

  @Get()
  findAll() {
    return this.manyCalService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.manyCalService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateManyCalDto: UpdateManyCalDto) {
    return this.manyCalService.update(+id, updateManyCalDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.manyCalService.remove(+id);
  }
}
