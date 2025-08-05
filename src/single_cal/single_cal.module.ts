import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SingleCalService } from './single_cal.service';
import { SingleCalController } from './single_cal.controller';
import { Package, PackageSchema } from '../packages/schemas/package.schema';
import { BasketSize, BasketSizeSchema } from '../basket_sizes/schemas/basket_size.schema';
import { CalculateModule } from '../calculate/calculate.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Package.name, schema: PackageSchema },
      { name: BasketSize.name, schema: BasketSizeSchema }
    ]),
    CalculateModule
  ],
  controllers: [SingleCalController],
  providers: [SingleCalService],
  exports: [SingleCalService]
})
export class SingleCalModule {}
