import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID, IOrderSummary } from '@gauzy/contracts';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { Order } from '../order/order.entity';
import { MikroOrmOrderSummaryRepository } from './repository/mikro-orm-order-summary.repository';

/**
 * The totals of one order version.
 *
 * This is what makes "what did this order total at version 3, and why?" answerable. The row is
 * **append-only**: one row per committed version, a version is never skipped, and the row whose version
 * equals the order's current version must equal the denormalised columns on the order. The nightly
 * totals audit verifies exactly that and reports a mismatch rather than repairing it.
 */
@MultiORMEntity('order_summary', { mikroOrmRepository: () => MikroOrmOrderSummaryRepository })
export class OrderSummary extends TenantOrganizationBaseEntity implements IOrderSummary {
	/** The order. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	orderId: ID;

	/** The order version this summary describes. Unique per order. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsInt()
	@MultiORMColumn({ type: 'int' })
	version: number;

	/**
	 * The full computed totals object of that version: every stored total plus the adjustment and tax
	 * breakdown it was computed from. Stored whole because the point of the row is to explain a number
	 * that has since been superseded.
	 */
	@ApiProperty({ type: () => Object })
	@IsNotEmpty()
	@JsonColumn({ nullable: false })
	totals: Record<string, unknown>;

	/** The currency the totals are expressed in. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: string;

	/** Who caused this version. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	createdByUserId?: ID;

	/** Why the totals changed: the change action or the source operation. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ nullable: true })
	reason?: string;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** The order. */
	@MultiORMManyToOne(() => Order, (it) => it.summaries, { onDelete: 'CASCADE' })
	@JoinColumn()
	order?: Order;
}
