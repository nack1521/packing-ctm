import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PackagesModule } from './packages/packages.module';
import { JobsModule } from './jobs/jobs.module';
import { ProductsModule } from './products/products.module';
import { CartsModule } from './carts/carts.module';
import { BasketsModule } from './baskets/baskets.module';
import { MongooseModule } from '@nestjs/mongoose';
import { BasketSizesModule } from './basket_sizes/basket_sizes.module';
import { SingleCalModule } from './single_cal/single_cal.module';
import { ManyCalModule } from './many_cal/many_cal.module';
import { CalculateModule } from './calculate/calculate.module';
import { MainPackingModule } from './main-packing/main-packing.module';
import { PackageGeneratorModule } from './package-generator/package-generator.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost/27017', {dbName: 'ctm-packing'}),
    PackagesModule, 
    JobsModule, 
    ProductsModule,
    CartsModule, 
    BasketsModule, 
    BasketSizesModule, 
    SingleCalModule, 
    ManyCalModule,
    CalculateModule,
    MainPackingModule,
    PackageGeneratorModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
