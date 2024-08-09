import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { IDefaultUserOrganization } from '@gauzy/contracts';

/**
 * User default organization input DTO validation
 */
export class UserDefaultOrganizationDTO implements IDefaultUserOrganization {
	@ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
	readonly defaultOrganizationId?: string;
}
