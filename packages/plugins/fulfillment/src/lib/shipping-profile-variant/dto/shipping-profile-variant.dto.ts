import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsUUID } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * The writable surface of the profile-to-variant attachment.
 *
 * A variant belongs to at most one profile: the service looks for an existing attachment and reassigns
 * it rather than inserting a second row, because a variant in two profiles has no defined shipping
 * behaviour.
 */
export class ShippingProfileVariantDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly profileId: string;

	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly variantId: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata: Record<string, unknown>;
}
