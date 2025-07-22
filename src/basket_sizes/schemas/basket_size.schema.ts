import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BasketSizeDocument = BasketSize & Document;

@Schema({ timestamps: true })
export class BasketSize {
  @Prop({ required: true, unique: true })
  package_id: string;

  @Prop({ required: true })
  package_name: string;

  @Prop({ required: false })
  package_detail: string;

  @Prop({ required: false })
  package_short_name: string;

  @Prop({ required: true })
  package_type: string;

  @Prop({ required: true, type: Number })
  package_width: number;

  @Prop({ required: true, type: Number })
  package_length: number;

  @Prop({ required: true, type: Number })
  package_height: number;

  @Prop({ required: true, type: Number })
  package_weight: number;

  @Prop({ required: true, type: Number })
  package_cost: number;

  @Prop({ required: true, default: true })
  package_use: boolean;
}

export const BasketSizeSchema = SchemaFactory.createForClass(BasketSize);
