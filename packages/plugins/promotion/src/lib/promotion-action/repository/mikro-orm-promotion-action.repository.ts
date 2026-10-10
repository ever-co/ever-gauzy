import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PromotionAction } from '../promotion-action.entity';

/**
 * MikroORM repository of PromotionAction. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmPromotionActionRepository extends MikroOrmBaseEntityRepository<PromotionAction> {}
