import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { GiftCard } from '../gift-card.entity';

/**
 * MikroORM repository of GiftCard. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmGiftCardRepository extends MikroOrmBaseEntityRepository<GiftCard> {}
