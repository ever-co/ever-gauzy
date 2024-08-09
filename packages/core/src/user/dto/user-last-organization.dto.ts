import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ILastOrganization } from '@gauzy/contracts';

/**
 * User default team input DTO validation
 */
export class UserLastOrganizationDTO implements ILastOrganization {
	@ApiProperty({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly lastOrganizationId?: string;
}
