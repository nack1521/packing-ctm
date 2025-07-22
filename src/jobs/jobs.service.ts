import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Job, JobDocument, JobType, JobStatus } from './schemas/job.schema';

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
  ) {}

  async create(createJobDto: CreateJobDto): Promise<Job> {
    // Safety check for undefined/null input
    if (!createJobDto) {
      throw new BadRequestException('Job data is required');
    }
    
    const { 
      package_id,
      single_cal_id,
      single_cal_date,
      single_cal_time_slot,
      single_cal_duration,
      many_cal_entries = [],
      job_type,
      ...jobData 
    } = createJobDto;

    // Validate package ID
    if (!isValidObjectId(package_id)) {
      throw new BadRequestException('Invalid package ID format');
    }

    // Auto-determine job type if not provided
    let autoJobType = job_type;
    if (!autoJobType) {
      if (single_cal_id || single_cal_date) {
        autoJobType = JobType.SINGLE_CAL;
      } else if (many_cal_entries.length > 0) {
        autoJobType = JobType.MANY_CAL;
      } else {
        autoJobType = JobType.SINGLE_CAL; // default
      }
    }

    // Validate the calendar configuration based on job type
    if (autoJobType === JobType.SINGLE_CAL) {
      if (many_cal_entries.length > 0) {
        throw new BadRequestException('SINGLE_CAL jobs cannot have many_cal_entries');
      }
      if (single_cal_id && !isValidObjectId(single_cal_id)) {
        throw new BadRequestException('Invalid single_cal_id format');
      }
    } else if (autoJobType === JobType.MANY_CAL) {
      if (single_cal_id || single_cal_date) {
        throw new BadRequestException('MANY_CAL jobs cannot have single calendar data');
      }
      if (many_cal_entries.length === 0) {
        throw new BadRequestException('MANY_CAL jobs must have at least one calendar entry');
      }
      // Validate each calendar entry
      for (const entry of many_cal_entries) {
        if (!isValidObjectId(entry.cal_id)) {
          throw new BadRequestException('Invalid cal_id format in many_cal_entries');
        }
      }
    }

    // TODO: Validate package_id exists in Package collection
    // TODO: Validate cal_ids exist in CalSize collection
    // TODO: Get package details and embed them

    // Create package info placeholder
    const packageInfo = {
      _id: package_id,
      product_list: [], // TODO: Get from Package collection
      package_type: 'ONE_TO_ONE', // TODO: Get from Package collection
      package_status: 'PACKED' // TODO: Get from Package collection
    };

    // Create calendar data based on job type
    let singleCalData: any = null;
    let manyCalData: any[] = [];
    let totalEntries = 0;
    let totalDuration = 0;

    if (autoJobType === JobType.SINGLE_CAL) {
      if (single_cal_id) {
        singleCalData = {
          _id: single_cal_id,
          cal_date: single_cal_date ? new Date(single_cal_date) : new Date(),
          cal_time_slot: single_cal_time_slot || '09:00-10:00',
          cal_duration: single_cal_duration || 60,
          cal_status: 'SCHEDULED'
        };
        totalEntries = 1;
        totalDuration = single_cal_duration || 60;
      }
    } else {
      manyCalData = many_cal_entries.map(entry => ({
        _id: entry.cal_id,
        cal_date: new Date(entry.cal_date),
        cal_time_slot: entry.cal_time_slot,
        cal_duration: entry.cal_duration,
        cal_status: 'SCHEDULED',
        cal_sequence: entry.cal_sequence
      }));
      totalEntries = many_cal_entries.length;
      totalDuration = many_cal_entries.reduce((sum, entry) => sum + entry.cal_duration, 0);
    }

    const newJob = new this.jobModel({
      ...jobData,
      package_info: packageInfo,
      job_type: autoJobType,
      single_cal: singleCalData,
      many_cal: manyCalData,
      total_calendar_entries: totalEntries,
      total_duration_minutes: totalDuration,
      completed_calendar_entries: 0,
      scheduled_start_date: createJobDto.scheduled_start_date ? new Date(createJobDto.scheduled_start_date) : undefined,
      scheduled_end_date: createJobDto.scheduled_end_date ? new Date(createJobDto.scheduled_end_date) : undefined,
    });

    const createdJob = await newJob.save();
    return createdJob;
  }

  async findAll(): Promise<Job[]> {
    try {
      return await this.jobModel
        .find()
        .exec();
    } catch (error) {
      throw new BadRequestException('Failed to fetch jobs: ' + error.message);
    }
  }

  async findOne(id: string): Promise<Job> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid job ID format');
    }

    try {
      const job = await this.jobModel
        .findById(id)
        .exec();
      
      if (!job) {
        throw new NotFoundException(`Job with ID ${id} not found`);
      }
      
      return job;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch job: ' + error.message);
    }
  }

  async update(id: string, updateJobDto: UpdateJobDto): Promise<Job> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid job ID format');
    }

    try {
      const currentJob = await this.jobModel.findById(id);
      if (!currentJob) {
        throw new NotFoundException(`Job with ID ${id} not found`);
      }

      // Validate updates based on job type
      const jobType = updateJobDto.job_type || currentJob.job_type;
      
      if (jobType === JobType.SINGLE_CAL) {
        if (updateJobDto.many_cal_entries && updateJobDto.many_cal_entries.length > 0) {
          throw new BadRequestException('Cannot set many_cal_entries for SINGLE_CAL job');
        }
      } else if (jobType === JobType.MANY_CAL) {
        if (updateJobDto.single_cal_id || updateJobDto.single_cal_date) {
          throw new BadRequestException('Cannot set single calendar data for MANY_CAL job');
        }
      }

      // TODO: Handle calendar updates and recalculate totals
      const updateData: any = { ...updateJobDto };
      
      // Remove DTO-specific fields that don't exist in schema
      delete updateData.single_cal_id;
      delete updateData.single_cal_date;
      delete updateData.single_cal_time_slot;
      delete updateData.single_cal_duration;
      delete updateData.many_cal_entries;
      delete updateData.package_id;

      // Handle date conversions
      if (updateJobDto.scheduled_start_date) {
        updateData.scheduled_start_date = new Date(updateJobDto.scheduled_start_date);
      }
      if (updateJobDto.scheduled_end_date) {
        updateData.scheduled_end_date = new Date(updateJobDto.scheduled_end_date);
      }

      const updatedJob = await this.jobModel
        .findByIdAndUpdate(id, updateData, { 
          new: true, 
          runValidators: true 
        })
        .exec();
      
      if (!updatedJob) {
        throw new NotFoundException(`Job with ID ${id} not found`);
      }
      
      return updatedJob;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update job: ' + error.message);
    }
  }

  async updateJobStatus(id: string, status: JobStatus): Promise<Job> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid job ID format');
    }

    try {
      const updateData: any = { job_status: status };

      // Set actual dates based on status
      if (status === JobStatus.IN_PROGRESS && !updateData.actual_start_date) {
        updateData.actual_start_date = new Date();
      } else if (status === JobStatus.COMPLETED) {
        updateData.actual_end_date = new Date();
      }

      const updatedJob = await this.jobModel
        .findByIdAndUpdate(id, updateData, { 
          new: true, 
          runValidators: true 
        })
        .exec();
      
      if (!updatedJob) {
        throw new NotFoundException(`Job with ID ${id} not found`);
      }
      
      return updatedJob;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update job status: ' + error.message);
    }
  }

  async findJobsByPackage(packageId: string): Promise<Job[]> {
    if (!isValidObjectId(packageId)) {
      throw new BadRequestException('Invalid package ID format');
    }

    try {
      return await this.jobModel
        .find({ 'package_info._id': packageId })
        .exec();
    } catch (error) {
      throw new BadRequestException('Failed to fetch jobs by package: ' + error.message);
    }
  }

  async findJobsByStatus(status: JobStatus): Promise<Job[]> {
    try {
      return await this.jobModel
        .find({ job_status: status })
        .exec();
    } catch (error) {
      throw new BadRequestException('Failed to fetch jobs by status: ' + error.message);
    }
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid job ID format');
    }

    try {
      const deletedJob = await this.jobModel
        .findByIdAndDelete(id)
        .exec();
      
      if (!deletedJob) {
        throw new NotFoundException(`Job with ID ${id} not found`);
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete job: ' + error.message);
    }
  }
}
