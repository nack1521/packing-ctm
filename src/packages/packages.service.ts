import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { Package, PackageDocument, PackageType } from './schemas/package.schema';
import { ProductsService } from '../products/products.service';

@Injectable()
export class PackagesService {
  constructor(
    @InjectModel(Package.name) private packageModel: Model<PackageDocument>,
    private productsService: ProductsService,
  ) {}

  async create(createPackageDto: CreatePackageDto): Promise<Package> {
    // Safety check for undefined/null input
    if (!createPackageDto) {
      createPackageDto = {} as CreatePackageDto;
    }
    
    const { product_list = [], ...packageData } = createPackageDto;

    const validateProducts = await Promise.all(
      product_list.map(async (productId) => {
        if (!isValidObjectId(productId)) {
          throw new BadRequestException(`Product with ID ${productId} does not exist`);
        }
        return this.productsService.findOne(productId);
      })
    );

    // Auto-set package_type based on product_list length
    const productCount = product_list.length;
    const autoPackageType = productCount <= 1 ? PackageType.ONE_TO_ONE : PackageType.ONE_TO_MANY;

    // Create embedded product list with _id and product_name
    const embeddedProductList = validateProducts.map(product => ({
      _id: (product as any)._id,
      product_name: product.product_name
    }));

    const newPackage = new this.packageModel({
      ...packageData,
      product_list: embeddedProductList,
      package_type: autoPackageType,
    });

    const createdPackage = await newPackage.save();
    return createdPackage;
  }

  async findAll(): Promise<Package[]> {
    try {
      return await this.packageModel
        .find()
        .exec();
    } catch (error) {
      throw new BadRequestException('Failed to fetch packages: ' + error.message);
    }
  }

  async findOne(id: string): Promise<Package> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid package ID format');
    }

    try {
      const packageDoc = await this.packageModel
        .findById(id)
        .exec();
      
      if (!packageDoc) {
        throw new NotFoundException(`Package with ID ${id} not found`);
      }
      
      return packageDoc;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch package: ' + error.message);
    }
  }

  async update(id: string, updatePackageDto: UpdatePackageDto): Promise<Package> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid package ID format');
    }

    try {
      // Auto-set package_type based on product_list length if product_list is being updated
      let updateData: any = { ...updatePackageDto };
      if (updatePackageDto.product_list !== undefined) {
        const productList = updatePackageDto.product_list || [];
        const productCount = productList.length;

        // Validate products and create embedded structure
        if (productList.length > 0) {
          const validateProducts = await Promise.all(
            productList.map(async (productId) => {
              if (!isValidObjectId(productId)) {
                throw new BadRequestException(`Product with ID ${productId} does not exist`);
              }
              return this.productsService.findOne(productId);
            })
          );

          // Create embedded product list with _id and product_name
          const embeddedProductList = validateProducts.map(product => ({
            _id: (product as any)._id,
            product_name: product.product_name
          }));

          updateData.product_list = embeddedProductList;
        } else {
          updateData.product_list = [];
        }
        
        updateData.package_type = productCount <= 1 ? PackageType.ONE_TO_ONE : PackageType.ONE_TO_MANY;
      }

      const updatedPackage = await this.packageModel
        .findByIdAndUpdate(id, updateData, { 
          new: true, 
          runValidators: true 
        })
        .exec();
      
      if (!updatedPackage) {
        throw new NotFoundException(`Package with ID ${id} not found`);
      }
      
      return updatedPackage;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error.code === 11000) {
        throw new BadRequestException('Package with this identifier already exists');
      }
      throw new BadRequestException('Failed to update package: ' + error.message);
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid package ID format');
    }

    try {
      const deletedPackage = await this.packageModel.findByIdAndDelete(id).exec();
      if (!deletedPackage) {
        throw new NotFoundException(`Package with ID ${id} not found`);
      }
      
      return { message: `Package with ID ${id} has been successfully deleted` };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete package: ' + error.message);
    }
  }

  // Additional helper methods
  async findByStatus(status: number): Promise<Package[]> {
    try {
      return await this.packageModel
        .find({ package_status: status })
        .populate('product_list')
        .exec();
    } catch (error) {
      throw new BadRequestException('Failed to fetch packages by status: ' + error.message);
    }
  }

  async findByType(type: string): Promise<Package[]> {
    try {
      return await this.packageModel
        .find({ package_type: type })
        .populate('product_list')
        .exec();
    } catch (error) {
      throw new BadRequestException('Failed to fetch packages by type: ' + error.message);
    }
  }

  async addProductToPackage(packageId: string, productId: string): Promise<Package> {
    if (!isValidObjectId(packageId) || !isValidObjectId(productId)) {
      throw new BadRequestException('Invalid ID format');
    }

    try {
      // Validate that the product exists
      await this.productsService.findOne(productId);

      // First add the product
      const updatedPackage = await this.packageModel
        .findByIdAndUpdate(
          packageId,
          { $addToSet: { product_list: productId } },
          { new: true, runValidators: true }
        )
        .populate('product_list')
        .exec();

      if (!updatedPackage) {
        throw new NotFoundException(`Package with ID ${packageId} not found`);
      }

      // Auto-update package_type based on new product count
      const productCount = updatedPackage.product_list.length;
      const finalPackage = await this.packageModel
        .findByIdAndUpdate(
          packageId,
          { package_type: productCount <= 1 ? PackageType.ONE_TO_ONE : PackageType.ONE_TO_MANY },
          { new: true, runValidators: true }
        )
        .populate('product_list')
        .exec();

      return finalPackage || updatedPackage;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to add product to package: ' + error.message);
    }
  }

  async removeProductFromPackage(packageId: string, productId: string): Promise<Package> {
    if (!isValidObjectId(packageId) || !isValidObjectId(productId)) {
      throw new BadRequestException('Invalid ID format');
    }

    try {
      // First remove the product
      const updatedPackage = await this.packageModel
        .findByIdAndUpdate(
          packageId,
          { $pull: { product_list: productId } },
          { new: true, runValidators: true }
        )
        .populate('product_list')
        .exec();

      if (!updatedPackage) {
        throw new NotFoundException(`Package with ID ${packageId} not found`);
      }

      // Auto-update package_type based on new product count
      const productCount = updatedPackage.product_list.length;
      const finalPackage = await this.packageModel
        .findByIdAndUpdate(
          packageId,
          { package_type: productCount <= 1 ? PackageType.ONE_TO_ONE : PackageType.ONE_TO_MANY },
          { new: true, runValidators: true }
        )
        .populate('product_list')
        .exec();

      return finalPackage || updatedPackage;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to remove product from package: ' + error.message);
    }
  }
}
