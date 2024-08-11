import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ID, ILastOrganization } from '@gauzy/contracts';

/**
 * User default team input DTO validation
 */
export class UserLastOrganizationDTO implements ILastOrganization {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly lastOrganizationId?: ID;
}
