import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { Coupon } from '../coupon.entity';

/**
 * MikroORM repository of Coupon. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmCouponRepository extends MikroOrmBaseEntityRepository<Coupon> {}
