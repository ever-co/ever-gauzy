import { IOrganizationTeamEmployeeUpdateInput } from '@gauzy/contracts';
import { IntersectionType, PickType } from '@nestjs/swagger';
import { OrganizationTeamEmployee } from './../../core/entities/internal';
import { UpdateOrganizationTeamActiveTaskDTO } from './update-organization-team-active-task.dto';

/**
 * Update team member entity DTO
 */
export class UpdateTeamMemberDTO
	extends IntersectionType(
		UpdateOrganizationTeamActiveTaskDTO,
		PickType(OrganizationTeamEmployee, ['isTrackingEnabled', 'order', 'organizationTeamId'])
	)
	implements IOrganizationTeamEmployeeUpdateInput {}
