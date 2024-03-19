import { EntityRepository } from '@mikro-orm/knex';
import { Income } from '../income.entity';

export class MikroOrmIncomeRepository extends EntityRepository<Income> { }
