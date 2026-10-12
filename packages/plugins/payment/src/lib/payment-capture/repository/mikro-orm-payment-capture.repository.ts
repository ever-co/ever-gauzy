import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PaymentCapture } from '../payment-capture.entity';

/**
 * MikroORM repository of PaymentCapture. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmPaymentCaptureRepository extends MikroOrmBaseEntityRepository<PaymentCapture> {}
