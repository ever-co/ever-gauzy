import { EntityRepository } from '@mikro-orm/knex';
import { Deal } from '../deal.entity';

export class MikroOrmDealRepository extends EntityRepository<Deal> { }
