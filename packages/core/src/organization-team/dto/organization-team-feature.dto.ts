import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsUUID, ValidateIf } from 'class-validator';
import { ID, IOrganizationTeam, IRelationalOrganizationTeam } from '@gauzy/contracts';
import { OrganizationTeam } from '../organization-team.entity';

export class OrganizationTeamFeatureDTO implements IRelationalOrganizationTeam {
	@ApiPropertyOptional({ type: () => OrganizationTeam })
	@ValidateIf((it) => !it.organizationTeamId || it.organizationTeam)
	@IsObject()
	readonly organizationTeam: IOrganizationTeam;

	@ApiPropertyOptional({ type: () => String })
	@ValidateIf((it) => !it.employee || it.employeeId)
	@IsUUID()
	readonly organizationTeamId: ID;
}
