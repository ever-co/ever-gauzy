import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CommerceCartStatus, ICommerceCart, ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity,
	VersionedColumn
} from '@gauzy/core';
import { CommerceCartLine } from '../commerce-cart-line/commerce-cart-line.entity';
import { CommerceCartPromotion } from '../commerce-cart-promotion/commerce-cart-promotion.entity';
import { CommerceCartShippingMethod } from '../commerce-cart-shipping-method/commerce-cart-shipping-method.entity';
import { CommerceCheckoutSession } from '../commerce-checkout-session/commerce-checkout-session.entity';
import { MikroOrmCommerceCartRepository } from './repository/mikro-orm-commerce-cart.repository';

/**
 * A cart: the pricing and validation workspace a buyer assembles before it becomes an order.
 *
 * Every total column here is a **cache**. The authoritative values are the cart's lines, its rows in
 * the core `adjustment` ledger and its rows in the core `tax_line` ledger; `CartTotalsCalculator` is
 * the only writer of the cache and recomputes it from those rows on every mutation. That is what
 * makes a cart re-priceable: dropping the cache and recomputing it can never disagree with the
 * ledgers, because the ledgers are what it is computed from.
 */
@MultiORMEntity('commerce_cart', { mikroOrmRepository: () => MikroOrmCommerceCartRepository })
export class CommerceCart extends TenantOrganizationBaseEntity implements ICommerceCart {
	/**
	 * The sales channel the cart belongs to. Immutable after creation: the channel decides
	 * publication, price, tax and rounding, so a cart that moved between channels would have to be
	 * re-priced wholesale.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	channelId: ID;

	/**
	 * The commercial region the cart is served by, which drives tax and shipping eligibility.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	regionId?: ID;

	/**
	 * The buyer, when the cart belongs to a known customer. Null while the cart is anonymous.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	customerId?: ID;

	/**
	 * The staff member who built the cart on the customer's behalf.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	userId?: ID;

	/**
	 * Guest identifier, and the key an abandoned cart is followed up on. Required by validation for
	 * a guest checkout.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsEmail()
	@MaxLength(255)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	email?: string;

	/**
	 * The currency every amount on this cart is expressed in. Locked at creation; changing it once a
	 * line exists is refused, because every line price would have to be re-resolved.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: string;

	/**
	 * Snapshot of the currency's decimal places. A snapshot, not a lookup: a later change to the
	 * currency master must not re-round a cart that is already priced.
	 */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 2 })
	currencyDecimals: number;

	/** The buyer's locale, used for presentment. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(10)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 10 })
	locale?: string;

	/** Where the cart is in its own lifecycle. Only an `ACTIVE` cart is mutable and may complete. */
	@ApiProperty({ type: () => String, enum: CommerceCartStatus })
	@IsEnum(CommerceCartStatus)
	@MultiORMColumn({ type: 'simple-enum', enum: CommerceCartStatus, default: CommerceCartStatus.ACTIVE })
	status: CommerceCartStatus;

	/** Set together with `orderId` when checkout succeeded. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	completedAt?: Date;

	/** Set by the abandoned-cart job. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	abandonedAt?: Date;

	/**
	 * Cart lifetime, recomputed from `lastActivityAt` on every write. The expiry job moves a cart past
	 * this instant to `EXPIRED` and releases its reservations.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	expiresAt?: Date;

	/** Touched by every mutation and by a client read; drives abandonment and expiry. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	lastActivityAt?: Date;

	/**
	 * The order this cart became. Written exactly once, by the checkout operation, and only when the
	 * status becomes `COMPLETED`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	orderId?: ID;

	/** The address book row the shipping address came from, kept for traceability. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	shippingAddressId?: ID;

	/** The address book row the billing address came from, kept for traceability. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	billingAddressId?: ID;

	/**
	 * Frozen copy of the shipping address at checkout time, so a later edit of the address book entry
	 * cannot change a cart that has already been priced and taxed.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	shippingAddressSnapshot?: Record<string, unknown>;

	/** Frozen copy of the billing address at checkout time. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	billingAddressSnapshot?: Record<string, unknown>;

	/** A note from the buyer, carried onto the order at placement. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, type: 'text' })
	note?: string;

	/**
	 * B2B exemption override for this cart. It changes nothing about the amounts already recorded; it
	 * decides whether the tax resolver produces tax lines on the next recomputation.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isTaxExempt: boolean;

	/**
	 * Optimistic lock, surfaced to a caller as the `ETag` of the cart it read and required back as an
	 * `If-Match` header by every route that writes the cart. Two concurrent edits therefore cannot
	 * silently overwrite each other: the second writer states the version it read, and a cart that has
	 * moved on since answers a conflict rather than accepting a change based on a value that is gone.
	 *
	 * The increment is applied by `commitVersionedUpdate`, in the same statement that checks the
	 * version — never by an entity listener or by the service after a read, because an increment
	 * applied after a read is exactly the read-then-write window the conditional update closes.
	 */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsInt()
	@VersionedColumn()
	version: number;

	/**
	 * Sum of the lines' net amounts before discount. Net of tax: a tax-inclusive line contributes its
	 * gross minus its own tax.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	itemSubtotal: number;

	/** Sum of the lines' discounts, as a positive magnitude. The ledger rows stay signed. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	itemDiscountTotal: number;

	/** Sum of the lines' tax lines. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	itemTaxTotal: number;

	/** Sum of the shipping methods' net amounts. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	shippingSubtotal: number;

	/** Sum of the shipping methods' discounts, as a positive magnitude. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	shippingDiscountTotal: number;

	/** Sum of the shipping methods' tax lines. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	shippingTaxTotal: number;

	/** `itemDiscountTotal + shippingDiscountTotal`. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	discountTotal: number;

	/** `itemTaxTotal + shippingTaxTotal`. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	taxTotal: number;

	/**
	 * The tax-inclusive amount payable:
	 * `itemSubtotal - discountTotal + taxTotal + shippingSubtotal + shippingTaxTotal`.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	grandTotal: number;

	/** Mirrors the payment collection while a cart is being paid before it completes. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	paidTotal: number;

	/** Refunded against this cart's payment collection. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	refundedTotal: number;

	/**
	 * Open-ended payload: the checkout lock instant and operation id, the merge bookkeeping and the
	 * recovery-email stamp all live here rather than in a column each.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	metadata?: Record<string, unknown>;

	/** Key of this cart in an external system. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	externalId?: string;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** The lines in the cart. A line cannot exist without its cart. */
	@MultiORMOneToMany(() => CommerceCartLine, (it) => it.cart, { onDelete: 'CASCADE' })
	lines?: CommerceCartLine[];

	/** The delivery choices held against the cart. A cart may carry several (a split shipment). */
	@MultiORMOneToMany(() => CommerceCartShippingMethod, (it) => it.cart, { onDelete: 'CASCADE' })
	shippingMethods?: CommerceCartShippingMethod[];

	/** The promotions applied to the cart, as they were applied. */
	@MultiORMOneToMany(() => CommerceCartPromotion, (it) => it.cart, { onDelete: 'CASCADE' })
	promotions?: CommerceCartPromotion[];

	/** The checkout sessions started against this cart. */
	@MultiORMOneToMany(() => CommerceCheckoutSession, (it) => it.cart, { onDelete: 'CASCADE' })
	checkoutSessions?: CommerceCheckoutSession[];
}
