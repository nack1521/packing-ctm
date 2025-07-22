import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PackageGeneratorController } from './package-generator.controller';
import { PackageGeneratorService } from './package-generator.service';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Package, PackageSchema } from '../packages/schemas/package.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Package.name, schema: PackageSchema }
    ])
  ],
  controllers: [PackageGeneratorController],
  providers: [PackageGeneratorService],
  exports: [PackageGeneratorService] // Export service for use in other modules
})
export class PackageGeneratorModule {}
