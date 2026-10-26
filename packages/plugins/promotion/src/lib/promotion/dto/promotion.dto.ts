import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { DecimalString } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PromotionStatus, PromotionType } from '../../promotion.types';
import { IsDecimalAmount } from '../../promotion.validators';

/**
 * A promotion: the conditions are rule rows, the effect is the action set, the result is adjustment rows.
 *
 * The shape is the request body of the create and update routes and the response body of every read,
 * so it carries the whole writable surface of the aggregate and nothing the service derives.
 */
export class PromotionDTO extends TenantOrganizationBaseDTO {
	/**
	 * Optional promotional code. A promotion with no code and isAutomatic applies itself.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly code?: string;

	/**
	 * Customer-facing name of the offer.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@MaxLength(255)
	readonly title: string;

	/**
	 * What the offer gives.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description?: string;

	/**
	 * The shape of the offer, which decides the legal action types.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PromotionType })
	@IsOptional()
	@IsEnum(PromotionType)
	readonly type: PromotionType = PromotionType.STANDARD;

	/**
	 * Lifecycle state of the promotion.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PromotionStatus })
	@IsOptional()
	@IsEnum(PromotionStatus)
	readonly status: PromotionStatus = PromotionStatus.DRAFT;

	/**
	 * Applies without a code when its rules match.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isAutomatic: boolean = false;

	/**
	 * When false the promotion closes its stacking group.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isCombinable: boolean = true;

	/**
	 * Group key for the combination policy.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly stackingGroup?: string;

	/**
	 * Ordering weight; lower runs earlier.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly priority: number = 0;

	/**
	 * The campaign whose window and budget bound this promotion.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly campaignId?: string;

	/**
	 * Sales channel the promotion is restricted to; null means all channels.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly channelId?: string;

	/**
	 * Currency the fixed-amount actions are restricted to; null means currency-agnostic.
	 */
	@ApiPropertyOptional({ type: () => String, minLength: 3, maxLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	readonly currency?: string;

	/**
	 * Contact group the promotion is restricted to; null means all customers.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly customerGroupId?: string;

	/**
	 * Start of the promotion window.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly startsAt?: Date;

	/**
	 * End of the promotion window, exclusive.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly endsAt?: Date;

	/**
	 * Global redemption cap; null means unlimited.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly usageLimit?: number;

	/**
	 * Registered redemptions so far.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly usageCount: number = 0;

	/**
	 * Redemption cap per customer; null means unlimited.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly perCustomerUsageLimit?: number;

	/**
	 * Inline budget for a promotion that has no campaign.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsOptional()
	@IsDecimalAmount()
	readonly budgetAmount?: DecimalString;

	/**
	 * Consumption of the inline budget.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsOptional()
	@IsDecimalAmount()
	readonly budgetSpent?: DecimalString;

	/**
	 * Whether the discount is computed on the tax-inclusive amount.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isTaxInclusive: boolean = false;

	/**
	 * Funding mode, revert-on-return policy, badge text and the other open-ended settings.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
