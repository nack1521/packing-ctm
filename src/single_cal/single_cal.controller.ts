import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SingleCalService } from './single_cal.service';
import { CreateSingleCalDto } from './dto/create-single_cal.dto';
import { UpdateSingleCalDto } from './dto/update-single_cal.dto';

export class PackSingleCalDto {
  packages: Array<{
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
  }>;
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

@Controller('single-cal')
export class SingleCalController {
  constructor(private readonly singleCalService: SingleCalService) {}

  @Post('pack')
  async packSingleCal(@Body() packDto: PackSingleCalDto) {
    return await this.singleCalService.packSingleCal(packDto.packages, packDto.basketOptions);
  }

  @Post()
  create(@Body() createSingleCalDto: CreateSingleCalDto) {
    return this.singleCalService.create(createSingleCalDto);
  }

  @Get()
  findAll() {
    return this.singleCalService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.singleCalService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSingleCalDto: UpdateSingleCalDto) {
    return this.singleCalService.update(+id, updateSingleCalDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.singleCalService.remove(+id);
  }
}
