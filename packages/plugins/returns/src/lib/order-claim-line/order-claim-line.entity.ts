import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { DecimalString, ID, IProductVariant } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	ProductVariant,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { IOrderClaim, IOrderClaimLine, OrderClaimReason } from '../returns.types';
import { OrderClaim } from '../order-claim/order-claim.entity';
import { MikroOrmOrderClaimLineRepository } from './repository/mikro-orm-order-claim-line.repository';

/**
 * One line of a claim.
 *
 * A claim line is not a return line with a different parent: it may name an order line (something
 * that was on the order) or a variant on its own (a replacement part the customer never ordered),
 * and the two are told apart by `isAdditionalItem` because only the first has a ceiling on the order.
 * There is deliberately no uniqueness constraint on `(claim, order line)`: one damaged unit and one
 * missing unit of the same line are two lines with two reasons, and collapsing them would lose the
 * distinction the resolution depends on.
 */
@MultiORMEntity('order_claim_line', { mikroOrmRepository: () => MikroOrmOrderClaimLineRepository })
export class OrderClaimLine extends TenantOrganizationBaseEntity implements IOrderClaimLine {
	/**
	 * The order line the claim is about. Null for an additional item that was never on the order.
	 *
	 * Declared as a plain relation id: the order line belongs to the order domain. This plugin's
	 * migration creates the foreign key.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	orderLineId?: ID;

	/**
	 * Claimed quantity.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	quantity: DecimalString;

	/**
	 * Why this line is being claimed. The value selects the resolution path, which is why it is an
	 * enum rather than a row in the reason table.
	 */
	@ApiProperty({ type: () => String, enum: OrderClaimReason })
	@IsEnum(OrderClaimReason)
	@MultiORMColumn({ type: 'varchar', length: 32, default: OrderClaimReason.OTHER })
	reason: OrderClaimReason;

	/**
	 * True when the line adds an item the customer never ordered — a replacement part rather than a
	 * return of what was delivered. A line like this has no order line to be measured against.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isAdditionalItem: boolean;

	/**
	 * Operator note. Required by the service when the reason is `OTHER`, because "anything not
	 * covered" is only actionable once somebody writes down what it was.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/**
	 * Open-ended extras kept beside the line.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The claim this line belongs to.
	 */
	@ApiProperty({ type: () => OrderClaim })
	@IsNotEmpty()
	@MultiORMManyToOne(() => OrderClaim, (it) => it.lines, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	claim?: IOrderClaim;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrderClaimLine) => it.claim)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	claimId?: ID;

	/**
	 * The replacement variant, when the claim names one.
	 */
	@ApiPropertyOptional({ type: () => ProductVariant })
	@IsOptional()
	@MultiORMManyToOne(() => ProductVariant, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	variant?: IProductVariant;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrderClaimLine) => it.variant)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	variantId?: ID;
}
