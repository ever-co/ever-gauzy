import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID, IOrderCreditLine } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { Order } from '../order/order.entity';
import { MikroOrmOrderCreditLineRepository } from './repository/mikro-orm-order-credit-line.repository';

/**
 * Money owed back to the buyer — the non-cash reduction of the amount due.
 *
 * It is deliberately a third concept beside the other two: a **payment** is money received, a
 * **discount** is a price reduction, and a credit line is neither. An order can be fully settled by
 * credit and still report `NOT_PAID`, because no money moved; `outstandingTotal` reaches zero through
 * `creditTotal` instead.
 *
 * A credit line is never edited after the version it belongs to is applied. A gift-card-funded line
 * always has a matching `gift_card_transaction` of type `REDEEM`.
 */
@MultiORMEntity('order_credit_line', { mikroOrmRepository: () => MikroOrmOrderCreditLineRepository })
export class OrderCreditLine extends TenantOrganizationBaseEntity implements IOrderCreditLine {
	/** The order. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	orderId: ID;

	/** The order version this credit belongs to. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsInt()
	@MultiORMColumn({ type: 'int' })
	version: number;

	/** What granted the credit: a gift card, store credit, a manual decision. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 64 })
	referenceType?: string;

	/** The granting row, such as a gift-card transaction. No constraint, by the polymorphic rule. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	referenceId?: ID;

	/** A positive magnitude: a credit reduces what the customer owes. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	amount: number;

	/** The currency of the credit, which is the order's currency. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: string;

	/** A description shown to the customer. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ nullable: true })
	description?: string;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** The order. */
	@MultiORMManyToOne(() => Order, (it) => it.creditLines, { onDelete: 'CASCADE' })
	@JoinColumn()
	order?: Order;
}
