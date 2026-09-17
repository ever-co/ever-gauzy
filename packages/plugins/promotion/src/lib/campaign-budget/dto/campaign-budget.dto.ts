import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { DecimalString } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { CampaignBudgetType } from '../../promotion.types';
import { IsDecimalAmount } from '../../promotion.validators';

/**
 * The spend or usage ceiling of one campaign. One budget per campaign.
 *
 * The shape is the request body of the create and update routes and the response body of every read,
 * so it carries the whole writable surface of the aggregate and nothing the service derives.
 */
export class CampaignBudgetDTO extends TenantOrganizationBaseDTO {
	/**
	 * The campaign the budget belongs to.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly campaignId: string;

	/**
	 * What the ceiling counts.
	 */
	@ApiPropertyOptional({ type: () => String, enum: CampaignBudgetType })
	@IsOptional()
	@IsEnum(CampaignBudgetType)
	readonly type: CampaignBudgetType = CampaignBudgetType.SPEND;

	/**
	 * The ceiling: money for the SPEND types, a count for the USAGE types.
	 */
	@ApiProperty({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsDecimalAmount()
	readonly limit: DecimalString | number;

	/**
	 * Consumption so far, including reservations. Maintained by the conditional update, never set by hand.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsOptional()
	@IsDecimalAmount()
	readonly used?: DecimalString | number;

	/**
	 * Context attribute path the budget is split by. Required for the *_BY_ATTRIBUTE types.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 128 })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	readonly attribute?: string;

	/**
	 * Currency of the ceiling. Required for the SPEND types.
	 */
	@ApiPropertyOptional({ type: () => String, minLength: 3, maxLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	readonly currency?: string;
}
