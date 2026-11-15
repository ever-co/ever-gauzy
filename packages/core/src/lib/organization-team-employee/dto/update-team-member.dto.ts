import { IOrganizationTeamEmployeeUpdateInput } from '@gauzy/contracts';
import { ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
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
	implements IOrganizationTeamEmployeeUpdateInput
{
	@ApiPropertyOptional({
		type: () => Boolean,
		description:
			"The member's time tracking switch in the team as the caller saw it (no value reads as on). When the stored switch differs, the update is refused with 409 TRACKING_SWITCH_CHANGED and writes nothing. Not stored."
	})
	@IsOptional()
	@IsBoolean()
	expectedIsTrackingEnabled?: boolean;
}
