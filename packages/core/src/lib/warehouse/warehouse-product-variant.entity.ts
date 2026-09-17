import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IProductVariant, IWarehouseProduct, IWarehouseProductVariant } from '@gauzy/contracts';
import { ProductVariant, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { WarehouseProduct } from './warehouse-product.entity';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmWarehouseProductVariantRepository } from './repository/mikro-orm-warehouse-product-variant.repository';

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
	 */
	@ApiPropertyOptional({ type: () => Number })
	@MultiORMColumn({ type: 'int', default: 1 })
	version: number;

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
