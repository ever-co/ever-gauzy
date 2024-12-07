import { IntersectionType, PickType } from '@nestjs/swagger';
import { IOrganizationTeamEmployeeUpdateInput } from '@gauzy/contracts';
import { OrganizationTeamEmployee } from '../../core/entities/internal';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * Update team member active task entity DTO
 */
export class UpdateOrganizationTeamActiveTaskDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		PickType(OrganizationTeamEmployee, ['activeTaskId', 'organizationTeamId'])
	)
	implements IOrganizationTeamEmployeeUpdateInput {}
