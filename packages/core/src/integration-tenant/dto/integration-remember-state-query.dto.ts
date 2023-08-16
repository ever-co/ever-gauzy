import { IntersectionType, PickType } from '@nestjs/swagger';
import { IIntegrationTenant } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { IntegrationTenant } from './../integration-tenant.entity';

export class IntegrationRememberStateQueryDTO extends IntersectionType(
    TenantOrganizationBaseDTO,
    PickType(IntegrationTenant, ['name'])
) implements IIntegrationTenant { }
