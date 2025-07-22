import { Injectable } from '@nestjs/common';
import { CreateBasketSizeDto } from './dto/create-basket_size.dto';
import { UpdateBasketSizeDto } from './dto/update-basket_size.dto';
import { InjectModel } from '@nestjs/mongoose';
import { BasketSize, BasketSizeDocument } from './schemas/basket_size.schema';
import { Model } from 'mongoose';

@Injectable()
export class BasketSizesService {
  constructor(
    @InjectModel(BasketSize.name) private basketSizeModel: Model<BasketSizeDocument>
  ) {}

  async create(createBasketSizeDto: CreateBasketSizeDto): Promise<BasketSize> {
    const createdBasketSize = new this.basketSizeModel(createBasketSizeDto);
    return createdBasketSize.save();
  }

  async findAll(): Promise<BasketSize[]> {
    return this.basketSizeModel.find().exec();
  }

  async findOne(id: string): Promise<BasketSize | null> {
    return this.basketSizeModel.findById(id).exec();
  }

  async update(id: string, updateBasketSizeDto: UpdateBasketSizeDto): Promise<BasketSize | null> {
    return this.basketSizeModel.findByIdAndUpdate(id, updateBasketSizeDto, { new: true }).exec();
  }

  async remove(id: string): Promise<BasketSize | null> {
    return this.basketSizeModel.findByIdAndDelete(id).exec();
  }
}
