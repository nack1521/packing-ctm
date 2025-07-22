import { IsArray, IsEnum, IsOptional, IsMongoId } from 'class-validator';
import { CartStatus } from '../schemas/cart.schema';

export class CreateCartDto {
  // Array of basket IDs to add to cart
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  basket_ids?: string[];

  @IsEnum(CartStatus)
  @IsOptional()
  cart_status?: CartStatus;
}
