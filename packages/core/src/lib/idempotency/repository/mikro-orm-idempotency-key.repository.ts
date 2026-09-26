import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { IdempotencyKey } from '../idempotency-key.entity';

export class MikroOrmIdempotencyKeyRepository extends MikroOrmBaseEntityRepository<IdempotencyKey> {}
