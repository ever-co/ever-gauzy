import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { RefundLine } from '../refund-line.entity';

/**
 * MikroORM repository of RefundLine. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmRefundLineRepository extends MikroOrmBaseEntityRepository<RefundLine> {}
