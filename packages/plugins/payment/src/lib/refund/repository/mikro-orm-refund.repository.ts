import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { Refund } from '../refund.entity';

/**
 * MikroORM repository of Refund. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmRefundRepository extends MikroOrmBaseEntityRepository<Refund> {}
