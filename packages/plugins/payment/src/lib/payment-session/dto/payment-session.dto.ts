import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsObject, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { DecimalString } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PaymentSessionStatus } from '../../payment.types';
import { IsDecimalAmount } from '../../payment.validators';

/**
 * One attempt at collecting a collection through one provider.
 *
 * The shape is the request body of the create and update routes and the response body of every read,
 * so it carries the whole writable surface of the aggregate and nothing the service derives.
 */
export class PaymentSessionDTO extends TenantOrganizationBaseDTO {
	/**
	 * The collection this attempt belongs to.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly collectionId: string;

	/**
	 * The provider configuration the attempt runs against.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly providerId: string;

	/**
	 * Where the attempt stands.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PaymentSessionStatus })
	@IsOptional()
	@IsEnum(PaymentSessionStatus)
	readonly status: PaymentSessionStatus = PaymentSessionStatus.PENDING;

	/**
	 * The amount this attempt asks for.
	 */
	@ApiProperty({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsDecimalAmount()
	readonly amount: DecimalString | number;

	/**
	 * Currency of the attempt.
	 */
	@ApiProperty({ type: () => String, minLength: 3, maxLength: 3 })
	@IsString()
	@Length(3, 3)
	readonly currency: string;

	/**
	 * The provider session or intent identifier.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly externalId?: string;

	/**
	 * The saved instrument charged off-session; null for a buyer-present attempt.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly paymentMethodTokenId?: string;

	/**
	 * Handed to the caller client-side flow; null on an off-session attempt and never exported.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly clientSecret?: string;

	/**
	 * Provider payload fragment and next-action data.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly data?: Record<string, unknown>;

	/**
	 * Key sent to the provider so a retry cannot open a second session.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly idempotencyKey?: string;

	/**
	 * When the attempt stops being usable.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly expiresAt?: Date;

	/**
	 * When the provider approved the attempt.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly authorizedAt?: Date;

	/**
	 * Supersession marker, decline counters and provider diagnostics.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
