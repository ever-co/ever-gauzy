import {
	RelationId,
	JoinColumn,
	JoinTable
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ID,
	IProductVariant,
	BillingInvoicingPolicyEnum,
	IProductTranslatable,
	IProductVariantPrice,
	IProductVariantSetting,
	IProductOptionTranslatable,
	IWarehouseProductVariant
} from '@gauzy/contracts';
import {
	IsBoolean,
	IsEnum,
	IsInt,
	IsNumber,
	IsString,
	IsOptional,
	IsUUID,
	MaxLength,
	Min
} from 'class-validator';
import {
	ImageAsset,
	Product,
	ProductOption,
	ProductVariantPrice,
	ProductVariantSetting,
	TenantOrganizationBaseEntity,
	WarehouseProductVariant
} from '../core/entities/internal';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany,
	MultiORMOneToOne
} from './../core/decorators/entity';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { PurchaseBillingPolicy } from '../core/enums/kernel-extension.enums';
import { MikroOrmProductVariantRepository } from './repository/mikro-orm-product-variant.repository';

/**
 * Tax classification, trade data and the measurement units the sellable unit is counted in.
 *
 * Every reference to a table another package owns — the tax category, the four units, the warehouse
 * bin — is carried here as the queryable column **without** its foreign key: the constraint is added
 * by the set that creates the target, so this table can be extended by a kernel migration that never
 * waits for a package to be installed.
 */
