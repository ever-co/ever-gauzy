import { Base } from '../core/entities/base';
import {
	Entity,
	Column,
	OneToMany,
	RelationId,
	JoinColumn,
	ManyToOne,
	ManyToMany,
	JoinTable
} from 'typeorm';
import { Product as IProduct } from '@gauzy/models';
import { ProductVariant } from '../product-variant/product-variant.entity';
import { ProductType } from '../product-type/product-type.entity';
import { ProductCategory } from '../product-category/product-category.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { ProductOption } from '../product-option/product-option.entity';
import { Tag } from '../tags/tag.entity';
import { InvoiceItem } from '../invoice-item/invoice-item.entity';

@Entity('product')
export class Product extends Base implements IProduct {
	@ManyToMany((type) => Tag)
	@JoinTable({
		name: 'tag_product'
	})
	tags: Tag[];

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
		(productVariant) => productVariant.product,
		{ onDelete: 'CASCADE' }
	)
	variants: ProductVariant[];

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((product: Product) => product.type)
	productTypeId: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((product: Product) => product.category)
	productCategoryId: string;

	@ManyToOne(() => ProductType, { onDelete: 'SET NULL' })
	@JoinColumn()
	type: ProductType;

	@ManyToOne(() => ProductCategory, { onDelete: 'SET NULL' })
	@JoinColumn()
	category: ProductCategory;

	@OneToMany(
		(type) => ProductOption,
		(productOption) => productOption.product
	)
	options: ProductOption[];

	@ApiPropertyOptional({ type: InvoiceItem, isArray: true })
	@OneToMany((type) => InvoiceItem, (invoiceItem) => invoiceItem.product, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoiceItems?: InvoiceItem[];
}
