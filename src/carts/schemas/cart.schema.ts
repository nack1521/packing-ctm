import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CartDocument = Cart & Document;

export enum CartStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

@Schema({ 
  timestamps: true,
  toJSON: { getters: true }
})
export class Cart {
  // Array of baskets in this cart
  @Prop({ 
    type: [{
      _id: { type: Types.ObjectId, ref: 'Basket' },
      basket_size: {
        package_id: { type: String },
        package_name: { type: String },
        package_width: { type: Number },
        package_length: { type: Number },
        package_height: { type: Number },
        package_weight: { type: Number },
        package_cost: { type: Number }
      },
      basket_type: { type: String },
      basket_status: { type: String },
      package_count: { type: Number }, // Number of packages in this basket
      total_products: { type: Number } // Total products across all packages in this basket
    }],
    default: []
  })
  basket_list: {
    _id: Types.ObjectId;
    basket_size: {
      package_id: string;
      package_name: string;
      package_width: number;
      package_length: number;
      package_height: number;
      package_weight: number;
      package_cost: number;
    };
    basket_type: string;
    basket_status: string;
    package_count: number;
    total_products: number;
  }[];

  @Prop({ 
    type: String,
    enum: [CartStatus.PENDING, CartStatus.IN_PROGRESS, CartStatus.COMPLETED, CartStatus.CANCELLED],
    required: true,
    default: CartStatus.PENDING
  })
  cart_status: CartStatus;

  // Summary fields
  @Prop({ 
    type: Number,
    default: 0
  })
  total_baskets: number;

  @Prop({ 
    type: Number,
    default: 0
  })
  total_packages: number;

  @Prop({ 
    type: Number,
    default: 0
  })
  total_products: number;

  @Prop({ 
    type: Number,
    default: 0
  })
  total_cost: number;
}

export const CartSchema = SchemaFactory.createForClass(Cart);
