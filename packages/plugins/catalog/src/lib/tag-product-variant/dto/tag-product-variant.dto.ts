import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * Variant facet request DTO validation.
 */
export class TagProductVariantDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly productVariantId: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly tagId: string;
}
