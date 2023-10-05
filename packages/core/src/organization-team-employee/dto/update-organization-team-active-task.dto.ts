import { IOrganizationTeamEmployeeUpdateInput } from '@gauzy/contracts';
import { IntersectionType, PickType } from '@nestjs/swagger';
import { OrganizationTeamEmployee } from '../../core/entities/internal';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * Update team member entity DTO
 */
export class UpdateOrganizationTeamActiveTaskDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		PickType(OrganizationTeamEmployee, [
			'activeTaskId',
		])
	)
	implements IOrganizationTeamEmployeeUpdateInput { }
