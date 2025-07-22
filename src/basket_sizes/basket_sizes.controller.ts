import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BasketSizesService } from './basket_sizes.service';
import { CreateBasketSizeDto } from './dto/create-basket_size.dto';
import { UpdateBasketSizeDto } from './dto/update-basket_size.dto';

@Controller('basket-sizes')
export class BasketSizesController {
  constructor(private readonly basketSizesService: BasketSizesService) {}

  @Post()
  create(@Body() createBasketSizeDto: CreateBasketSizeDto) {
    return this.basketSizesService.create(createBasketSizeDto);
  }

  @Get()
  findAll() {
    return this.basketSizesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.basketSizesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBasketSizeDto: UpdateBasketSizeDto) {
    return this.basketSizesService.update(id, updateBasketSizeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.basketSizesService.remove(id);
  }
}
