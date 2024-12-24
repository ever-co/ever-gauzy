import { IntersectionType, PickType } from '@nestjs/swagger';
import { IOrganizationTeamEmployeeFindInput } from '@gauzy/contracts';
import { DeleteQueryDTO } from './../../shared/dto';
import { OrganizationTeamEmployee } from './../../core/entities/internal';

/**
 * Delete team member query DTO
 */
export class DeleteTeamMemberQueryDTO
	extends IntersectionType(DeleteQueryDTO, PickType(OrganizationTeamEmployee, ['organizationTeamId']))
	implements IOrganizationTeamEmployeeFindInput {}
