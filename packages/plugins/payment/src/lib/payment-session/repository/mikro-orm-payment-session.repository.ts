import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PaymentSession } from '../payment-session.entity';

/**
 * MikroORM repository of PaymentSession. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmPaymentSessionRepository extends MikroOrmBaseEntityRepository<PaymentSession> {}
