import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PaymentCollection } from '../payment-collection.entity';

/**
 * MikroORM repository of PaymentCollection. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmPaymentCollectionRepository extends MikroOrmBaseEntityRepository<PaymentCollection> {}
