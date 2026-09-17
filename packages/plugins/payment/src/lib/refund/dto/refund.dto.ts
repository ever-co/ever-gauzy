import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsDate,
	IsEnum,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	MaxLength,
	ValidateNested
} from 'class-validator';
import { DecimalString } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { RefundStatus } from '../../payment.types';
import { IsDecimalAmount } from '../../payment.validators';
import { RefundLineDTO } from '../../refund-line/dto/refund-line.dto';

/**
 * Money given back. A refund can never exceed what was captured for its payment.
 *
 * The shape is the request body of the create and update routes and the response body of every read,
 * so it carries the whole writable surface of the aggregate and nothing the service derives.
 */
export class RefundDTO extends TenantOrganizationBaseDTO {
	/**
	 * The order the refund belongs to.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly orderId: string;

	/**
	 * The payment refunded; null when the refund is distributed over the captured payments.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly paymentId?: string;

	/**
	 * The return that caused the refund, on a return-driven refund.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly returnId?: string;

	/**
	 * The claim that caused the refund, on a claim-driven refund.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly claimId?: string;

	/**
	 * Positive magnitude of the amount refunded.
	 */
	@ApiProperty({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsDecimalAmount()
	readonly amount: DecimalString | number;

	/**
	 * Currency of the refund.
	 */
	@ApiProperty({ type: () => String, minLength: 3, maxLength: 3 })
	@IsString()
	@Length(3, 3)
	readonly currency: string;

	/**
	 * The governed reason code the refund cites.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly reasonId?: string;

	/**
	 * Free-text reason, kept beside the governed code.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly reason?: string;

	/**
	 * Pending, succeeded, failed or canceled.
	 */
	@ApiPropertyOptional({ type: () => String, enum: RefundStatus })
	@IsOptional()
	@IsEnum(RefundStatus)
	readonly status: RefundStatus = RefundStatus.PENDING;

	/**
	 * The provider refund identifier.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly externalId?: string;

	/**
	 * When the money went back.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly refundedAt?: Date;

	/**
	 * Operator note carried on the refund.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;

	/**
	 * Exchange reference, per-line refund breakdown and the store-credit marker.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;

	/**
	 * The lines the refund paid back, when the caller knows them.
	 *
	 * Each entry is written as a `refund_line` row in the same transaction as the refund, so a refund
	 * is never stored without the breakdown it was asked for, and their amounts may not sum to more
	 * than the refund's own. The lines are maintained afterwards through the refund-line routes.
	 */
	@ApiPropertyOptional({ type: () => [RefundLineDTO] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => RefundLineDTO)
	readonly lines?: RefundLineDTO[];
}
