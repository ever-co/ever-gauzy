import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { DecimalString } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PromotionUsageStatus } from '../../promotion.types';
import { IsDecimalAmount } from '../../promotion.validators';

/**
 * One application of a promotion. The row the usage limits and the budget are checked against.
 *
 * The shape is the request body of the create and update routes and the response body of every read,
 * so it carries the whole writable surface of the aggregate and nothing the service derives.
 */
export class PromotionUsageDTO extends TenantOrganizationBaseDTO {
	/**
	 * The promotion that was applied.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly promotionId: string;

	/**
	 * The coupon the redemption came through, when one did.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly couponId?: string;

	/**
	 * The order the usage was registered against; null while reserved.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderId?: string;

	/**
	 * The cart the usage is reserved for.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly cartId?: string;

	/**
	 * The customer the usage belongs to.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly customerId?: string;

	/**
	 * The code actually presented, snapshotted.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly code?: string;

	/**
	 * The discount granted by this redemption.
	 */
	@ApiProperty({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsDecimalAmount()
	readonly amount: DecimalString | number;

	/**
	 * Currency of the discount.
	 */
	@ApiProperty({ type: () => String, minLength: 3, maxLength: 3 })
	@IsString()
	@Length(3, 3)
	readonly currency: string;

	/**
	 * When the row was created.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly usedAt?: Date;

	/**
	 * Reserved, registered or reverted.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PromotionUsageStatus })
	@IsOptional()
	@IsEnum(PromotionUsageStatus)
	readonly status: PromotionUsageStatus = PromotionUsageStatus.RESERVED;
}
