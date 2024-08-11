import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ID, IDefaultUserOrganization } from '@gauzy/contracts';

/**
 * User default organization input DTO validation
 */
export class UserDefaultOrganizationDTO implements IDefaultUserOrganization {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly defaultOrganizationId?: ID;
}
