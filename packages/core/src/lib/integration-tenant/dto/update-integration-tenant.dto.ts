import { IIntegrationTenantUpdateInput } from '@gauzy/contracts';
import { IntersectionType, PickType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { IntegrationTenant } from '../integration-tenant.entity';

/**
 * Represent a DTO (Data Transfer Object) for updating an integration tenant.
 */
export class UpdateIntegrationTenantDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO, // Extends properties from the 'TenantOrganizationBaseDTO' type.
		PickType(IntegrationTenant, ['isActive', 'isArchived']) // Extends specific properties from the 'IntegrationTenant' type.
	)
	implements Partial<IIntegrationTenantUpdateInput> {}
