import { IsArray, IsEnum, IsOptional, IsMongoId } from 'class-validator';
import { BasketType, BasketStatus } from '../schemas/basket.schema';

export class CreateBasketDto {
  @IsMongoId()
  basket_size_id: string;

  // For ONE_TO_ONE baskets: array of package IDs
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  package_ids?: string[];

  // For ONE_TO_MANY baskets: single package ID
  @IsMongoId()
  @IsOptional()
  single_package_id?: string;

  @IsEnum(BasketType)
  @IsOptional()
  basket_type?: BasketType;

  @IsEnum(BasketStatus)
  @IsOptional()
  basket_status?: BasketStatus;
}
