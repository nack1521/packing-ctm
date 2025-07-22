import { IsString, IsNumber, IsOptional, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

class DimensionsDto {
  @IsNumber()
  @IsOptional()
  width?: number;

  @IsNumber()
  @IsOptional()
  length?: number;

  @IsNumber()
  @IsOptional()
  height?: number;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  product_name?: string;

  @IsNumber()
  @IsOptional()
  product_weight?: number;

  @IsObject()
  @ValidateNested()
  @Type(() => DimensionsDto)
  @IsOptional()
  dimensions?: DimensionsDto;
}
