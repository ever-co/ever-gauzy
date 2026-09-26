import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { DecimalString, ID } from '@gauzy/contracts';
import { MikroOrmRefundLineRepository } from './repository/mikro-orm-refund-line.repository';
import { IRefund, IRefundLine } from '../payment.types';
import { Refund } from '../refund/refund.entity';

/**
 * Which lines a refund paid back, as rows.
 *
 * **This is money, not goods.** The table deliberately does not fold into the return lines: a return
 * records what was requested, what arrived, what came back damaged and where it was restocked, while
 * this row records what was given back in the order currency. The two differ in both directions — a
 * goodwill refund has no return at all, and goods can be received back and settled as store credit
 * without money moving — so a refund that had to invent a return in order to say which line it
 * explains would be the worst kind of duplicate.
 *
 * A row is a **magnitude**, never a sign: both `quantity` and `amount` are positive, and the
 * direction of the movement is the ledger row's. Written with the refund it belongs to, in the same
 * transaction, and never after that refund settles: what a settled refund paid back is a fact about
 * money that has already moved. One row per `(refund, order line)` among live rows, which is what the
 * unique index on the table states.
 */
@MultiORMEntity('refund_line', { mikroOrmRepository: () => MikroOrmRefundLineRepository })
export class RefundLine extends TenantOrganizationBaseEntity implements IRefundLine {
	/**
	 * The refund this line is part of. A line has no meaning without its refund, so the row travels
	 * with it.
	 */
	@MultiORMManyToOne(() => Refund, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	refund?: IRefund;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: RefundLine) => it.refund)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	refundId: ID;

	/**
	 * The order line the money is attributed to.
	 *
	 * A plain identifier rather than a relation property: the order aggregate is a peer package whose
	 * table this one reads through the order line's own key, exactly as `refund.returnId` and
	 * `refund.claimId` name the returns capability. The service refuses a write whose order line does
	 * not resolve inside the caller's organization, and the constraint on the column belongs to the
	 * migration that creates it.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid' })
	orderLineId: ID;

	/**
	 * How much of the line came back, in the order line's unit. A positive magnitude, and a quantity
	 * rather than a count: a variant may be sold by weight, length or duration.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		transformer: new ColumnNumericTransformerPipe()
	})
	quantity: DecimalString;

	/**
	 * What was given back for that line, in the order currency. A positive magnitude, of which the
	 * refund's own amount is the ceiling.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		transformer: new ColumnNumericTransformerPipe()
	})
	amount: DecimalString;

	/**
	 * Currency of the amount, which is the refund's currency: a line cannot be given back in a
	 * currency the refund is not in.
	 */
	@ApiProperty({ type: () => String, minLength: 3, maxLength: 3 })
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: string;

	/**
	 * Tenant extras: the store-credit marker, the exchange reference and whatever the operator
	 * recorded about this line.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;
}
