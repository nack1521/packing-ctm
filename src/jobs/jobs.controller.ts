import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobStatus } from './schemas/job.schema';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  create(@Body() createJobDto: CreateJobDto) {
    return this.jobsService.create(createJobDto);
  }

  @Get()
  findAll(@Query('status') status?: JobStatus) {
    if (status) {
      return this.jobsService.findJobsByStatus(status);
    }
    return this.jobsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateJobDto: UpdateJobDto) {
    return this.jobsService.update(id, updateJobDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.jobsService.remove(id);
  }

  // Additional job management endpoints
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: JobStatus) {
    return this.jobsService.updateJobStatus(id, status);
  }

  @Get('package/:packageId')
  findJobsByPackage(@Param('packageId') packageId: string) {
    return this.jobsService.findJobsByPackage(packageId);
  }
}
