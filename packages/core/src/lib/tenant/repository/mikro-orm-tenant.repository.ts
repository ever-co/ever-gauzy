import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Tenant } from '../tenant.entity';

export class MikroOrmTenantRepository extends MikroOrmBaseEntityRepository<Tenant> { }
