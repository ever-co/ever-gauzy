import { ID, IOrganizationProjectModuleFindInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

/** Organization Project Module query validation DTO */
export class OrganizationProjectModuleFindInputDTO
	extends TenantOrganizationBaseDTO
	implements IOrganizationProjectModuleFindInput
{
	@ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
	name?: string;

	@ApiProperty({ type: () => String })
	@IsOptional()
	@IsUUID()
	organizationProjectId?: ID;

	@ApiProperty({ type: () => String })
	@IsOptional()
	@IsUUID()
	organizationTeamId?: ID;

	@ApiProperty({ type: () => String })
	@IsOptional()
	@IsUUID()
	organizationSprintId?: ID;
}
