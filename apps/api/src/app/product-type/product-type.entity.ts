import { Entity, Column, OneToMany } from 'typeorm';
import { Base } from '../core/entities/base';
import { ProductType as IProductType } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { Product } from '../product/product.entity';

@Entity('product_type')
export class ProductType extends Base implements IProductType {
	@ApiProperty({ type: String })
	@IsString()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	organizationId: string;

	@OneToMany(
		(type) => Product,
		(product) => product.type
	)
	products: Product[];
}
