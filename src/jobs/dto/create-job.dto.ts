import { IsArray, IsEnum, IsOptional, IsMongoId, IsString, IsDateString, IsNumber, IsPositive } from 'class-validator';
import { JobType, JobStatus, JobPriority } from '../schemas/job.schema';

export class CreateJobDto {
  @IsMongoId()
  package_id: string;

  // For SINGLE_CAL jobs
  @IsMongoId()
  @IsOptional()
  single_cal_id?: string;

  @IsDateString()
  @IsOptional()
  single_cal_date?: string;

  @IsString()
  @IsOptional()
  single_cal_time_slot?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  single_cal_duration?: number;

  // For MANY_CAL jobs
  @IsArray()
  @IsOptional()
  many_cal_entries?: {
    cal_id: string;
    cal_date: string;
    cal_time_slot: string;
    cal_duration: number;
    cal_sequence: number;
  }[];

  @IsEnum(JobType)
  @IsOptional()
  job_type?: JobType;

  @IsEnum(JobStatus)
  @IsOptional()
  job_status?: JobStatus;

  @IsEnum(JobPriority)
  @IsOptional()
  job_priority?: JobPriority;

  @IsString()
  @IsOptional()
  job_description?: string;

  @IsDateString()
  @IsOptional()
  scheduled_start_date?: string;

  @IsDateString()
  @IsOptional()
  scheduled_end_date?: string;
}
