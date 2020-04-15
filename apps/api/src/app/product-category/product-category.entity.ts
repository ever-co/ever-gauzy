import { Entity, Column, OneToMany } from 'typeorm';
import { Base } from '../core/entities/base';
import { ProductCategory as IProductCategory } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { Product } from '../product/product.entity';

@Entity('product_category')
export class ProductCategory extends Base implements IProductCategory {
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
		(product) => product.category
	)
	products: Product[];
}
