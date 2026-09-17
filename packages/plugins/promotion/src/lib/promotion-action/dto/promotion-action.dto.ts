import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { DecimalString } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PromotionActionAllocation, PromotionActionTargetType, PromotionActionType } from '../../promotion.types';
import { IsDecimalAmount } from '../../promotion.validators';

/**
 * What a promotion does when it matches. Which items it applies to is a rule with scope TARGET.
 *
 * The shape is the request body of the create and update routes and the response body of every read,
 * so it carries the whole writable surface of the aggregate and nothing the service derives.
 */
export class PromotionActionDTO extends TenantOrganizationBaseDTO {
	/**
	 * The promotion that owns this action.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly promotionId: string;

	/**
	 * The kind of benefit.
	 */
	@ApiProperty({ type: () => String, enum: PromotionActionType })
	@IsEnum(PromotionActionType)
	readonly type: PromotionActionType;

	/**
	 * What the benefit lands on.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PromotionActionTargetType })
	@IsOptional()
	@IsEnum(PromotionActionTargetType)
	readonly targetType: PromotionActionTargetType = PromotionActionTargetType.ORDER;

	/**
	 * How the benefit is spread over its targets.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PromotionActionAllocation })
	@IsOptional()
	@IsEnum(PromotionActionAllocation)
	readonly allocation: PromotionActionAllocation = PromotionActionAllocation.ACROSS;

	/**
	 * Amount for FIXED and BUNDLE_PRICE, fraction for PERCENTAGE and TIERED_PERCENTAGE.
	 */
	@ApiProperty({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsDecimalAmount()
	readonly value: DecimalString | number;

	/**
	 * Required for a fixed-amount action.
	 */
	@ApiPropertyOptional({ type: () => String, minLength: 3, maxLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	readonly currency?: string;

	/**
	 * Cap on the quantity the action may discount. Required for an EACH action.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsOptional()
	@IsDecimalAmount()
	readonly maxQuantity?: DecimalString | number;

	/**
	 * Overrides the eligible target quantity before maxQuantity is applied.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsOptional()
	@IsDecimalAmount()
	readonly applyToQuantity?: DecimalString | number;

	/**
	 * The buy quantity that triggers a buy-and-get action.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsOptional()
	@IsDecimalAmount()
	readonly buyRulesMinQuantity?: DecimalString | number;

	/**
	 * Whether the produced adjustment is expressed on the gross basis.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isTaxInclusive: boolean = false;

	/**
	 * Application order inside the promotion.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly position: number = 0;

	/**
	 * Tiers, bundle size, shipping option codes, free variant ids and the discount cap.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
