import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	Payment,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { DecimalString, ID } from '@gauzy/contracts';
import { MikroOrmRefundRepository } from './repository/mikro-orm-refund.repository';
import { IRefund, IRefundReason, RefundStatus } from '../payment.types';
import { RefundReason } from '../refund-reason/refund-reason.entity';

/**
 * Money given back.
 *
 * **A refund is a new movement, never an edit of the capture it reverses.** The capture happened; the
 * refund is the fact that records it being undone, which is why `Σ SUCCEEDED refunds` of a payment
 * may never exceed `Σ captures` of that payment and why a refund that has reached a terminal status
 * is never re-opened.
 *
 * The order is what a refund is always anchored to. The return, the claim and the payment are the
 * things that explain it, and each of them may be absent — a goodwill refund cites the order and a
 * reason and nothing else — so the three identifiers carry no constraint here: `orderReturn` and
 * `orderClaim` are tables of packages that load after this one, and the constraint belongs to the set
 * that owns the target.
 *
 * The status moves once: `PENDING` becomes `SUCCEEDED`, `FAILED` or `CANCELED`, and a `FAILED` refund
 * leaves no ledger row behind it.
 */
@MultiORMEntity('refund', { mikroOrmRepository: () => MikroOrmRefundRepository })
export class Refund extends TenantOrganizationBaseEntity implements IRefund {
	/**
	 * The order the refund belongs to. Mandatory: a refund that cannot be attributed to an order
	 * cannot be reconciled against one.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid' })
	orderId: ID;

	/**
	 * The payment that is being given back. Optional, because a refund may be distributed across the
	 * captured payments of an order; the service says which one when it knows.
	 */
	@MultiORMManyToOne(() => Payment, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	payment?: Payment;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Refund) => it.payment)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	paymentId?: ID;

	/**
	 * The return that caused this refund, on a return-driven one. A plain identifier: the returns
	 * package loads after this one and owns the constraint.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	returnId?: ID;

	/**
	 * The claim that caused this refund, on a claim-driven one.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	claimId?: ID;

	/**
	 * The amount given back, as a positive magnitude. The direction of the movement is the ledger
	 * row's, not this column's.
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
	 * Currency of the refund.
	 */
	@ApiProperty({ type: () => String, minLength: 3, maxLength: 3 })
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: string;

	/**
	 * The governed reason the refund cites, so refund reporting is groupable.
	 */
	@MultiORMManyToOne(() => RefundReason, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	refundReason?: IRefundReason;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Refund) => it.refundReason)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	reasonId?: ID;

	/**
	 * What the operator wrote, kept beside the governed code rather than instead of it.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	reason?: string;

	/**
	 * Where the refund stands. Terminal once it leaves `PENDING`.
	 */
	@ApiProperty({ type: () => String, enum: RefundStatus })
	@IsEnum(RefundStatus)
	@MultiORMColumn({ type: 'varchar', length: 16, default: RefundStatus.PENDING })
	status: RefundStatus;

	/**
	 * The provider's refund identifier, unique among live rows.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	externalId?: string;

	/**
	 * When the money went back.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	refundedAt?: Date;

	/**
	 * The operator's note: why this refund, at this amount, today.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/**
	 * The exchange reference, the per-line breakdown and the store-credit marker of a refund that was
	 * settled as credit rather than through the provider.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;
}
