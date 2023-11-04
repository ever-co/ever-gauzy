import { IIntegrationTenantUpdateInput } from "@gauzy/contracts";
import { IntersectionType, PickType } from "@nestjs/swagger";
import { TenantOrganizationBaseDTO } from "core/dto";
import { IntegrationTenant } from '../integration-tenant.entity';

/**
 * A TypeScript class that appears to represent a DTO (Data Transfer Object) for updating an integration tenant.
 * It combines properties from different types using IntersectionType.
 * Implements the Partial<IIntegrationTenantUpdateInput> interface, indicating that not all properties are required.
 */
export class UpdateIntegrationTenantDTO extends IntersectionType(
    TenantOrganizationBaseDTO, // Extends properties from the 'TenantOrganizationBaseDTO' type.
    PickType(IntegrationTenant, ['isActive', 'isArchived']) // Extends specific properties from the 'IntegrationTenant' type.
) implements Partial<IIntegrationTenantUpdateInput> { }
