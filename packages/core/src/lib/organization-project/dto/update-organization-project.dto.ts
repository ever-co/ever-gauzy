import { IntersectionType, PartialType } from '@nestjs/swagger';
import { IOrganizationProjectUpdateInput } from '@gauzy/contracts';
import { WithoutInitializers } from '@gauzy/common';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { OrganizationProjectDTO } from './organization-project.dto';

/**
 * Update Organization Project DTO request validation
 */
export class UpdateOrganizationProjectDTO
	extends WithoutInitializers(IntersectionType(TenantOrganizationBaseDTO, PartialType(OrganizationProjectDTO)))
	implements IOrganizationProjectUpdateInput {}
