import { IsString, IsNumber, IsBoolean, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateBasketSizeDto {
  @IsString()
  @IsNotEmpty()
  package_id: string;

  @IsString()
  @IsNotEmpty()
  package_name: string;

  @IsString()
  @IsOptional()
  package_detail?: string;

  @IsString()
  @IsOptional()
  package_short_name?: string;

  @IsString()
  @IsNotEmpty()
  package_type: string;

  @IsNumber()
  @IsNotEmpty()
  package_width: number;

  @IsNumber()
  @IsNotEmpty()
  package_length: number;

  @IsNumber()
  @IsNotEmpty()
  package_height: number;

  @IsNumber()
  @IsNotEmpty()
  package_weight: number;

  @IsNumber()
  @IsNotEmpty()
  package_cost: number;

  @IsBoolean()
  @IsOptional()
  package_use?: boolean;
}
