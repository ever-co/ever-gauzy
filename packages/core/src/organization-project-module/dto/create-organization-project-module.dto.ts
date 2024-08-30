import { IntersectionType, OmitType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { OrganizationProjectModule } from './../organization-project-module.entity';
import { IOrganizationProjectModuleCreateInput } from '@gauzy/contracts';

/**
 * Create Project Module validation request DTO
 */
export class CreateOrganizationProjectModuleDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		OmitType(OrganizationProjectModule, ['organizationId', 'organization'])
	)
	implements IOrganizationProjectModuleCreateInput {}
