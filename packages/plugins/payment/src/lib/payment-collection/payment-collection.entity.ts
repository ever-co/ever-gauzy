import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { DecimalString, ID } from '@gauzy/contracts';
import { MikroOrmPaymentCollectionRepository } from './repository/mikro-orm-payment-collection.repository';
import { IPaymentCollection, IPaymentSession, PaymentCollectionStatus } from '../payment.types';
import { PaymentSession } from '../payment-session/payment-session.entity';

/**
 * The money side of one order or cart: how much must be collected, how much has been authorised, how
 * much captured and how much returned.
 *
 * **The status is derived, never set.** It follows from the four amounts and the sessions, which is
 * what makes "is this paid?" a question with one answer; the service derives it in the transaction
 * that moves an amount, and the nightly ledger audit re-derives it from the captures and refunds.
 * The invariant the whole domain rests on lives here:
 * `capturedAmount + canceledAmount <= authorizedAmount <= amount` and
 * `refundedAmount <= capturedAmount`.
 *
 * `orderId` and `cartId` are identifiers into tables owned by packages that load after this one, so
 * they carry no constraint at creation; the collection is never hard-deleted while a payment
 * references it, and a cart has at most one live collection.
 */
@MultiORMEntity('payment_collection', { mikroOrmRepository: () => MikroOrmPaymentCollectionRepository })
export class PaymentCollection extends TenantOrganizationBaseEntity implements IPaymentCollection {
	/**
	 * The order being collected for; null while the collection still belongs to a cart.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	orderId?: ID;

	/**
	 * The cart being collected for.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	cartId?: ID;

	/**
	 * The amount to be collected.
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
	 * Currency of the collection. Every amount below is in it.
	 */
	@ApiProperty({ type: () => String, minLength: 3, maxLength: 3 })
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: string;

	/**
	 * Where the collection stands. Derived from the amounts and the sessions by the service.
	 */
	@ApiProperty({ type: () => String, enum: PaymentCollectionStatus })
	@IsEnum(PaymentCollectionStatus)
	@MultiORMColumn({ type: 'varchar', length: 32, default: PaymentCollectionStatus.NOT_PAID })
	status: PaymentCollectionStatus;

	/**
	 * Sum of the successful authorisations. It may not exceed `amount`.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	authorizedAmount: DecimalString;

	/**
	 * Sum of the captures taken against the payments of this collection.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	capturedAmount: DecimalString;

	/**
	 * Sum of the succeeded refunds of the payments of this collection.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	refundedAmount: DecimalString;

	/**
	 * Sum of the authorisations released without a capture.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	canceledAmount: DecimalString;

	/**
	 * The currency this collection is expected to settle in, when it differs from the presentment
	 * currency. Written with the first session and read by the reconciliation, so a collection and
	 * its payments cannot disagree about the currency they settled in.
	 */
	@ApiPropertyOptional({ type: () => String, minLength: 3, maxLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3, nullable: true })
	settlementCurrency?: string;

	/**
	 * The expected settled amount, in `settlementCurrency`. The payments under the collection carry
	 * what each of them actually settled, and their sum is reconciled against this figure.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	settlementAmount?: DecimalString;

	/**
	 * The expected rate: one unit of `currency` is this many units of `settlementCurrency`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 10,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	fxRate?: DecimalString;

	/**
	 * The exchange-rate row the rate was read from, when it came from one. A snapshot reference with
	 * no foreign key: a rate row reaching its retention date must never block or rewrite what was
	 * expected here.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	fxRateId?: ID;

	/**
	 * The instant the expected rate was taken.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	fxCapturedAt?: Date;

	/**
	 * When the collection reached a settled state.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	completedAt?: Date;

	/**
	 * Capture mode, the split plan of a multi-provider collection and the purpose marker of a
	 * zero-amount verification collection.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/**
	 * Every attempt made against this collection, superseded ones included: the history of what the
	 * buyer tried is what makes a failed payment diagnosable.
	 */
	@MultiORMOneToMany(() => PaymentSession, (session) => session.collection)
	sessions?: IPaymentSession[];
}
