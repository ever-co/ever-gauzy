import { Base } from '../core/entities/base';
import {
	Entity,
	Column,
	OneToMany,
	RelationId,
	JoinColumn,
	ManyToOne
} from 'typeorm';
import { Product as IProduct } from '@gauzy/models';
import { ProductVariant } from '../product-variant/product-variant.entity';
import { ProductType } from '../product-type/product-type.entity';
import { ProductCategory } from '../product-category/product-category.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { ProductOption } from '../product-option/product-option.entity';

@Entity('product')
export class Product extends Base implements IProduct {
	@ApiProperty({ type: String })
	@IsString()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column()
	description: string;

	@ApiPropertyOptional({ type: Boolean })
	@Column({ default: true })
	enabled: boolean;

	@ApiProperty({ type: String })
	@IsString()
	@Column()
	code: string;

	@OneToMany(
		() => ProductVariant,
		(productVariant) => productVariant.product
	)
	variants: ProductVariant[];

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((product: Product) => product.type)
	productTypeId: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((product: Product) => product.category)
	productCategoryId: string;

	@ManyToOne(() => ProductType)
	@JoinColumn()
	type: ProductType;

	@ManyToOne((category) => ProductCategory)
	@JoinColumn()
	category?: ProductCategory;

	@OneToMany(
		(type) => ProductOption,
		(productOption) => productOption.product
	)
	options?: ProductOption[];
}
