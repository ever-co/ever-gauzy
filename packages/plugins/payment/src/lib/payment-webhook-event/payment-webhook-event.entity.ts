import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { ID } from '@gauzy/contracts';
import { MikroOrmPaymentWebhookEventRepository } from './repository/mikro-orm-payment-webhook-event.repository';
import { IPaymentProvider, IPaymentWebhookEvent, PaymentWebhookEventStatus } from '../payment.types';
import { PaymentProvider } from '../payment-provider/payment-provider.entity';

/**
 * An inbound provider callback, recorded before anything is done with it.
 *
 * **The payload row is written before signature verification and before any state change.** A
 * callback that cannot be verified is still evidence — it is what a dispute is argued with — and a
 * handler defect is only replayable if the bytes that caused it were kept. The row therefore carries
 * the raw body exactly as the provider sent it, the signature header, and the provider's own event
 * id.
 *
 * `(providerId, eventId)` is unique, which is the whole replay guard: a provider that retries a
 * callback it never got an answer for is acknowledged with no side effect the second time.
 *
 * `IGNORED` is not `FAILED`. A validly signed event of a type this build does not handle is recorded
 * as `IGNORED` — there was nothing to do — while `FAILED` means something to fix and is retried;
 * collapsing the two would hide the difference between a provider sending a new event type and our
 * handler being broken.
 */
@MultiORMEntity('payment_webhook_event', { mikroOrmRepository: () => MikroOrmPaymentWebhookEventRepository })
export class PaymentWebhookEvent extends TenantOrganizationBaseEntity implements IPaymentWebhookEvent {
	/**
	 * The provider registration the callback was signed for.
	 */
	@MultiORMManyToOne(() => PaymentProvider, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	provider?: IPaymentProvider;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: PaymentWebhookEvent) => it.provider)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	providerId: ID;

	/**
	 * The provider's event identifier. Unique per provider: this is the replay guard.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 255 })
	eventId: string;

	/**
	 * The provider's event type. Kept as the provider words it, because that is what a handler is
	 * registered against and what an operator searches for.
	 */
	@ApiProperty({ type: () => String, maxLength: 128 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(128)
	@MultiORMColumn({ type: 'varchar', length: 128 })
	type: string;

	/**
	 * The raw body, stored before any parsing.
	 */
	@ApiProperty({ type: () => Object })
	@IsObject()
	@JsonColumn<Record<string, unknown>>()
	payload: Record<string, unknown>;

	/**
	 * The signature header, retained as dispute evidence. A signature is not a secret of ours — it is
	 * the provider's proof over one payload — and it is what makes a disputed callback verifiable
	 * months later.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 512 })
	@IsOptional()
	@IsString()
	@MaxLength(512)
	@MultiORMColumn({ type: 'varchar', length: 512, nullable: true })
	signature?: string;

	/**
	 * When the callback arrived. The retry scan reads this column with the status.
	 */
	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn({ })
	receivedAt: Date;

	/**
	 * When the callback was applied.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	processedAt?: Date;

	/**
	 * Where the callback stands.
	 */
	@ApiProperty({ type: () => String, enum: PaymentWebhookEventStatus })
	@IsEnum(PaymentWebhookEventStatus)
	@MultiORMColumn({ type: 'varchar', length: 16, default: PaymentWebhookEventStatus.RECEIVED })
	status: PaymentWebhookEventStatus;

	/**
	 * Why the last processing attempt failed, for the operator who has to decide whether to replay it.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string;

	/**
	 * How many times processing has been attempted. The retry schedule is read from it.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	attemptCount: number;
}
