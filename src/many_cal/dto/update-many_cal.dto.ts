import { PartialType } from '@nestjs/mapped-types';
import { CreateManyCalDto } from './create-many_cal.dto';

export class UpdateManyCalDto extends PartialType(CreateManyCalDto) {}
