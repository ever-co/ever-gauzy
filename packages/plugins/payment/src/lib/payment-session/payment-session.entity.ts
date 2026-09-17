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
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { DecimalString, ID } from '@gauzy/contracts';
import { MikroOrmPaymentSessionRepository } from './repository/mikro-orm-payment-session.repository';
import { IPaymentCollection, IPaymentProvider, IPaymentSession, PaymentSessionStatus } from '../payment.types';
import { PaymentCollection } from '../payment-collection/payment-collection.entity';
import { PaymentProvider } from '../payment-provider/payment-provider.entity';

/**
 * One attempt at collecting a collection, through one provider.
 *
 * **One active attempt per `(collection, provider)`, history retained.** A superseded attempt is kept
 * with `status = CANCELED` and `metadata.supersededBy`, because "the buyer tried three times and the
 * second one was declined" is the fact an operator needs; the closed statuses are excluded from the
 * rule, so a second live attempt is impossible while the previous ones stay queryable.
 *
 * **An off-session attempt is a different shape of the same row.** When `paymentMethodTokenId` is
 * set, the charged instrument is one the provider already holds, so `clientSecret` stays null — there
 * is no client to hand a secret to — and the attempt can never enter `REQUIRES_MORE`, because there
 * is nobody to perform a next action; a provider that answers with one is recorded as a decline.
 *
 * A terminal attempt is never re-opened: a retry is a new row with its own idempotency key.
 */
@MultiORMEntity('payment_session', { mikroOrmRepository: () => MikroOrmPaymentSessionRepository })
export class PaymentSession extends TenantOrganizationBaseEntity implements IPaymentSession {
	/**
	 * The collection this attempt is made against.
	 */
	@MultiORMManyToOne(() => PaymentCollection, (collection) => collection.sessions, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	collection?: IPaymentCollection;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: PaymentSession) => it.collection)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	collectionId: ID;

	/**
	 * The provider registration the attempt runs against.
	 */
	@MultiORMManyToOne(() => PaymentProvider, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	provider?: IPaymentProvider;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: PaymentSession) => it.provider)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	providerId: ID;

	/**
	 * Where the attempt stands. `CANCELED`, `ERROR` and `EXPIRED` are exactly the statuses that free
	 * the `(collection, provider)` pair for another attempt.
	 */
	@ApiProperty({ type: () => String, enum: PaymentSessionStatus })
	@IsEnum(PaymentSessionStatus)
	@MultiORMColumn({ type: 'varchar', length: 32, default: PaymentSessionStatus.PENDING })
	status: PaymentSessionStatus;

	/**
	 * The amount this attempt asks for, in `currency`.
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
	 * Currency of the attempt.
	 */
	@ApiProperty({ type: () => String, minLength: 3, maxLength: 3 })
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: string;

	/**
	 * The provider's own session or intent identifier. It is the lookup key for a callback that
	 * arrives without our session id, so it is indexed.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	externalId?: string;

	/**
	 * The saved instrument this attempt charges, when it was created off-session instead of from a
	 * fresh handshake with the buyer.
	 *
	 * A plain identifier rather than a relation property: the target is the core
	 * `payment_method_token` table, which this package reads through the session column and never
	 * owns, and the foreign key is created inline by this package's migration because the table it
	 * points at exists before this set runs.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	paymentMethodTokenId?: ID;

	/**
	 * The secret the caller's client-side flow uses with the provider's own browser library.
	 *
	 * Null on an off-session attempt, which has no client to hand it to, and excluded from every
	 * export and admin projection: it is a bearer value for the duration of one payment.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	clientSecret?: string;

	/**
	 * The provider's payload fragment and the next-action data the caller's client needs.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	data?: Record<string, unknown>;

	/**
	 * The key sent to the provider with this attempt, so a retry of the same logical payment does not
	 * open a second session at the provider.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	idempotencyKey?: string;

	/**
	 * When the attempt stops being usable. The expiry sweep reads exactly this column.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	expiresAt?: Date;

	/**
	 * When the provider approved the attempt.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	authorizedAt?: Date;

	/**
	 * The supersession marker, the decline bookkeeping the instrument cache reads, and the provider's
	 * diagnostics for this attempt.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;
}
