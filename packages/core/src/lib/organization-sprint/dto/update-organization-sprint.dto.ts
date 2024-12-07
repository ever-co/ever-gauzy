import { IntersectionType, PartialType } from '@nestjs/swagger';
import { IOrganizationSprintUpdateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { OrganizationSprintDTO } from './organization-sprint.dto';

/**
 * Update Organization Project DTO request validation
 */
export class UpdateOrganizationSprintDTO
	extends IntersectionType(TenantOrganizationBaseDTO, PartialType(OrganizationSprintDTO))
	implements IOrganizationSprintUpdateInput {}
