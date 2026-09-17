import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DecimalString } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PaymentWebhookEventStatus } from '../payment.types';

/**
 * An inbound provider notification, recorded before anything is parsed so a handler defect can be replayed.
 *
 * The shape is the request body of the create and update routes and the response body of every read,
 * so it carries the whole writable surface of the aggregate and nothing the service derives.
 */
export class PaymentWebhookEventDTO extends TenantOrganizationBaseDTO {
	/**
	 * The provider configuration the callback was signed for.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly providerId: string;

	/**
	 * The provider event identifier. Unique per provider; this is the replay guard.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@MaxLength(255)
	readonly eventId: string;

	/**
	 * Provider event type, for example a session-succeeded event.
	 */
	@ApiProperty({ type: () => String, maxLength: 128 })
	@IsString()
	@MaxLength(128)
	readonly type: string;

	/**
	 * The raw body, stored before parsing.
	 */
	@ApiProperty({ type: () => Object })
	@IsObject()
	readonly payload: Record<string, unknown>;

	/**
	 * The signature header, retained as dispute evidence.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 512 })
	@IsOptional()
	@IsString()
	@MaxLength(512)
	readonly signature?: string;

	/**
	 * When the callback arrived.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly receivedAt?: Date;

	/**
	 * When the callback was applied.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly processedAt?: Date;

	/**
	 * Received, processed, failed or ignored.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PaymentWebhookEventStatus })
	@IsOptional()
	@IsEnum(PaymentWebhookEventStatus)
	readonly status: PaymentWebhookEventStatus = PaymentWebhookEventStatus.RECEIVED;

	/**
	 * Why the last processing attempt failed.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly lastError?: string;

	/**
	 * Processing attempts so far.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly attemptCount: number = 0;
}
