import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PaymentProvider } from '../payment-provider.entity';

/**
 * MikroORM repository of PaymentProvider. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmPaymentProviderRepository extends MikroOrmBaseEntityRepository<PaymentProvider> {}
