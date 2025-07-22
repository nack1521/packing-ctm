import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, ProductDocument } from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    try {
      const createdProduct = new this.productModel(createProductDto);
      return await createdProduct.save();
    } catch (error) {
      if (error.code === 11000) {
        throw new BadRequestException('Product with this identifier already exists');
      }
      throw new BadRequestException('Failed to create product: ' + error.message);
    }
  }

  async findAll(): Promise<Product[]> {
    try {
      return await this.productModel.find().exec();
    } catch (error) {
      throw new BadRequestException('Failed to fetch products: ' + error.message);
    }
  }

  async findOne(id: string): Promise<Product> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid product ID format');
    }

    try {
      const product = await this.productModel.findById(id).exec();
      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      return product;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch product: ' + error.message);
    }
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid product ID format');
    }

    try {
      const updatedProduct = await this.productModel
        .findByIdAndUpdate(id, updateProductDto, { 
          new: true, 
          runValidators: true 
        })
        .exec();
      
      if (!updatedProduct) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      
      return updatedProduct;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error.code === 11000) {
        throw new BadRequestException('Product with this identifier already exists');
      }
      throw new BadRequestException('Failed to update product: ' + error.message);
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid product ID format');
    }

    try {
      const deletedProduct = await this.productModel.findByIdAndDelete(id).exec();
      if (!deletedProduct) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      
      return { message: `Product with ID ${id} has been successfully deleted` };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete product: ' + error.message);
    }
  }
}
