import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BasketsService } from './baskets.service';
import { BasketsController } from './baskets.controller';
import { Basket, BasketSchema } from './schemas/basket.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Basket.name, schema: BasketSchema }
    ])
  ],
  controllers: [BasketsController],
  providers: [BasketsService],
  exports: [BasketsService],
})
export class BasketsModule {}
