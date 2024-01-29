import { EntityRepository } from '@mikro-orm/core';
import { Income } from '../income.entity';

export class MikroOrmIncomeRepository extends EntityRepository<Income> { }