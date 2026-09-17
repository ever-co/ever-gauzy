import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PaymentWebhookEvent } from '../payment-webhook-event.entity';

/**
 * MikroORM repository of PaymentWebhookEvent. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmPaymentWebhookEventRepository extends MikroOrmBaseEntityRepository<PaymentWebhookEvent> {}
