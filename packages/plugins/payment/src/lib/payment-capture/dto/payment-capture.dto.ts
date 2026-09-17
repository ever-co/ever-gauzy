import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsObject, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { DecimalString } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { IsDecimalAmount } from '../../payment.validators';

/**
 * Money actually taken against an authorisation. Append-only: partial captures are several rows.
 *
 * The shape is the request body of the create and update routes and the response body of every read,
 * so it carries the whole writable surface of the aggregate and nothing the service derives.
 */
export class PaymentCaptureDTO extends TenantOrganizationBaseDTO {
	/**
	 * The payment row this capture belongs to.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly paymentId: string;

	/**
	 * The amount captured.
	 */
	@ApiProperty({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsDecimalAmount()
	readonly amount: DecimalString;

	/**
	 * Currency of the capture.
	 */
	@ApiProperty({ type: () => String, minLength: 3, maxLength: 3 })
	@IsString()
	@Length(3, 3)
	readonly currency: string;

	/**
	 * The provider capture identifier.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly externalId?: string;

	/**
	 * When the money was taken.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly capturedAt?: Date;

	/**
	 * Provider diagnostics for this capture.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
