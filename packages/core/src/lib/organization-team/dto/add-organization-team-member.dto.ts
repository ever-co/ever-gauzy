import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * The body of `POST /organization-team/:id/members`: one employee to add to the team.
 *
 * The organization is checked against the caller's memberships; the team is the path segment. Leaving
 * `isManager` out keeps an existing member's role, and a new member joins as a member.
 */
export class AddOrganizationTeamMemberDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String, format: 'uuid' })
	@IsUUID()
	readonly employeeId: ID;

	@ApiPropertyOptional({ type: () => Boolean, description: 'Whether the employee manages the team.' })
	@IsOptional()
	@IsBoolean()
	readonly isManager?: boolean;
}
