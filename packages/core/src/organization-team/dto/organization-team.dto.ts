import { ApiPropertyOptional, IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { IOrganizationProject, IOrganizationTeam } from '@gauzy/contracts';
import { MemberEntityBasedDTO, TenantOrganizationBaseDTO } from './../../core/dto';
import { RelationalTagDTO } from './../../tags/dto';
import { OrganizationTeam } from './../organization-team.entity';
import { OrganizationProject } from '../../organization-project/organization-project.entity';

export class OrganizationTeamDTO
	extends IntersectionType(
		IntersectionType(
			TenantOrganizationBaseDTO,
			IntersectionType(PartialType(RelationalTagDTO), MemberEntityBasedDTO)
		),
		PickType(OrganizationTeam, ['logo', 'prefix', 'imageId', 'shareProfileView', 'requirePlanToTrack'])
	)
	implements Omit<IOrganizationTeam, 'name'>
{
	/**
	 * Team type should be boolean true/false
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly public?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly color?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly emoji?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly teamSize?: string;

	@ApiPropertyOptional({ type: () => OrganizationProject, isArray: true })
	@IsOptional()
	@IsArray()
	readonly projects?: IOrganizationProject[] = [];
}
