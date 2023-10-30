import { IntersectionType, PickType } from '@nestjs/swagger';
import { IIntegrationTenantFindInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { IntegrationTenant } from '../integration-tenant.entity';

export class IntegrationTenantQueryDTO extends IntersectionType(
    TenantOrganizationBaseDTO,
    PickType(IntegrationTenant, ['name'])
) implements IIntegrationTenantFindInput { }
