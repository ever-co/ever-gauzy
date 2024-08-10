import { IUserUpdateInput } from '@gauzy/contracts';
import { ApiPropertyOptional, IntersectionType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateUserDTO } from './create-user.dto';
import { UserDefaultOrganizationDTO } from './user-default-organization.dto';
import { UserDefaultTeamDTO } from './user-default-team.dto';
import { UserLastOrganizationDTO } from './user-last-organization.dto';
import { UserLastTeamDTO } from './user-last-team.dto';

/**
 * Update User DTO validation
 */
export class UpdateUserDTO
	extends IntersectionType(
		PartialType(CreateUserDTO),
		UserDefaultOrganizationDTO,
		UserDefaultTeamDTO,
		UserLastOrganizationDTO,
		UserLastTeamDTO
	)
	implements IUserUpdateInput
{
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isActive?: boolean;
}
