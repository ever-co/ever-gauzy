import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { OrderClaimReason } from '../../returns.types';

/**
 * One line of a claim as a caller sees it.
 */
export class OrderClaimLineDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly claimId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderLineId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly variantId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	readonly quantity?: string;

	@ApiPropertyOptional({ type: () => String, enum: OrderClaimReason })
	@IsOptional()
	@IsEnum(OrderClaimReason)
	readonly reason?: OrderClaimReason;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	readonly isAdditionalItem?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	readonly note?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	readonly metadata?: Record<string, unknown>;
}
