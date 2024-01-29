import { EntityRepository } from '@mikro-orm/core';
import { Merchant } from '../merchant.entity';

export class MikroOrmMerchantRepository extends EntityRepository<Merchant> { }