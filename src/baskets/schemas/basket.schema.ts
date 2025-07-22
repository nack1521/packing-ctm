import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BasketDocument = Basket & Document;

export enum BasketType {
  ONE_TO_ONE = 'ONE_TO_ONE',
  ONE_TO_MANY = 'ONE_TO_MANY'
}

export enum BasketStatus {
  PENDING = 'PENDING',
  IN_PROCESS = 'IN_PROCESS',
  COMPLETED = 'COMPLETED'
}

@Schema({ 
  timestamps: true,
  toJSON: { getters: true }
})
export class Basket {
  // Embedded basket size information
  @Prop({ 
    type: { 
      _id: { type: Types.ObjectId, ref: 'BasketSize' }, 
      package_object_id: { type: String },
      package_name: { type: String },
      package_width: { type: Number },
      package_length: { type: Number },
      package_height: { type: Number },
      package_weight: { type: Number },
      package_cost: { type: Number }
    },
    required: true
  })
  basket_size: {
    _id: Types.ObjectId;
    package_id: string;
    package_name: string;
    package_width: number;
    package_length: number;
    package_height: number;
    package_weight: number;
    package_cost: number;
  };

  // For ONE_TO_ONE: array of 1:1 packages (used when basket_type is ONE_TO_ONE)
  @Prop({ 
    type: [{
      _id: { type: Types.ObjectId, ref: 'Package' },
      product_list: [{ 
        _id: { type: Types.ObjectId, ref: 'Product' },
        product_name: { type: String }
      }],
      package_type: { type: String },
      package_status: { type: String }
    }],
    default: []
  })
  package_list: {
    _id: Types.ObjectId;
    product_list: { _id: Types.ObjectId, product_name: string }[];
    package_type: string;
    package_status: string;
  }[];

  // For ONE_TO_MANY: single 1:many package (used when basket_type is ONE_TO_MANY)
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
    required: false,
    default: null
  })
  single_package: {
    _id: Types.ObjectId;
    product_list: { _id: Types.ObjectId, product_name: string }[];
    package_type: string;
    package_status: string;
  } | null;

  // Determines which field to use: package_list (ONE_TO_ONE) or single_package (ONE_TO_MANY)
  @Prop({ 
    type: String,
    enum: [BasketType.ONE_TO_ONE, BasketType.ONE_TO_MANY],
    required: true,
    default: BasketType.ONE_TO_ONE
  })
  basket_type: BasketType;

  @Prop({ 
    type: String,
    enum: [BasketStatus.PENDING, BasketStatus.IN_PROCESS, BasketStatus.COMPLETED],
    required: true,
    default: BasketStatus.PENDING
  })
  basket_status: BasketStatus;
}

export const BasketSchema = SchemaFactory.createForClass(Basket);
