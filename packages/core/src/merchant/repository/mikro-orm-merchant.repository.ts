import { EntityRepository } from '@mikro-orm/knex';
import { Merchant } from '../merchant.entity';

export class MikroOrmMerchantRepository extends EntityRepository<Merchant> { }
