import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DecimalString } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * A redeemable code belonging to a promotion, with its own usage limits and window.
 *
 * The shape is the request body of the create and update routes and the response body of every read,
 * so it carries the whole writable surface of the aggregate and nothing the service derives.
 */
export class CouponDTO extends TenantOrganizationBaseDTO {
	/**
	 * The code the customer types, stored upper-cased.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsString()
	@MaxLength(64)
	readonly code: string;

	/**
	 * The promotion a redemption grants; null means the code is not attached yet.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly promotionId?: string;

	/**
	 * Groups the coupons produced by one mailing.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly batchId?: string;

	/**
	 * Per-code cap; null inherits the promotion limit.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly usageLimit?: number;

	/**
	 * Redemptions so far, including reservations.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly usageCount: number = 0;

	/**
	 * Per-code, per-customer cap.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly perCustomerLimit?: number;

	/**
	 * Start of the code window.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly startsAt?: Date;

	/**
	 * End of the code window, exclusive.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly endsAt?: Date;

	/**
	 * Issued-to, mailing and single-use markers.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
