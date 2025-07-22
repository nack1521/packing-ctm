import { Module } from '@nestjs/common';
import { BasketSizesService } from './basket_sizes.service';
import { BasketSizesController } from './basket_sizes.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { BasketSize, BasketSizeSchema } from './schemas/basket_size.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BasketSize.name, schema: BasketSizeSchema }]),
  ],
  controllers: [BasketSizesController],
  providers: [BasketSizesService],
  exports: [BasketSizesService],
})
export class BasketSizesModule {}
