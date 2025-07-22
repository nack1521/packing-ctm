import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {
    @Prop({ required: true })
    product_name: string;

    @Prop({ required: true, type: Number })
    product_weight: number;

    @Prop({ 
        required: true,
        type: {
            width: { type: Number, required: true },
            length: { type: Number, required: true },
            height: { type: Number, required: true }
        }
    })
    dimensions: {
        width: number;
        length: number;
        height: number;
    };
}

export const ProductSchema = SchemaFactory.createForClass(Product);