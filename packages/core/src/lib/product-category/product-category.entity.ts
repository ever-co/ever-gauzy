import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ID, IImageAsset, IProductCategoryTranslatable } from '@gauzy/contracts';
import {
	ImageAsset,
	Product,
	ProductCategoryTranslation,
	TranslatableBase
} from '../core/entities/internal';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany
} from './../core/decorators/entity';
import { ProductStatus } from '../core/enums/kernel-extension.enums';
import { MikroOrmProductCategoryRepository } from './repository/mikro-orm-product-category.repository';

/**
 * The taxonomy as a tree.
 *
 * `parentId` is the self-reference that turns the flat list into a tree; it is carried as the
 * queryable column and the constraint that owns it is created by the migration that owns the table.
 * The three indexes are the navigation reads: one slug per organization, the sibling ordering under a
 * parent, and the lifecycle filter that the same navigation applies to categories and products alike.
 */
@ColumnIndex('UQ_product_category_org_slug', ['organizationId', 'slug'], {
	unique: true,
	where: '"slug" IS NOT NULL AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_product_category_org_parent_sort', ['organizationId', 'parentId', 'sortOrder'], {
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_product_category_org_status', ['organizationId', 'status'], { where: '"deletedAt" IS NULL' })
@MultiORMEntity('product_category', { mikroOrmRepository: () => MikroOrmProductCategoryRepository })
export class ProductCategory extends TranslatableBase
	implements IProductCategoryTranslatable {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	imageUrl: string;

	/**
	 * Parent category. Null on a root, which is what every existing category becomes: the taxonomy was
	 * flat, so no existing row acquires a parent it never had.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	parentId?: ID;

	/**
	 * URL-safe identity used by `/categories/:slug`.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	slug?: string;

	/**
	 * Ordering of the category among its siblings.
	 */
	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	sortOrder?: number;

	/**
	 * Merchandising flag for "featured categories" navigation.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isFeatured?: boolean;

	/**
	 * Lifecycle of the category. The value set is deliberately identical to `product.status`, so one
	 * navigation filter covers both.
	 */
	@ApiPropertyOptional({ type: () => String, enum: ProductStatus, default: ProductStatus.ACTIVE })
	@IsEnum(ProductStatus)
	@MultiORMColumn({ type: 'simple-enum', enum: ProductStatus, default: ProductStatus.ACTIVE })
	status?: ProductStatus;

	/**
	 * Tenant extras, for example a navigation icon set or an external taxonomy id.
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
	@MultiORMManyToOne(() => ImageAsset, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true
	})
	@JoinColumn()
	image?: ImageAsset;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: ProductCategory) => it.image)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	imageId?: IImageAsset['id'];

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Product
	 */
	@ApiProperty({ type: () => Product, isArray: true })
	@MultiORMOneToMany(() => Product, (product) => product.productCategory)
	products: Product[];

	/**
	 * ProductCategoryTranslation
	 */
	@ApiProperty({ type: () => ProductCategoryTranslation, isArray: true })
	@MultiORMOneToMany(() => ProductCategoryTranslation, (instance) => instance.reference, {
		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,

		/** Database cascade action. */
		cascade: true
	})
	translations: ProductCategoryTranslation[];
}
