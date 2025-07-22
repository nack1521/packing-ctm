import { PartialType } from '@nestjs/mapped-types';
import { CreateSingleCalDto } from './create-single_cal.dto';

export class UpdateSingleCalDto extends PartialType(CreateSingleCalDto) {}
