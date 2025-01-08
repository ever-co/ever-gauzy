import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { TenantApiKey } from '../tenant-api-key.entity';

export class MikroOrmTenantApiKeyRepository extends MikroOrmBaseEntityRepository<TenantApiKey> {}
