import { EntityRepository } from '@mikro-orm/core';
import { Tenant } from '../tenant.entity';

export class MikroOrmTenantRepository extends EntityRepository<Tenant> { }
