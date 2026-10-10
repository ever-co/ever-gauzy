import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID, IOrderShippingMethod } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { Order } from '../order/order.entity';
import { MikroOrmOrderShippingMethodRepository } from './repository/mikro-orm-order-shipping-method.repository';

/**
 * A delivery choice frozen on an order.
 *
 * The name and the amount are snapshots: the shipping option may be deactivated or repriced
 * afterwards, and the amount the buyer paid must stand. Several rows are legitimate — a split shipment
 * is one delivery per warehouse — and their sum is the order's `shippingSubtotal`.
 */
@MultiORMEntity('order_shipping_method', {
	mikroOrmRepository: () => MikroOrmOrderShippingMethodRepository
})
export class OrderShippingMethod extends TenantOrganizationBaseEntity implements IOrderShippingMethod {
	/** The order. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	orderId: ID;

	/**
	 * The configured option this delivery came from. Null for a manually priced shipment, which is why
	 * the row survives deletion of the option. The constraint is added by the fulfilment package, which
	 * creates the option it points at.
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

	/** What the buyer paid for this delivery. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	amount: number;

	/** Whether `amount` is a gross. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isTaxInclusive: boolean;

	/** The tax class the delivery was taxed under. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	taxCategoryId?: ID;

	/** The calculator's input and its result, retained so a disputed delivery can be explained. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	data?: Record<string, unknown>;

	/** Display order. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 0 })
	position: number;

	/** Open-ended payload for the carrier's annotations. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** The order. */
	@MultiORMManyToOne(() => Order, (it) => it.shippingMethods, { onDelete: 'CASCADE' })
	@JoinColumn()
	order?: Order;
}
