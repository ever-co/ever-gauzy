import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

export class CreateZapierIntegrationDto extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	override organizationId!: string;
}
