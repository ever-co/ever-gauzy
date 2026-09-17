import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { DecimalString } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { CampaignStatus } from '../promotion.types';

/**
 * A campaign: the window and the budget that a group of promotions runs inside.
 *
 * The shape is the request body of the create and update routes and the response body of every read,
 * so it carries the whole writable surface of the aggregate and nothing the service derives.
 */
export class CampaignDTO extends TenantOrganizationBaseDTO {
	/**
	 * Stable handle used by imports and by every external caller. Unique per organization.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsString()
	@MaxLength(64)
	readonly identifier: string;

	/**
	 * Operator-facing label.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@MaxLength(255)
	readonly name: string;

	/**
	 * What the campaign is for.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description?: string;

	/**
	 * Lifecycle state of the campaign.
	 */
	@ApiPropertyOptional({ type: () => String, enum: CampaignStatus })
	@IsOptional()
	@IsEnum(CampaignStatus)
	readonly status: CampaignStatus = CampaignStatus.DRAFT;

	/**
	 * Start of the campaign window; null means already open.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly startsAt?: Date;

	/**
	 * End of the campaign window, exclusive; null means it never closes.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly endsAt?: Date;

	/**
	 * Owner, cost centre and free-form notes for the campaign.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
