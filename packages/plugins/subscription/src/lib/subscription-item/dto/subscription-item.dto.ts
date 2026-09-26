import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * A recurring line as a caller sees it.
 *
 * `unitPrice` is a string because the column behind it is an exact decimal. A caller that does not
 * state one gets the price the pricing pipeline resolves for the variant, which is the value a
 * customer price list or a channel override would produce.
 */
export class SubscriptionItemDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly subscriptionId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly variantId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "2.000000".' })
	@IsOptional()
	@IsString()
	readonly quantity?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "19.990000".' })
	@IsOptional()
	@IsString()
	readonly unitPrice?: string;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly position?: number;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
