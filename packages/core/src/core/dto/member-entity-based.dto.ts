import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional } from 'class-validator';
import { ID, IMemberEntityBased } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './tenant-organization-base.dto';

export class MemberEntityBasedDTO extends TenantOrganizationBaseDTO implements IMemberEntityBased {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsArray()
	memberIds?: ID[] = [];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsArray()
	managerIds?: ID[] = [];
}
