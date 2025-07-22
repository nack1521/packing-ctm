import { Module } from '@nestjs/common';
import { ManyCalService } from './many_cal.service';
import { ManyCalController } from './many_cal.controller';
import { CalculateModule } from '../calculate/calculate.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Package, PackageSchema } from '../packages/schemas/package.schema';

@Module({
  imports: [
    CalculateModule,
    MongooseModule.forFeature([{ name: Package.name, schema: PackageSchema }])
  ],
  controllers: [ManyCalController],
  providers: [ManyCalService],
  exports: [ManyCalService]
})
export class ManyCalModule {}
