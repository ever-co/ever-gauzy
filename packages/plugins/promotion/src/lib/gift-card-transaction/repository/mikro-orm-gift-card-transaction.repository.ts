import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { GiftCardTransaction } from '../gift-card-transaction.entity';

/**
 * MikroORM repository of GiftCardTransaction. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmGiftCardTransactionRepository extends MikroOrmBaseEntityRepository<GiftCardTransaction> {}
