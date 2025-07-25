import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Package, PackageStatus, PackageType } from '../packages/schemas/package.schema';
import { Job, JobType, JobStatus, JobPriority } from '../jobs/schemas/job.schema';
import { BasketSize } from '../basket_sizes/schemas/basket_size.schema';
import { Cart, CartStatus } from '../carts/schemas/cart.schema';
import { Basket, BasketType, BasketStatus } from '../baskets/schemas/basket.schema';
import { SingleCalService } from '../single_cal/single_cal.service';
import { ManyCalService } from '../many_cal/many_cal.service';
import { 
  PACKING_CONFIG, 
  DEFAULT_DIMENSIONS 
} from './constants';

@Injectable()
export class MainPackingService {
  constructor(
    @InjectModel(Package.name) private packageModel: Model<Package>,
    @InjectModel(Job.name) private jobModel: Model<Job>,
    @InjectModel(BasketSize.name) private basketSizeModel: Model<BasketSize>,
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    @InjectModel(Basket.name) private basketModel: Model<Basket>,
    private singleCalService: SingleCalService,
    private manyCalService: ManyCalService,
  ) {}

  async processPackingWorkflow() {
    const unpackPackages = await this.getUnpackPackages();
    if (!unpackPackages.length) return this.createResult(false, 'No unpack packages found');

    try {
      const jobId = await this.createJob(unpackPackages);
      const cartType = this.getCartType(unpackPackages[0]);
      const basketSizes = await this.getSortedBasketSizes();
      const result = await this.packWithAlgorithm(unpackPackages, basketSizes, cartType, jobId);
      await this.finalizeJob(jobId, result);
      return result;
    } catch (e) {
      console.error('Packing error:', e);
      return this.createResult(false, e.message);
    }
  }

  private async getUnpackPackages() {
    return await this.packageModel
      .find({ package_status: PackageStatus.UNPACK })
      .sort({ createdAt: 1 })
      .select('_id product_list package_type package_status createdAt updatedAt')
      .populate('product_list._id', 'product_name product_weight dimensions')
      .lean();
  }

  private async createJob(packages) {
    const job = new this.jobModel({
      package_info: {
        product_list: packages[0].product_list.map(p => ({
          _id: p._id,
          product_name: p.product_name || 'Unknown',
        })),
        package_type: packages[0].package_type,
        package_status: PackageStatus.IN_PROCESS
      },
      job_type: packages.some(p => p.package_type === PackageType.ONE_TO_MANY) ? JobType.MANY_CAL : JobType.SINGLE_CAL,
      job_status: JobStatus.IN_PROGRESS,
      job_priority: JobPriority.MEDIUM,
      job_description: `Processing ${packages.length} packages`,
      scheduled_start_date: new Date(),
      total_calendar_entries: packages.length,
      total_duration_minutes: packages.length * PACKING_CONFIG.ESTIMATED_MINUTES_PER_PACKAGE
    });

    const saved = await job.save();
    await this.packageModel.updateMany(
      { _id: { $in: packages.map(p => p._id) } },
      { package_status: PackageStatus.IN_PROCESS }
    );
    return saved._id.toString();
  }

  private async finalizeJob(jobId: string, result: any) {
    const status = result.success ? JobStatus.COMPLETED : JobStatus.CANCELLED;
    await this.jobModel.updateOne(
      { _id: new Types.ObjectId(jobId) },
      { job_status: status, actual_end_date: new Date(), updatedAt: new Date() }
    );
  }

  private async getSortedBasketSizes() {
    const sizes = await this.basketSizeModel.find({ package_use: true }).lean();
    return sizes.sort((a, b) => a.package_width * a.package_length * a.package_height - b.package_width * b.package_length * b.package_height);
  }

  private getCartType(pkg): '1:1' | '1:m' {
    return pkg.package_type === PackageType.ONE_TO_MANY ? '1:m' : '1:1';
  }

  private async packWithAlgorithm(packages, basketSizes, cartType, jobId) {
    const packFn = cartType === '1:m' ? this.manyCalService.packManyCal : this.singleCalService.packSingleCal;
    const firstPackage = packages[0];
    const selectedBasket = basketSizes.find(b => {
      // simple size filter — replace with rotation logic if needed
      return b.package_width >= 10 && b.package_height >= 10 && b.package_length >= 10;
    });

    if (!selectedBasket) return this.createResult(false, 'No basket fits the first package');

    const basketInput = [{
      basket_size_id: selectedBasket._id,
      dimensions: {
        width: selectedBasket.package_width,
        height: selectedBasket.package_height,
        depth: selectedBasket.package_length
      },
      max_weight: selectedBasket.package_weight
    }];

    const calInput = cartType === '1:m' ? {
      _id: firstPackage._id,
      product_id: firstPackage.product_list[0]?._id || 'unknown',
      weight: firstPackage.product_list[0]?.product_weight || 100,
      dimensions: firstPackage.product_list[0]?.dimensions || DEFAULT_DIMENSIONS.PACKAGE,
      quantity: packages.length,
      package_type: firstPackage.package_type,
      package_status: firstPackage.package_status,
      cost: 0
    } : packages.map(p => ({
      _id: p._id,
      package_id: p._id,
      product_id: p.product_list[0]?._id,
      weight: p.product_list[0]?.product_weight || 100,
      dimensions: p.product_list[0]?.dimensions || DEFAULT_DIMENSIONS.PACKAGE,
      quantity: 1,
      package_type: p.package_type,
      package_status: p.package_status,
      cost: 0
    }));

    const result = await packFn.call(cartType === '1:m' ? this.manyCalService : this.singleCalService, calInput, basketInput);

    return {
      success: result.success,
      cart_object_id: `cart_${Date.now()}`,
      cart_type: cartType,
      basket_size_used: selectedBasket.package_name,
      total_baskets: result.basket_details?.length || 0,
      packages_processed: packages.length,
      packages_packed: result.packed_quantity || result.packed_packages || 0,
      packages_unpacked: packages.length - (result.packed_quantity || result.packed_packages || 0),
      job_id: jobId,
      cart_details: { baskets: result.basket_details || [] },
      message: result.success ? 'Packing successful' : 'Packing failed'
    };
  }

  private createResult(success: boolean, message: string) {
    return {
      success,
      cart_object_id: '',
      cart_type: '1:1',
      basket_size_used: '',
      total_baskets: 0,
      packages_processed: 0,
      packages_packed: 0,
      packages_unpacked: 0,
      job_id: '',
      cart_details: { baskets: [] },
      message
    };
  }
}
