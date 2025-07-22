import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PackageDocument = Package & Document;

export enum PackageType {
  ONE_TO_ONE = 'ONE_TO_ONE',
  ONE_TO_MANY = 'ONE_TO_MANY'
}

export enum PackageStatus {
  UNPACK = 'UNPACK',
  IN_PROCESS = 'IN_PROCESS', 
  PACKED = 'PACKED',
  COMPLETED = 'COMPLETED'
}

@Schema({ 
  timestamps: true,
  toJSON: { getters: true } // Enable getters in JSON output
})
export class Package {
  @Prop({ 
    type: [{ 
        _id: { type: Types.ObjectId, ref: 'Product' }, 
        product_name: { type: String }
    }],
    default: []
  })
  product_list: { _id: Types.ObjectId, product_name: string }[];

  @Prop({ 
    type: String,
    enum: [PackageType.ONE_TO_ONE, PackageType.ONE_TO_MANY],
    required: true,
    default: PackageType.ONE_TO_ONE
  })
  package_type: PackageType;

  @Prop({ 
    type: String,
    enum: [PackageStatus.UNPACK, PackageStatus.IN_PROCESS, PackageStatus.PACKED, PackageStatus.COMPLETED],
    required: true,
    default: PackageStatus.UNPACK
  })
  package_status: PackageStatus;
}

export const PackageSchema = SchemaFactory.createForClass(Package);
