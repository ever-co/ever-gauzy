import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * The writable surface of a shipping profile.
 *
 * `isDefault` is on the surface because an operator sets the default deliberately; the service refuses a
 * second default for the same organization rather than letting the two disagree about which one applies.
 */
export class ShippingProfileDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(255)
	readonly name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(64)
	readonly code: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isDefault: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata: Record<string, unknown>;
}
