import { DecimalAmount } from '../shared/is-decimal-amount.validator';
import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ICommerceCartShippingMethod, ID } from '@gauzy/contracts';
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
import { MikroOrmCommerceCartShippingMethodRepository } from './repository/mikro-orm-commerce-cart-shipping-method.repository';

/**
 * A delivery choice held against a cart.
 *
 * A cart may carry several of these — a split shipment is one delivery per warehouse — and the sum of
 * their amounts is the cart's `shippingSubtotal`. The row is a snapshot of the option as it was
 * priced, so deactivating or repricing the option does not change a cart that has already been
 * quoted.
 */
@MultiORMEntity('commerce_cart_shipping_method', {
	mikroOrmRepository: () => MikroOrmCommerceCartShippingMethodRepository
})
export class CommerceCartShippingMethod
	extends TenantOrganizationBaseEntity
	implements ICommerceCartShippingMethod
{
	/** The cart this delivery choice belongs to. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	cartId: ID;

	/**
	 * The configured option this delivery choice came from. Null for a manually priced method.
	 * The constraint is added by the fulfilment package, which creates the option it points at.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	shippingOptionId?: ID;

	/** Snapshot of the option's name. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn()
	name: string;

	/** The computed price of the method, rounded at the shipping-subtotal boundary. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	amount: DecimalAmount;

	/** Whether `amount` is a gross. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isTaxInclusive: boolean;

	/**
	 * The calculator's input and its result, retained for audit and for the call the carrier adapter
	 * makes at label time.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	data?: Record<string, unknown>;

	/** Set when an operator overrode the computed price. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isManual: boolean;

	/** The tax class the delivery is taxed under. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	taxCategoryId?: ID;

	/** Display order. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 0 })
	position: number;

	/** Open-ended payload for the calculator's annotations. */
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
	@MultiORMManyToOne(() => CommerceCart, (it) => it.shippingMethods, { onDelete: 'CASCADE' })
	@JoinColumn()
	cart?: CommerceCart;
}
