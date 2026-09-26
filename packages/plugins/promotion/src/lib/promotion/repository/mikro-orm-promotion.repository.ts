import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { Promotion } from '../promotion.entity';

/**
 * MikroORM repository of Promotion. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmPromotionRepository extends MikroOrmBaseEntityRepository<Promotion> {}
