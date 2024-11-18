import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';
import { ID, IMemberEntityBased } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './tenant-organization-base.dto';

export class MemberEntityBasedDTO extends TenantOrganizationBaseDTO implements IMemberEntityBased {
	/**
	 * Array of member UUIDs.
	 */
	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	memberIds?: ID[] = [];

	/**
	 * Array of manager UUIDs.
	 */
	@ApiPropertyOptional({ type: Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	managerIds?: ID[] = [];
}
