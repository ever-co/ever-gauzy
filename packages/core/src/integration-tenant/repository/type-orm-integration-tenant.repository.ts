import { Repository } from 'typeorm';
import { IntegrationTenant } from '../integration-tenant.entity';

export class TypeOrmIntegrationTenantRepository extends Repository<IntegrationTenant> { }