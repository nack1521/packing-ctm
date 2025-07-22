import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { CreateBasketDto } from './dto/create-basket.dto';
import { UpdateBasketDto } from './dto/update-basket.dto';
import { Basket, BasketDocument, BasketType } from './schemas/basket.schema';

@Injectable()
export class BasketsService {
  constructor(
    @InjectModel(Basket.name) private basketModel: Model<BasketDocument>,
  ) {}

  async create(createBasketDto: CreateBasketDto): Promise<Basket> {
    // Safety check for undefined/null input
    if (!createBasketDto) {
      throw new BadRequestException('Basket data is required');
    }
    
    const { 
      basket_size_id, 
      package_ids = [], 
      single_package_id,
      basket_type,
      ...basketData 
    } = createBasketDto;

    // Validate basket size ID
    if (!isValidObjectId(basket_size_id)) {
      throw new BadRequestException('Invalid basket size ID format');
    }

    // Auto-determine basket type if not provided
    let autoBasketType = basket_type;
    if (!autoBasketType) {
      if (single_package_id) {
        autoBasketType = BasketType.ONE_TO_MANY;
      } else if (package_ids.length > 0) {
        autoBasketType = BasketType.ONE_TO_ONE;
      } else {
        autoBasketType = BasketType.ONE_TO_ONE; // default
      }
    }

    // Validate the package configuration based on basket type
    if (autoBasketType === BasketType.ONE_TO_ONE) {
      if (single_package_id) {
        throw new BadRequestException('ONE_TO_ONE baskets cannot have single_package_id, use package_ids instead');
      }
      if (package_ids.some(id => !isValidObjectId(id))) {
        throw new BadRequestException('Invalid package ID format in package_ids');
      }
    } else if (autoBasketType === BasketType.ONE_TO_MANY) {
      if (package_ids.length > 0) {
        throw new BadRequestException('ONE_TO_MANY baskets cannot have package_ids, use single_package_id instead');
      }
      if (!single_package_id) {
        throw new BadRequestException('ONE_TO_MANY baskets must have single_package_id');
      }
      if (!isValidObjectId(single_package_id)) {
        throw new BadRequestException('Invalid single_package_id format');
      }
    }

    // TODO: Validate basket_size_id exists in BasketSize collection
    // TODO: Validate package IDs exist in Package collection
    // TODO: Create embedded structures for basket_size and packages

    const basketSizeData = {
      _id: basket_size_id,
      package_id: 'temp_id', // TODO: Get from BasketSize collection
      package_name: 'temp_name', // TODO: Get from BasketSize collection
      package_width: 0, // TODO: Get from BasketSize collection
      package_length: 0,
      package_height: 0,
      package_weight: 0,
      package_cost: 0
    };

    const newBasket = new this.basketModel({
      ...basketData,
      basket_size: basketSizeData,
      basket_type: autoBasketType,
      package_list: autoBasketType === BasketType.ONE_TO_ONE ? [] : [], // TODO: populate with package data
      single_package: autoBasketType === BasketType.ONE_TO_MANY ? null : null, // TODO: populate with package data
    });

    const createdBasket = await newBasket.save();
    return createdBasket;
  }

  async findAll(): Promise<Basket[]> {
    try {
      return await this.basketModel
        .find()
        .exec();
    } catch (error) {
      throw new BadRequestException('Failed to fetch baskets: ' + error.message);
    }
  }

  async findOne(id: string): Promise<Basket> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid basket ID format');
    }

    try {
      const basket = await this.basketModel
        .findById(id)
        .exec();
      
      if (!basket) {
        throw new NotFoundException(`Basket with ID ${id} not found`);
      }
      
      return basket;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch basket: ' + error.message);
    }
  }

  async update(id: string, updateBasketDto: UpdateBasketDto): Promise<Basket> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid basket ID format');
    }

    try {
      // Get current basket to check type validation
      const currentBasket = await this.basketModel.findById(id);
      if (!currentBasket) {
        throw new NotFoundException(`Basket with ID ${id} not found`);
      }

      // Validate updates based on basket type
      const basketType = updateBasketDto.basket_type || currentBasket.basket_type;
      
      if (basketType === BasketType.ONE_TO_ONE) {
        if (updateBasketDto.single_package_id) {
          throw new BadRequestException('Cannot set single_package_id for ONE_TO_ONE basket');
        }
      } else if (basketType === BasketType.ONE_TO_MANY) {
        if (updateBasketDto.package_ids && updateBasketDto.package_ids.length > 0) {
          throw new BadRequestException('Cannot set package_ids for ONE_TO_MANY basket');
        }
      }

      // TODO: Handle package updates and embed package data
      const updateData: any = { ...updateBasketDto };
      
      // Remove DTO-specific fields that don't exist in schema
      delete updateData.package_ids;
      delete updateData.single_package_id;
      delete updateData.basket_size_id;

      const updatedBasket = await this.basketModel
        .findByIdAndUpdate(id, updateData, { 
          new: true, 
          runValidators: true 
        })
        .exec();
      
      if (!updatedBasket) {
        throw new NotFoundException(`Basket with ID ${id} not found`);
      }
      
      return updatedBasket;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update basket: ' + error.message);
    }
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid basket ID format');
    }

    try {
      const deletedBasket = await this.basketModel
        .findByIdAndDelete(id)
        .exec();
      
      if (!deletedBasket) {
        throw new NotFoundException(`Basket with ID ${id} not found`);
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete basket: ' + error.message);
    }
  }
}
