import { EntityRepository } from '@mikro-orm/knex';
import { IntegrationTenant } from '../integration-tenant.entity';

export class MikroOrmIntegrationTenantRepository extends EntityRepository<IntegrationTenant> { }
