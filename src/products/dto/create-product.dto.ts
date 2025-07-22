import { IsString, IsNumber, IsNotEmpty, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

class DimensionsDto {
  @IsNumber()
  @IsNotEmpty()
  width: number;

  @IsNumber()
  @IsNotEmpty()
  length: number;

  @IsNumber()
  @IsNotEmpty()
  height: number;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  product_name: string;

  @IsNumber()
  @IsNotEmpty()
  product_weight: number;

  @IsObject()
  @ValidateNested()
  @Type(() => DimensionsDto)
  @IsNotEmpty()
  dimensions: DimensionsDto;
}
