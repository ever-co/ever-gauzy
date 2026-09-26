import { DecimalAmount } from '../shared/is-decimal-amount.validator';
import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ICommerceCartLine, ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { CommerceCart } from '../commerce-cart/commerce-cart.entity';
import { MikroOrmCommerceCartLineRepository } from './repository/mikro-orm-commerce-cart-line.repository';

/**
 * One line of a cart.
 *
 * The line is a snapshot: the title, SKU and thumbnail are copied at add time so that renaming or
 * republishing a product does not rewrite what the buyer is looking at, and `originalUnitPrice`
 * records the price before any discount so a struck-through price can be shown without recomputing
 * history. Only `unitPrice` is rewritten, and only by a re-price.
 */
@MultiORMEntity('commerce_cart_line', { mikroOrmRepository: () => MikroOrmCommerceCartLineRepository })
export class CommerceCartLine extends TenantOrganizationBaseEntity implements ICommerceCartLine {
	/** The cart this line belongs to. A line cannot exist without its cart. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	cartId: ID;

	/** The product, kept for reporting. Nullable because the line survives deletion of the product. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	productId?: ID;

	/** The sellable unit that was added. Kept for re-resolution, stock and fulfilment. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	variantId?: ID;

	/**
	 * The seller whose offering the line resolved to, on a marketplace channel. Immutable once the
	 * line exists: which seller is paid cannot change after the buyer agreed to the price.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	sellerId?: ID;

	/** Snapshot of the variant or product title at add time. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn()
	title: string;

	/** Snapshot of the SKU at add time. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 128 })
	sku?: string;

	/** Snapshot of the image URL at add time. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 1024 })
	thumbnail?: string;

	/** The quantity. `numeric`, not `int`, because a variant may be sold by weight or length. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	quantity: number;

	/** The resolved price after the price calculation strategy, rounded at the unit-price boundary. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	unitPrice: DecimalAmount;

	/** The pre-discount price, kept so a struck-through price can be shown. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	originalUnitPrice: DecimalAmount;

	/** Whether `unitPrice` is a gross. An inclusive line is normalised to net before totals are summed. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isTaxInclusive: boolean;

	/** The tax class the line is taxed under. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	taxCategoryId?: ID;

	/** A promotion may not discount this line when false. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	isDiscountable: boolean;

	/**
	 * Copied from the variant. A digital line does not participate in shipping allocation, weight
	 * checks or the item-count checks of the shipping options.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	requiresShipping: boolean;

	/** Snapshot of the variant's weight, for shipping eligibility and rating. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true, type: 'numeric', precision: 12, scale: 4, transformer: new ColumnNumericTransformerPipe() })
	weight?: number;

	/** Display order inside the cart. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 0 })
	position: number;

	/** A per-line note from the buyer, carried onto the order line. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, type: 'text' })
	note?: string;

	/** The location the line is allocated from, once allocation has run. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	warehouseId?: ID;

	/**
	 * The subscription plan the line is sold under. The plan is created by the subscription package,
	 * which is installed later than this one, so the column carries no foreign key here.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	subscriptionPlanId?: ID;

	/** Open-ended per-line payload: age limits, restricted countries and custom-price reasons. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** The cart. */
	@MultiORMManyToOne(() => CommerceCart, (it) => it.lines, { onDelete: 'CASCADE' })
	@JoinColumn()
	cart?: CommerceCart;
}
