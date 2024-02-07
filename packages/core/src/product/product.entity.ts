import {
	RelationId,
	JoinColumn,
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
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmProductRepository } from './repository/mikro-orm-product.repository';
import { MultiORMManyToMany, MultiORMManyToOne, MultiORMOneToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('product', { mikroOrmRepository: () => MikroOrmProductRepository })
export class Product extends TranslatableBase implements IProductTranslatable {

	@ApiPropertyOptional({ type: () => Boolean })
	@MultiORMColumn({ default: true })
	enabled: boolean;

	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn()
	code: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
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
	@MultiORMManyToOne(() => ImageAsset, (imageAsset) => imageAsset.productFeaturedImage, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	featuredImage?: IImageAsset;

	@ApiProperty({ type: () => String })
	@RelationId((it: Product) => it.featuredImage)
	@IsString()
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	featuredImageId?: string;

	/**
	 * ProductType
	 */
	@ApiProperty({ type: () => ProductType })
	@MultiORMManyToOne(() => ProductType, (productType) => productType.products, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	productType?: ProductType;

	@ApiProperty({ type: () => String })
	@RelationId((it: Product) => it.productType)
	@IsString()
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	productTypeId?: string;

	/**
	 * ProductCategory
	 */

	@ApiProperty({ type: () => ProductCategory })
	@MultiORMManyToOne(() => ProductCategory, (productCategory) => productCategory.products, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	productCategory?: ProductCategory;

	@ApiProperty({ type: () => String })
	@RelationId((it: Product) => it.productCategory)
	@IsString()
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
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
	@MultiORMOneToMany(() => ProductTranslation, (productTranslation) => productTranslation.reference, {
		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,

		/** Database cascade actions. */
		cascade: true
	})
	translations: ProductTranslation[];

	/**
	 * ProductVariant
	 */
	@ApiPropertyOptional({ type: () => ProductVariant, isArray: true })
	@MultiORMOneToMany(() => ProductVariant, (productVariant) => productVariant.product, {
		cascade: true
	})
	variants?: ProductVariant[];

	/**
	 * ProductOptionGroup
	 */
	@ApiPropertyOptional({ type: () => ProductOptionGroup, isArray: true })
	@MultiORMOneToMany(() => ProductOptionGroup, (productOptionGroup) => productOptionGroup.product, {
		cascade: true
	})
	optionGroups?: ProductOptionGroup[];

	/**
	 * InvoiceItem
	 */
	@ApiPropertyOptional({ type: () => InvoiceItem, isArray: true })
	@MultiORMOneToMany(() => InvoiceItem, (invoiceItem) => invoiceItem.product)
	@JoinColumn()
	invoiceItems?: IInvoiceItem[];

	/**
	 * WarehouseProduct
	 */
	@ApiPropertyOptional({ type: () => WarehouseProduct, isArray: true })
	@MultiORMOneToMany(() => WarehouseProduct, (warehouseProduct) => warehouseProduct.product, {
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
	@MultiORMManyToMany(() => Tag, (tag) => tag.products, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_product'
	})
	@JoinTable({
		name: 'tag_product'
	})
	tags?: ITag[];

	/**
	 * ImageAsset
	 */
	@ApiProperty({ type: () => ImageAsset, isArray: true })
	@MultiORMManyToMany(() => ImageAsset, (imageAsset) => imageAsset.productGallery, {
		cascade: false,
		owner: true,
		pivotTable: 'product_gallery_item'
	})
	@JoinTable({
		name: 'product_gallery_item'
	})
	gallery?: IImageAsset[];
}
