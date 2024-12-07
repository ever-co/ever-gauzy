import { IntersectionType, PickType } from '@nestjs/swagger';
import { IOrganizationProjectUpdateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { OrganizationProject } from '../organization-project.entity';

/**
 * Update task list view mode DTO validation
 */
export class UpdateTaskModeDTO
	extends IntersectionType(TenantOrganizationBaseDTO, PickType(OrganizationProject, ['taskListType'] as const))
	implements IOrganizationProjectUpdateInput {}
