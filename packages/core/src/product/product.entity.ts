import {
	Entity,
	Column,
	OneToMany,
	RelationId,
	JoinColumn,
	ManyToOne,
	ManyToMany,
	JoinTable,
	Index
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import {
	IInvoiceItem,
	IImageAsset,
	IProductTranslatable,
	ITag,
	IWarehouse
} from '@gauzy/contracts';
import {
	ImageAsset,
	InvoiceItem,
	ProductCategory,
	ProductTranslation,
	ProductType,
	ProductVariant,
	Tag,
	TranslatableBase,
	ProductOptionGroup,
	WarehouseProduct
} from '../core/entities/internal';

@Entity('product')
export class Product extends TranslatableBase implements IProductTranslatable {
	
	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ default: true })
	enabled: boolean;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column()
	code: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	imageUrl: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * ImageAsset
	 */
	@ApiProperty({ type: () => ImageAsset })
	@ManyToOne(() => ImageAsset, (imageAsset) => imageAsset.productFeaturedImage, {
		onDelete: 'SET NULL' 
	})
	@JoinColumn()
	featuredImage?: IImageAsset;

	@ApiProperty({ type: () => String })
	@RelationId((it: Product) => it.featuredImage)
	@IsString()
	@Index()
	@Column({ nullable: true })
	featuredImageId?: string;

	/**
	 * ProductType
	 */
	@ApiProperty({ type: () => ProductType })
	@ManyToOne(() => ProductType, (productType) => productType.products, {
		onDelete: 'SET NULL' 
	})
	@JoinColumn()
	productType?: ProductType;

	@ApiProperty({ type: () => String })
	@RelationId((it: Product) => it.productType)
	@IsString()
	@Index()
	@Column()
	productTypeId?: string;

	/**
	 * ProductCategory
	 */
	
	@ApiProperty({ type: () => ProductCategory })
	@ManyToOne(() => ProductCategory, (productCategory) => productCategory.products, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	productCategory?: ProductCategory;

	@ApiProperty({ type: () => String })
	@RelationId((it: Product) => it.productCategory)
	@IsString()
	@Index()
	@Column()
	productCategoryId?: string;
	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */

	/**
	 * ProductTranslation
	 */
	@ApiProperty({ type: () => ProductTranslation, isArray: true })
	@OneToMany(() => ProductTranslation, (productTranslation) => productTranslation.reference, {
		eager: true,
		cascade: true
	})
	translations: ProductTranslation[];

	/**
	 * ProductVariant
	 */
	@ApiPropertyOptional({ type: () => ProductVariant, isArray: true })
	@OneToMany(() => ProductVariant, (productVariant) => productVariant.product, {
		cascade: true
	})
	variants?: ProductVariant[];

	/**
	 * ProductOptionGroup
	 */
	@ApiPropertyOptional({ type: () => ProductOptionGroup, isArray: true })
	@OneToMany(() => ProductOptionGroup, (productOptionGroup) => productOptionGroup.product, {
		cascade: true
	})
	optionGroups?: ProductOptionGroup[];

	/**
	 * InvoiceItem
	 */
	@ApiPropertyOptional({ type: () => InvoiceItem, isArray: true })
	@OneToMany(() => InvoiceItem, (invoiceItem) => invoiceItem.product)
	@JoinColumn()
	invoiceItems?: IInvoiceItem[];

	/**
	 * WarehouseProduct
	 */
	@ApiPropertyOptional({ type: () => WarehouseProduct, isArray: true })
	@OneToMany(() => WarehouseProduct, (warehouseProduct) => warehouseProduct.product, {
		cascade: true 
	})
	@JoinColumn()
	warehouses?: IWarehouse[];

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */

	/**
	 * Tag
	 */
	@ApiProperty({ type: () => Tag, isArray: true })
	@ManyToMany(() => Tag, (tag) => tag.product)
	@JoinTable({
		name: 'tag_product'
	})
	tags?: ITag[];

	/**
	 * ImageAsset
	 */
	@ApiProperty({ type: () => ImageAsset, isArray: true })
	@ManyToMany(() => ImageAsset, (imageAsset) => imageAsset.productGallery, {
		cascade: false
	})
	@JoinTable({
		name: 'product_gallery_item'
	})
	gallery?: IImageAsset[];
}
