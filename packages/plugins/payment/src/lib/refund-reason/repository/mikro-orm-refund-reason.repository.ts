import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { RefundReason } from '../refund-reason.entity';

/**
 * MikroORM repository of RefundReason. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmRefundReasonRepository extends MikroOrmBaseEntityRepository<RefundReason> {}
