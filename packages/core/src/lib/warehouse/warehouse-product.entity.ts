import {
	JoinColumn,
	RelationId
} from 'typeorm';
import {
	ID,
	IProductTranslatable,
	IWarehouse,
	IWarehouseProduct,
	IWarehouseProductVariant
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import {
	Product,
	Warehouse,
	WarehouseProductVariant,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany
} from './../core/decorators/entity';
import { VersionedColumn } from './../concurrency';
import { MikroOrmWarehouseProductRepository } from './repository/mikro-orm-warehouse-product.repository';

/**
 * The cached product-level stock level: the sum of the variant levels at one location.
 *
 * The row owns both sides of the stock equation — what is held, what is on its way — plus the
 * replenishment parameters the low-stock alert and the purchasing suggestion read. Every quantity on
 * the row is expressed in the reference unit of the family `unitCategoryId` names, which is what makes
 * a sum across the variant levels arithmetically meaningful.
 */
@ColumnIndex('IDX_warehouse_product_warehouse_qty', ['warehouseId', 'quantity'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_warehouse_product_org_restock', ['organizationId', 'trackInventory', 'restockThreshold'], {
	where: '"deletedAt" IS NULL'
})
@MultiORMEntity('warehouse_product', { mikroOrmRepository: () => MikroOrmWarehouseProductRepository })
export class WarehouseProduct extends TenantOrganizationBaseEntity
	implements IWarehouseProduct {

	@ApiPropertyOptional({ type: Number })
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	quantity: number;

	/**
	 * Quantity held by open reservations, aggregated over the variants of this product at this
	 * location. It is the running sum of the variant rows, never re-derived by a read.
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
	 * Quantity on approved purchase orders and inbound transfers, not yet received. The same level row
	 * owns both sides of the stock equation.
	 */
	@ApiPropertyOptional({ type: Number, default: 0 })
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	incomingQuantity?: number;

	/**
	 * The buffer that has to remain unsold; availability subtracts it.
	 */
	@ApiPropertyOptional({ type: Number, default: 0 })
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	safetyStock?: number;

	/**
	 * Orders may be taken beyond availability at this location.
	 */
	@ApiPropertyOptional({ type: Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	allowBackorder?: boolean;

	/**
	 * Maximum negative availability permitted when `allowBackorder` is true. Null means no ceiling was
	 * set, which is not the same as a ceiling of zero.
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
	backorderLimit?: number;

	/**
	 * Level at or below which the low-stock alert and the purchasing suggestion fire.
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
	 * When false the ledger is not consulted and the product is always sellable at this location.
	 */
	@ApiPropertyOptional({ type: Boolean, default: true })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	trackInventory?: boolean;

	/**
	 * Digital or made-to-order product at this location: availability is reported as unlimited.
	 */
	@ApiPropertyOptional({ type: Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isUnlimited?: boolean;

	/**
	 * Physical shelf or bin label printed on the pick list, where the location is not organised into
	 * zones and bins.
	 */
	@ApiPropertyOptional({ type: String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	binLocation?: string;

	/**
	 * Optimistic-lock counter. The level row is the contention point for a product at a location, so
	 * every write takes the counter it read and bumps it; two writers cannot both win the same row.
	 *
	 * Declared with `@VersionedColumn()` because this is the product-level half of the stock-level
	 * pair: the aggregate a variant level hangs from is written by the same engine, by both sides of
	 * the same movement, and carries the counter a version-predicated write checks and increments in
	 * one statement. The column it declares is the one that was already here.
	 */
	@ApiPropertyOptional({ type: Number, default: 1 })
	@IsInt()
	@Min(1)
	@VersionedColumn()
	version?: number;

	/**
	 * The measurement family every quantity on this row belongs to; its reference unit is the unit the
	 * numbers are in. The constraint is added by the measurement set, which creates the target table,
	 * and every variant level under this row must share the family.
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
	 * Warehouse
	 */
	@ApiProperty({ type: () => Warehouse })
	@MultiORMManyToOne(() => Warehouse, (warehouse) => warehouse.products, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	warehouse: IWarehouse;

	@ApiProperty({ type: () => String })
	@RelationId((it: WarehouseProduct) => it.warehouse)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	warehouseId: string;

	/**
	 * Product
	 */
	@ApiProperty({ type: () => Product })
	@MultiORMManyToOne(() => Product, (product) => product.warehouses, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	product: IProductTranslatable;

	@ApiProperty({ type: () => String })
	@RelationId((it: WarehouseProduct) => it.product)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	productId: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => WarehouseProductVariant, isArray: true })
	@MultiORMOneToMany(() => WarehouseProductVariant, (warehouseProductVariant) => warehouseProductVariant.warehouseProduct, {
		cascade: true
	})
	@JoinColumn()
	variants: IWarehouseProductVariant[];
}
