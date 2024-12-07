import { IntersectionType, PickType } from '@nestjs/swagger';
import { IIntegrationTenantFindInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { RelationsQueryDTO } from '../../shared/dto';
import { IntegrationTenant } from '../integration-tenant.entity';

export class IntegrationTenantQueryDTO extends IntersectionType(
    IntersectionType(TenantOrganizationBaseDTO, RelationsQueryDTO),
    PickType(IntegrationTenant, ['name'])
) implements IIntegrationTenantFindInput { }
