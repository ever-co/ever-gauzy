import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
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
import { MikroOrmPaymentCaptureRepository } from './repository/mikro-orm-payment-capture.repository';
import { IPaymentCapture } from '../payment.types';

/**
 * Money actually taken against an authorisation.
 *
 * **Append-only.** A partial capture is another row, never an edit, and a correction is a refund: the
 * capture happened, and a ledger that can be rewritten cannot be reconciled with the provider's.
 *
 * The row points at the core `payment` table, because a payment is a payment whichever document it
 * settles — this package adds the provider lifecycle around that row rather than a second payment
 * table beside it. Two rules are checked in the transaction that writes this row: the capture may not
 * exceed what is left of the authorisation (`authorizedAmount - canceledAmount`), and the collection
 * the payment belongs to may not be pushed past its own `amount`.
 */
@MultiORMEntity('payment_capture', { mikroOrmRepository: () => MikroOrmPaymentCaptureRepository })
export class PaymentCapture extends TenantOrganizationBaseEntity implements IPaymentCapture {
	/**
	 * The payment row this capture belongs to.
	 */
	@MultiORMManyToOne(() => Payment, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	payment?: Payment;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: PaymentCapture) => it.payment)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	paymentId: ID;

	/**
	 * The amount captured.
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
	 * Currency of the capture, which is the currency of the payment it settles.
	 */
	@ApiProperty({ type: () => String, minLength: 3, maxLength: 3 })
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: string;

	/**
	 * The provider's capture identifier. It is unique among live rows, so a replayed provider
	 * callback cannot write a second capture for one movement.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	externalId?: string;

	/**
	 * When the money was taken.
	 */
	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn({ type: 'timestamptz' })
	capturedAt: Date;

	/**
	 * The provider's diagnostics for this capture: its status code, its reference and anything the
	 * settlement report needs to be matched against.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;
}
