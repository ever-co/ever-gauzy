import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { IntegrationTenant } from '../integration-tenant.entity';

export class MikroOrmIntegrationTenantRepository extends MikroOrmBaseEntityRepository<IntegrationTenant> { }
