import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Merchant } from '../merchant.entity';

export class MikroOrmMerchantRepository extends MikroOrmBaseEntityRepository<Merchant> { }
