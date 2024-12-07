import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Deal } from '../deal.entity';

export class MikroOrmDealRepository extends MikroOrmBaseEntityRepository<Deal> { }