@ColumnIndex('IDX_product_variant_product_position', ['productId', 'position'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_product_variant_org_barcode', ['organizationId', 'barcode'], { where: '"barcode" IS NOT NULL' })
@ColumnIndex('IDX_product_variant_tax_category', ['taxCategoryId'])
@ColumnIndex('UQ_product_variant_default', ['productId'], {
	unique: true,
	where: '"isDefault" = true AND "deletedAt" IS NULL'
})
@ColumnIndex('UQ_product_variant_org_external', ['organizationId', 'externalId'], {
	unique: true,
	where: '"externalId" IS NOT NULL AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_product_variant_org_hs_code', ['organizationId', 'hsCode'], {
	where: '"hsCode" IS NOT NULL AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_product_variant_stock_unit', ['stockUnitId'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_product_variant_sales_unit', ['salesUnitId'], { where: '"salesUnitId" IS NOT NULL' })
@ColumnIndex('IDX_product_variant_weight_unit', ['weightUnitId'], { where: '"weightUnitId" IS NOT NULL' })
@MultiORMEntity('product_variant', { mikroOrmRepository: () => MikroOrmProductVariantRepository })
export class ProductVariant extends TenantOrganizationBaseEntity implements IProductVariant {
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	taxes: number;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	notes: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	quantity: number;

	@ApiProperty({ type: () => String })
	@IsEnum(BillingInvoicingPolicyEnum)
	@MultiORMColumn({ default: BillingInvoicingPolicyEnum.QUANTITY_ORDERED })
	billingInvoicingPolicy: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn({ nullable: true })
	internalReference: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@MultiORMColumn({ default: true })
	enabled: boolean;

	/**
	 * The tax class this variant is taxed as. It supersedes `taxes` when set; `taxes` remains the
	 * legacy fallback, so no existing installation changes its tax output. The constraint is added by
	 * the tax package's set, which is what creates the target table.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	taxCategoryId?: ID;

	/**
	 * EAN / UPC / GTIN scanned at picking, receiving and returns.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	barcode?: string;

	/**
	 * Shipping weight, read by the shipping calculation and compared against a shipping option's
	 * maximum. It is a bare decimal until `weightUnitId` says what it measures.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 12,
		scale: 4,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	weight?: number;

	/**
	 * Marks the variant shown when a product is listed without an explicit variant. At most one per
	 * product, which is what the partial unique index on `productId` enforces.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isDefault?: boolean;

	/**
	 * Digital goods, services and time are sold as variants that need no shipment.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: true })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	requiresShipping?: boolean;

	/**
	 * Deterministic ordering of the variant among its siblings, on the product page and in pick lists.
	 */
	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	position?: number;

	/**
	 * The variant's key in an upstream system, mirroring `product.externalId`.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	externalId?: string;

	/**
	 * Customs commodity code (HS / HTS) of the goods themselves.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 16 })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	hsCode?: string;

	/**
	 * Manufacturer identification code required by the destination customs authority.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	midCode?: string;

	/**
	 * ISO 3166-1 alpha-2 country of origin, which may differ from the shipping or manufacturing
	 * country. When set it must be a row of the country lookup.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 2 })
	@IsOptional()
	@IsString()
	@MaxLength(2)
	@MultiORMColumn({ type: 'varchar', length: 2, nullable: true })
	originCountryCode?: string;

	/**
	 * Predominant material or composition, printed on a customs declaration and on a fibre-content
	 * label.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	material?: string;

	/**
	 * The unit this variant's stock levels and movements are counted in. It must be the reference unit
	 * of its own category, which is what keeps the ledger sum one number in one unit for ever.
	 *
	 * Nullable in this migration on purpose: the column has to exist before the unit tables do, and the
	 * backfill to the organization's `COUNT` reference unit is definitional — every existing quantity
	 * already means pieces — so it runs in the seed that creates those units, after which the column is
	 * made `NOT NULL`. The constraint is added by the measurement set.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	stockUnitId?: ID;

	/**
	 * The unit it is sold in; null means the stock unit. When set it must share `stockUnitId`'s
	 * category — a service check, because the rule compares a column of this row with a column of
	 * another.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	salesUnitId?: ID;

	/**
	 * The unit it is bought in; null means the stock unit. Same-category rule as `salesUnitId`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	purchaseUnitId?: ID;

	/**
	 * The `MASS` unit `weight` is expressed in. Null means the organization's configured default mass
	 * unit, which is what makes the weight above a measurement rather than a bare decimal.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	weightUnitId?: ID;

	/**
	 * Which quantity a supplier's bill is matched against. It is the buy-side counterpart of
	 * `billingInvoicingPolicy` and deliberately a separate column: buy and sell policies are
	 * independent, and overloading one would make a sales-invoice change silently move the purchasing
	 * match. Null means the vendor product term's override, else `ON_RECEIVED` when
	 * `requiresShipping` is true and `ON_ORDERED` when it is false.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PurchaseBillingPolicy })
	@IsOptional()
	@IsEnum(PurchaseBillingPolicy)
	@MultiORMColumn({ type: 'simple-enum', enum: PurchaseBillingPolicy, nullable: true })
	purchaseBillingPolicy?: PurchaseBillingPolicy;

	/**
	 * Tenant extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| @OneToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * ProductVariantPrice
	 */
	@MultiORMOneToOne(() => ProductVariantPrice, (productVariantPrice) => productVariantPrice.productVariant, {
		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE',

		/** This column is a boolean flag indicating that this is the inverse side of the relationship, and it doesn't control the foreign key directly  */
		owner: false
	})
	@JoinColumn()
	price: IProductVariantPrice;

	/**
	 * ProductVariantSetting
	 */
	@MultiORMOneToOne(() => ProductVariantSetting, (productVariantSetting) => productVariantSetting.productVariant, {
		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE',

		/** This column is a boolean flag indicating that this is the inverse side of the relationship, and it doesn't control the foreign key directly  */
		owner: false
	})
	@JoinColumn()
	setting: IProductVariantSetting;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Product
	 */
	@ApiProperty({ type: () => Product })
	@MultiORMManyToOne(() => Product, (product) => product.variants, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	product?: IProductTranslatable;

	@ApiProperty({ type: () => String })
	@RelationId((it: ProductVariant) => it.product)
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	productId?: string;

	/**
	 * ImageAsset
	 */
	@ApiProperty({ type: () => ImageAsset })
	@MultiORMManyToOne(() => ImageAsset, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,
	})
	@JoinColumn()
	image?: ImageAsset;

	@ApiProperty({ type: () => String })
	@RelationId((it: ProductVariant) => it.image)
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	imageId?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * ProductOption
	 */
	@ApiProperty({ type: () => WarehouseProductVariant, isArray: true })
	@MultiORMOneToMany(() => WarehouseProductVariant, (warehouseProductVariant) => warehouseProductVariant.variant, {
		cascade: true
	})
	warehouseProductVariants?: IWarehouseProductVariant[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * ProductOption
	 */
	@ApiProperty({ type: () => ProductOption })
	@MultiORMManyToMany(() => ProductOption, {
		eager: true,
		// The table TypeORM's `@JoinTable()` names by default and the migrations created. MikroORM's own default
		// is `product_variant_options`, which does not exist: every variant read failed under MikroORM.
		owner: true,
		pivotTable: 'product_variant_options_product_option',
		joinColumn: 'productVariantId',
		inverseJoinColumn: 'productOptionId'
	})
	@JoinTable()
	options: IProductOptionTranslatable[];
}
