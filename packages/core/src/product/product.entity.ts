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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { IProductTranslatable } from '@gauzy/contracts';
import {
	ImageAsset,
	InvoiceItem,
	ProductCategory,
	ProductOption,
	ProductTranslation,
	ProductType,
	ProductVariant,
	Tag,
	TranslatableBase
} from '../core/entities/internal';

@Entity('product')
export class Product extends TranslatableBase implements IProductTranslatable {
	@ManyToMany(() => Tag, (tag) => tag.product)
	@JoinTable({
		name: 'tag_product'
	})
	tags?: Tag[];

	@ApiPropertyOptional({ type: Boolean })
	@Column({ default: true })
	enabled: boolean;

	@ApiProperty({ type: String })
	@IsString()
	@Column()
	code: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	imageUrl: string;

	@ApiProperty({ type: ImageAsset })
	@ManyToOne(() => ImageAsset, { onDelete: 'SET NULL' })
	@JoinColumn()
	featuredImage: ImageAsset;

	@OneToMany(
		() => ProductVariant,
		(productVariant) => productVariant.product,
		{
			onDelete: 'CASCADE'
		}
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

	@OneToMany(() => ProductOption, (productOption) => productOption.product)
	options: ProductOption[];

	@ApiPropertyOptional({ type: InvoiceItem, isArray: true })
	@OneToMany(() => InvoiceItem, (invoiceItem) => invoiceItem.product, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoiceItems?: InvoiceItem[];

	@ApiProperty({ type: ProductTranslation, isArray: true })
	@OneToMany(
		() => ProductTranslation,
		(productTranslation) => productTranslation.reference,
		{
			eager: true,
			cascade: true
		}
	)
	translations: ProductTranslation[];

	@ManyToMany(() => ImageAsset, { cascade: true })
	@JoinTable({
		name: 'product_gallery_item'
	})
	gallery: ImageAsset[];
}
