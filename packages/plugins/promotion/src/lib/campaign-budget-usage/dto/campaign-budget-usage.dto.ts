import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DecimalString } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { IsDecimalAmount } from '../../promotion.validators';

/**
 * Consumption of one budget for one value of its attribute. One row per (budget, attribute value).
 *
 * The shape is the request body of the create and update routes and the response body of every read,
 * so it carries the whole writable surface of the aggregate and nothing the service derives.
 */
export class CampaignBudgetUsageDTO extends TenantOrganizationBaseDTO {
	/**
	 * The budget this row consumes.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly budgetId: string;

	/**
	 * The attribute value the row tracks, for example a country code.
	 */
	@ApiProperty({ type: () => String, maxLength: 191 })
	@IsString()
	@MaxLength(191)
	readonly attributeValue: string;

	/**
	 * Consumption for that value.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsOptional()
	@IsDecimalAmount()
	readonly used?: DecimalString;
}
