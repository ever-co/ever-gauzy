import { EntityRepository } from '@mikro-orm/knex';
import { Tenant } from '../tenant.entity';

export class MikroOrmTenantRepository extends EntityRepository<Tenant> { }
