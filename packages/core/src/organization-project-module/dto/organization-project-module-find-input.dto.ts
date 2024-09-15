import { ID, IOrganizationProjectModuleFindInput } from '@gauzy/contracts';
import { ApiPropertyOptional, IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { CreateOrganizationProjectModuleDTO } from './create-organization-project-module.dto';

/** Organization Project Module query validation DTO */
export class OrganizationProjectModuleFindInputDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		PartialType(PickType(CreateOrganizationProjectModuleDTO, ['name', 'projectId'] as const))
	)
	implements IOrganizationProjectModuleFindInput
{
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	organizationTeamId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	organizationSprintId?: ID;
}
