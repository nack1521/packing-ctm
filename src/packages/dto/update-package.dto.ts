import { IsArray, IsEnum, IsOptional, IsMongoId } from 'class-validator';
import { PackageType, PackageStatus } from '../schemas/package.schema';

export class UpdatePackageDto {
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  product_list?: string[];

  @IsEnum(PackageType)
  @IsOptional()
  package_type?: PackageType;

  @IsOptional()
  package_status?: PackageStatus;
}
