import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type JobDocument = Job & Document;

export enum JobType {
  SINGLE_CAL = 'SINGLE_CAL',
  MANY_CAL = 'MANY_CAL'
}

export enum JobStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum JobPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

@Schema({ 
  timestamps: true,
  toJSON: { getters: true }
})
export class Job {
  // Package information that this job is processing
  @Prop({ 
    type: {
      _id: { type: Types.ObjectId, ref: 'Package' },
      product_list: [{ 
        _id: { type: Types.ObjectId, ref: 'Product' },
        product_name: { type: String }
      }],
      package_type: { type: String },
      package_status: { type: String }
    },
    required: true
  })
  package_info: {
    _id: Types.ObjectId;
    product_list: { _id: Types.ObjectId, product_name: string }[];
    package_type: string;
    package_status: string;
  };

  // For SINGLE_CAL: one calendar entry
  @Prop({ 
    type: {
      _id: { type: Types.ObjectId, ref: 'CalSize' },
      cal_date: { type: Date },
      cal_time_slot: { type: String },
      cal_duration: { type: Number }, // in minutes
      cal_status: { type: String }
    },
    required: false,
    default: null
  })
  single_cal: {
    _id: Types.ObjectId;
    cal_date: Date;
    cal_time_slot: string;
    cal_duration: number;
    cal_status: string;
  } | null;

  // For MANY_CAL: multiple calendar entries
  @Prop({ 
    type: [{
      _id: { type: Types.ObjectId, ref: 'CalSize' },
      cal_date: { type: Date },
      cal_time_slot: { type: String },
      cal_duration: { type: Number },
      cal_status: { type: String },
      cal_sequence: { type: Number } // Order of execution
    }],
    default: []
  })
  many_cal: {
    _id: Types.ObjectId;
    cal_date: Date;
    cal_time_slot: string;
    cal_duration: number;
    cal_status: string;
    cal_sequence: number;
  }[];

  // Determines which calendar type: single_cal or many_cal
  @Prop({ 
    type: String,
    enum: [JobType.SINGLE_CAL, JobType.MANY_CAL],
    required: true,
    default: JobType.SINGLE_CAL
  })
  job_type: JobType;

  @Prop({ 
    type: String,
    enum: [JobStatus.PENDING, JobStatus.SCHEDULED, JobStatus.IN_PROGRESS, JobStatus.COMPLETED, JobStatus.CANCELLED],
    required: true,
    default: JobStatus.PENDING
  })
  job_status: JobStatus;

  @Prop({ 
    type: String,
    enum: [JobPriority.LOW, JobPriority.MEDIUM, JobPriority.HIGH, JobPriority.URGENT],
    required: true,
    default: JobPriority.MEDIUM
  })
  job_priority: JobPriority;

  // Job metadata
  @Prop({ 
    type: String,
    required: false
  })
  job_description?: string;

  @Prop({ 
    type: Date,
    required: false
  })
  scheduled_start_date?: Date;

  @Prop({ 
    type: Date,
    required: false
  })
  scheduled_end_date?: Date;

  @Prop({ 
    type: Date,
    required: false
  })
  actual_start_date?: Date;

  @Prop({ 
    type: Date,
    required: false
  })
  actual_end_date?: Date;

  // Summary fields
  @Prop({ 
    type: Number,
    default: 0
  })
  total_calendar_entries: number;

  @Prop({ 
    type: Number,
    default: 0
  })
  total_duration_minutes: number;

  @Prop({ 
    type: Number,
    default: 0
  })
  completed_calendar_entries: number;
}

export const JobSchema = SchemaFactory.createForClass(Job);
