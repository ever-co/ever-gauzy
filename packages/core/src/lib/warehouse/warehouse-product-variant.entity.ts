import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID, IProductVariant, IWarehouseProduct, IWarehouseProductVariant } from '@gauzy/contracts';
import { ProductVariant, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { WarehouseProduct } from './warehouse-product.entity';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne
} from './../core/decorators/entity';
import { VersionedColumn } from './../concurrency';
import { MikroOrmWarehouseProductVariantRepository } from './repository/mikro-orm-warehouse-product-variant.repository';

/**
 * The stock level: the authoritative quantity of one variant at one location.
 *
 * Availability (`quantity − reservedQuantity`) is deliberately **not** stored — it is computed by the
 * service from the two columns, so it can never drift. `binId` is the level's home bin on a location
 * that is organised into zones and bins and is created without its foreign key, because the bin table
 * belongs to the warehouse package; `binLocation` remains the free-text address on a location that has
 * not been organised that way.
 */
@ColumnIndex('IDX_warehouse_product_variant_variant_qty', ['variantId', 'quantity'], {
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_warehouse_product_variant_wp', ['warehouseProductId'])
@ColumnIndex('IDX_warehouse_product_variant_org_restock', ['organizationId', 'trackInventory', 'restockThreshold'], {
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('UQ_warehouse_product_variant_level', ['warehouseProductId', 'variantId'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
@MultiORMEntity('warehouse_product_variant', { mikroOrmRepository: () => MikroOrmWarehouseProductVariantRepository })
export class WarehouseProductVariant extends TenantOrganizationBaseEntity
	implements IWarehouseProductVariant {

	@ApiPropertyOptional({ type: Number })
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	quantity: number;

	/**
	 * Quantity held by open reservations at this level. Availability is derived from it and is never
	 * stored: a stored available quantity would be a third source of truth for one number.
	 */
	@ApiPropertyOptional({ type: Number })
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	reservedQuantity: number;

	/**
	 * Buffer that has to stay unsold, subtracted from availability.
	 */
	@ApiPropertyOptional({ type: Number })
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	safetyStock: number;

	/**
	 * Quantity already on its way to this level. Reported beside availability rather than added to it,
	 * because goods that have not arrived cannot be sold.
	 */
	@ApiPropertyOptional({ type: Number })
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	incomingQuantity: number;

	/**
	 * How far a hold may exceed the quantity on hand. A null limit means no ceiling was set, which is
	 * not the same as a ceiling of zero, so the column carries no default.
	 */
	@ApiPropertyOptional({ type: Number })
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	backorderLimit: number;

	/**
	 * Whether the level is untracked. A write never drives an untracked level negative.
	 */
	@ApiPropertyOptional({ type: Boolean, default: false })
	@MultiORMColumn({ nullable: true, default: false })
	isUnlimited: boolean;

	/**
	 * Whether a hold may exceed the quantity on hand at this level.
	 */
	@ApiPropertyOptional({ type: Boolean, default: false })
	@MultiORMColumn({ nullable: true, default: false })
	allowBackorder: boolean;

	/**
	 * Optimistic-lock counter. Every write takes the counter it read and bumps it, so two writers
	 * cannot both win the same level row.
	 *
	 * Declared with `@VersionedColumn()` rather than as a plain column because this row is the one a
	 * caller contends for: the counter is what a version-predicated write checks and increments in one
	 * statement, and the decorator is how a route that guards this row learns the column exists. It is
	 * the same `@MultiORMColumn` underneath, so the column is unchanged for both ORMs.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@VersionedColumn()
	version: number;

	/**
	 * Threshold for low-stock alerting and replenishment suggestions at this level.
	 */
	@ApiPropertyOptional({ type: Number })
	@IsOptional()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	restockThreshold?: number;

	/**
	 * When false this variant is not counted at this location.
	 */
	@ApiPropertyOptional({ type: Boolean, default: true })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	trackInventory?: boolean;

	/**
	 * Pick location for this variant, where the location has not been organised into zones and bins.
	 */
	@ApiPropertyOptional({ type: String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	binLocation?: string;

	/**
	 * The level's home bin on a location in zone-and-bin mode: where this stock is normally kept and
	 * the default address for a pick and for put-away. Null on a location that is not binned. The
	 * constraint is added by the warehouse package's set, which creates the bin table.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	binId?: ID;

	/**
	 * The measurement family whose reference unit every quantity on this row is expressed in, which is
	 * what makes the ledger sum an arithmetic statement rather than a comparison of two numbers that
	 * may mean different things. Backfilled from the variant's stock unit and constrained by the
	 * measurement set.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	unitCategoryId?: ID;

	/**
	 * Tenant extras.
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
	 * ProductVariant
	 */
	@ApiProperty({ type: () => ProductVariant })
	@MultiORMManyToOne(() => ProductVariant, (productVariant) => productVariant.warehouseProductVariants, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	variant: IProductVariant;

	@ApiProperty({ type: () => String })
	@RelationId((it: WarehouseProductVariant) => it.variant)
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	variantId: string;

	/**
	 * WarehouseProduct
	 */
	@MultiORMManyToOne(() => WarehouseProduct, (warehouseProduct) => warehouseProduct.variants, {
		onDelete: 'CASCADE'
	})
	warehouseProduct: IWarehouseProduct;

	@ApiProperty({ type: () => String })
	@RelationId((it: WarehouseProductVariant) => it.warehouseProduct)
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	warehouseProductId: string;
}
