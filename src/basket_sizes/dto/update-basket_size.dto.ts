import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class UpdateBasketSizeDto {
  @IsString()
  @IsOptional()
  package_id?: string;

  @IsString()
  @IsOptional()
  package_name?: string;

  @IsString()
  @IsOptional()
  package_detail?: string;

  @IsString()
  @IsOptional()
  package_short_name?: string;

  @IsString()
  @IsOptional()
  package_type?: string;

  @IsNumber()
  @IsOptional()
  package_width?: number;

  @IsNumber()
  @IsOptional()
  package_length?: number;

  @IsNumber()
  @IsOptional()
  package_height?: number;

  @IsNumber()
  @IsOptional()
  package_weight?: number;

  @IsNumber()
  @IsOptional()
  package_cost?: number;

  @IsBoolean()
  @IsOptional()
  package_use?: boolean;
}
