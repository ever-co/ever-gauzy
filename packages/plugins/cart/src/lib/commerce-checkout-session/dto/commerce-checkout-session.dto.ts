import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CommerceCheckoutSessionStatus } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * The writable surface of a checkout session.
 *
 * `completedSteps` is append-only through the service: a caller states the step it is completing, not
 * the whole path, so a resumed session can always be explained.
 */
export class CommerceCheckoutSessionDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly cartId: string;

	@ApiPropertyOptional({ type: () => String, enum: CommerceCheckoutSessionStatus })
	@IsOptional()
	@IsEnum(CommerceCheckoutSessionStatus)
	readonly status: CommerceCheckoutSessionStatus;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly step: string;

	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	readonly completedSteps: string[];

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly data: Record<string, unknown>;
}
