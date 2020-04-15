import { Entity, Column } from 'typeorm';
import { Base } from '../core/entities/base';
import { ProductOption as IProductOption } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Product } from '../product/product.entity';

@Entity('product_option')
export class ProductOption extends Base implements IProductOption {
	@ApiProperty({ type: String })
	@IsString()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column()
	code: string;

	// @ManyToOne(()=> Product, product => product.options)
	product: Product;
}
