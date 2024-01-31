import { EntityRepository } from '@mikro-orm/core';
import { Deal } from '../deal.entity';

export class MikroOrmDealRepository extends EntityRepository<Deal> { }