import { IntersectionType, OmitType } from '@nestjs/swagger';
import { IOrganizationProjectModuleCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { OrganizationProjectModule } from './../organization-project-module.entity';

/**
 * Create Project Module validation request DTO
 */
export class CreateOrganizationProjectModuleDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		OmitType(OrganizationProjectModule, ['organizationId', 'organization'])
	)
	implements IOrganizationProjectModuleCreateInput {}
