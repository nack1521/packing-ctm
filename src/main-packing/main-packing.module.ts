import { Module } from '@nestjs/common';
import { MainPackingService } from './main-packing.service';
import { MainPackingController } from './main-packing.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Package, PackageSchema } from '../packages/schemas/package.schema';
import { Job, JobSchema } from '../jobs/schemas/job.schema';
import { BasketSize, BasketSizeSchema } from '../basket_sizes/schemas/basket_size.schema';
import { Cart, CartSchema } from '../carts/schemas/cart.schema';
import { Basket, BasketSchema } from '../baskets/schemas/basket.schema';
import { SingleCalModule } from '../single_cal/single_cal.module';
import { ManyCalModule } from '../many_cal/many_cal.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Package.name, schema: PackageSchema },
      { name: Job.name, schema: JobSchema },
      { name: BasketSize.name, schema: BasketSizeSchema },
      { name: Cart.name, schema: CartSchema },
      { name: Basket.name, schema: BasketSchema }
    ]),
    SingleCalModule,
    ManyCalModule
  ],
  controllers: [MainPackingController],
  providers: [MainPackingService],
  exports: [MainPackingService]
})
export class MainPackingModule {}
