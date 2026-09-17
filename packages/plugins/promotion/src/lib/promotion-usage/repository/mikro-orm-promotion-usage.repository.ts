import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PromotionUsage } from '../promotion-usage.entity';

/**
 * MikroORM repository of PromotionUsage. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmPromotionUsageRepository extends MikroOrmBaseEntityRepository<PromotionUsage> {}
