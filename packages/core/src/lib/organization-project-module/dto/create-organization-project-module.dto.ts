import { IntersectionType, OmitType } from '@nestjs/swagger';
import { IOrganizationProjectModuleCreateInput } from '@gauzy/contracts';
import { MemberEntityBasedDTO, TenantOrganizationBaseDTO } from './../../core/dto';
import { OrganizationProjectModule } from './../organization-project-module.entity';

/**
 * Create Project Module validation request DTO
 */
export class CreateOrganizationProjectModuleDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		IntersectionType(OmitType(OrganizationProjectModule, ['organizationId', 'organization']), MemberEntityBasedDTO)
	)
	implements IOrganizationProjectModuleCreateInput {}
