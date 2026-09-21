import { JoinColumn, RelationId, Tree, TreeChildren, TreeParent } from 'typeorm';
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
 *
 * **`@Tree('closure-table')` is what makes the subtree cheap.** "Every descendant of a category" is the
 * read a catalogue navigation does on every request, and the three ways to answer it are a recursive
 * query, a materialised path or a closure table. The first is what SQLite and MySQL 5.7 cannot express
 * efficiently — the embedded database is the one a demo runs on — and the second has to be rewritten on
 * every re-parent. The closure table the ORM maintains is one row per (ancestor, descendant) pair,
 * including the self-pair, so the read is one indexed join and a re-parent is a write the ORM makes. It
 * is derived: `product_category_closure` is not an entity and no service queries it directly.
 */
@Tree('closure-table')
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
	@RelationId((it: ProductCategory) => it.parent)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	parentId?: ID;

	/**
	 * The parent itself, as the tree repository reads and writes it.
	 *
	 * `SET NULL` is the rule the schema promises: deleting a parent makes its children roots rather than
	 * deleting them, because a category that holds products is not something a delete should cascade
	 * into. The column above keeps the relation id, so a caller that only needs the parent's identity
	 * never loads the parent row.
	 */
	@ApiPropertyOptional({ type: () => ProductCategory })
	@IsOptional()
	@TreeParent({ onDelete: 'SET NULL' })
	@JoinColumn()
	parent?: ProductCategory;

	/**
	 * The children, as the tree repository reads them.
	 */
	@ApiPropertyOptional({ type: () => [ProductCategory] })
	@IsOptional()
	@TreeChildren()
	children?: ProductCategory[];

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
