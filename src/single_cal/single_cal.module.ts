import { Module } from '@nestjs/common';
import { SingleCalService } from './single_cal.service';
import { SingleCalController } from './single_cal.controller';
import { CalculateModule } from '../calculate/calculate.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Package, PackageSchema } from '../packages/schemas/package.schema';

@Module({
  imports: [
    CalculateModule,
    MongooseModule.forFeature([{ name: Package.name, schema: PackageSchema }])
  ],
  controllers: [SingleCalController],
  providers: [SingleCalService],
  exports: [SingleCalService]
})
export class SingleCalModule {}
