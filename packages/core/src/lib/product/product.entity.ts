import {
	RelationId,
	JoinColumn,
	JoinTable
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsString, IsOptional, MaxLength, Min } from 'class-validator';
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
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany
} from './../core/decorators/entity';
import { ProductStatus } from '../core/enums/kernel-extension.enums';
import { MikroOrmProductRepository } from './repository/mikro-orm-product.repository';

/**
 * Catalogue identity and lifecycle.
 *
 * The four indexes are the catalogue's read paths: one slug per organization, the lifecycle filter,
 * the featured strip in its manual order, and the external key the import jobs upsert on.
 */
@ColumnIndex('UQ_product_org_slug', ['organizationId', 'slug'], {
	unique: true,
	where: '"slug" IS NOT NULL AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_product_org_status', ['organizationId', 'status'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_product_org_featured_sort', ['organizationId', 'isFeatured', 'sortOrder'], {
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_product_org_external', ['organizationId', 'externalId'], { where: '"externalId" IS NOT NULL' })
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

	/**
	 * Stable, human-readable, URL-safe identity used by the catalogue route `/products/:slug`.
	 *
	 * Null on every row that predates the catalogue surface; uniqueness is per organization and only
	 * among live rows, so a slug freed by a soft delete can be reused.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	slug?: string;

	/**
	 * Lifecycle gate of the row. It is authoritative for the catalogue surface, while `enabled` stays
	 * authoritative for the legacy product API; a product is listable only when both say so.
	 */
	@ApiPropertyOptional({ type: () => String, enum: ProductStatus, default: ProductStatus.ACTIVE })
	@IsEnum(ProductStatus)
	@MultiORMColumn({ type: 'simple-enum', enum: ProductStatus, default: ProductStatus.ACTIVE })
	status?: ProductStatus;

	/**
	 * Instant of first publication to any channel. Per-channel instants live on the channel
	 * publication row, not here.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	publishedAt?: Date;

	/**
	 * Organization-level merchandising flag for "featured products" queries.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isFeatured?: boolean;

	/**
	 * Manual ordering inside a curated list when no collection position applies.
	 */
	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	sortOrder?: number;

	/**
	 * The row's key in an upstream system (ERP, PIM, marketplace), used as the upsert key by the
	 * import jobs. Putting it on a mapping table would force a join on every import.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	externalId?: string;

	/**
	 * Tenant-defined, non-indexed extras that do not deserve a column of their own.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;

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
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	featuredImage?: IImageAsset;

	@ApiProperty({ type: () => String })
	@RelationId((it: Product) => it.featuredImage)
	@IsString()
	@ColumnIndex()
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
	@ColumnIndex()
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
	@ColumnIndex()
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
		pivotTable: 'tag_product',
		joinColumn: 'productId',
		inverseJoinColumn: 'tagId',
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
		pivotTable: 'product_gallery_item',
		joinColumn: 'productId',
		inverseJoinColumn: 'imageAssetId',
	})
	@JoinTable({
		name: 'product_gallery_item'
	})
	gallery?: IImageAsset[];
}
