import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { Cart, CartDocument } from './schemas/cart.schema';

@Injectable()
export class CartsService {
  constructor(
    @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
  ) {}

  async create(createCartDto: CreateCartDto): Promise<Cart> {
    // Safety check for undefined/null input
    if (!createCartDto) {
      createCartDto = {} as CreateCartDto;
    }
    
    const { basket_ids = [], ...cartData } = createCartDto;

    // Validate basket IDs format
    if (basket_ids.some(id => !isValidObjectId(id))) {
      throw new BadRequestException('Invalid basket ID format in basket_ids');
    }

    // TODO: Validate basket IDs exist in Basket collection
    // TODO: Get basket details and embed them in basket_list
    // TODO: Calculate summary totals

    // For now, create empty cart or with placeholder data
    const basketListData = basket_ids.map(basketId => ({
      _id: basketId,
      basket_size: {
        package_id: 'temp_id', // TODO: Get from Basket collection
        package_name: 'temp_name',
        package_width: 0,
        package_length: 0,
        package_height: 0,
        package_weight: 0,
        package_cost: 0
      },
      basket_type: 'ONE_TO_ONE', // TODO: Get from Basket collection
      basket_status: 'PENDING',
      package_count: 0, // TODO: Calculate from basket data
      total_products: 0 // TODO: Calculate from basket data
    }));

    const newCart = new this.cartModel({
      ...cartData,
      basket_list: basketListData,
      total_baskets: basket_ids.length,
      total_packages: 0, // TODO: Calculate from basket data
      total_products: 0, // TODO: Calculate from basket data
      total_cost: 0 // TODO: Calculate from basket data
    });

    const createdCart = await newCart.save();
    return createdCart;
  }

  async findAll(): Promise<Cart[]> {
    try {
      return await this.cartModel
        .find()
        .exec();
    } catch (error) {
      throw new BadRequestException('Failed to fetch carts: ' + error.message);
    }
  }

  async findOne(id: string): Promise<Cart> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid cart ID format');
    }

    try {
      const cart = await this.cartModel
        .findById(id)
        .exec();
      
      if (!cart) {
        throw new NotFoundException(`Cart with ID ${id} not found`);
      }
      
      return cart;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch cart: ' + error.message);
    }
  }

  async update(id: string, updateCartDto: UpdateCartDto): Promise<Cart> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid cart ID format');
    }

    try {
      // Handle basket_ids updates
      let updateData: any = { ...updateCartDto };
      
      if (updateCartDto.basket_ids !== undefined) {
        // Validate basket IDs
        if (updateCartDto.basket_ids.some(id => !isValidObjectId(id))) {
          throw new BadRequestException('Invalid basket ID format in basket_ids');
        }

        // TODO: Validate basket IDs exist in Basket collection
        // TODO: Get basket details and update basket_list
        // TODO: Recalculate summary totals

        const basketListData = updateCartDto.basket_ids.map(basketId => ({
          _id: basketId,
          basket_size: {
            package_id: 'temp_id',
            package_name: 'temp_name',
            package_width: 0,
            package_length: 0,
            package_height: 0,
            package_weight: 0,
            package_cost: 0
          },
          basket_type: 'ONE_TO_ONE',
          basket_status: 'PENDING',
          package_count: 0,
          total_products: 0
        }));

        updateData.basket_list = basketListData;
        updateData.total_baskets = updateCartDto.basket_ids.length;
      }

      // Remove DTO-specific fields that don't exist in schema
      delete updateData.basket_ids;

      const updatedCart = await this.cartModel
        .findByIdAndUpdate(id, updateData, { 
          new: true, 
          runValidators: true 
        })
        .exec();
      
      if (!updatedCart) {
        throw new NotFoundException(`Cart with ID ${id} not found`);
      }
      
      return updatedCart;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update cart: ' + error.message);
    }
  }

  async addBasket(cartId: string, basketId: string): Promise<Cart> {
    if (!isValidObjectId(cartId) || !isValidObjectId(basketId)) {
      throw new BadRequestException('Invalid cart or basket ID format');
    }

    try {
      const cart = await this.cartModel.findById(cartId);
      if (!cart) {
        throw new NotFoundException(`Cart with ID ${cartId} not found`);
      }

      // Check if basket already exists in cart
      const basketExists = cart.basket_list.some(basket => basket._id.toString() === basketId);
      if (basketExists) {
        throw new BadRequestException('Basket already exists in cart');
      }

      // TODO: Validate basket exists in Basket collection
      // TODO: Get basket details and add to basket_list
      // TODO: Recalculate summary totals

      const newBasketData = {
        _id: basketId,
        basket_size: {
          package_id: 'temp_id',
          package_name: 'temp_name',
          package_width: 0,
          package_length: 0,
          package_height: 0,
          package_weight: 0,
          package_cost: 0
        },
        basket_type: 'ONE_TO_ONE',
        basket_status: 'PENDING',
        package_count: 0,
        total_products: 0
      };

      cart.basket_list.push(newBasketData as any);
      cart.total_baskets = cart.basket_list.length;

      await cart.save();
      return cart;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to add basket to cart: ' + error.message);
    }
  }

  async removeBasket(cartId: string, basketId: string): Promise<Cart> {
    if (!isValidObjectId(cartId) || !isValidObjectId(basketId)) {
      throw new BadRequestException('Invalid cart or basket ID format');
    }

    try {
      const cart = await this.cartModel.findById(cartId);
      if (!cart) {
        throw new NotFoundException(`Cart with ID ${cartId} not found`);
      }

      const basketIndex = cart.basket_list.findIndex(basket => basket._id.toString() === basketId);
      if (basketIndex === -1) {
        throw new NotFoundException('Basket not found in cart');
      }

      cart.basket_list.splice(basketIndex, 1);
      cart.total_baskets = cart.basket_list.length;

      // TODO: Recalculate summary totals

      await cart.save();
      return cart;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to remove basket from cart: ' + error.message);
    }
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid cart ID format');
    }

    try {
      const deletedCart = await this.cartModel
        .findByIdAndDelete(id)
        .exec();
      
      if (!deletedCart) {
        throw new NotFoundException(`Cart with ID ${id} not found`);
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete cart: ' + error.message);
    }
  }
}
