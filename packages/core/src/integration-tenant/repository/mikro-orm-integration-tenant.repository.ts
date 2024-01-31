import { EntityRepository } from '@mikro-orm/core';
import { IntegrationTenant } from '../integration-tenant.entity';

export class MikroOrmIntegrationTenantRepository extends EntityRepository<IntegrationTenant> { }