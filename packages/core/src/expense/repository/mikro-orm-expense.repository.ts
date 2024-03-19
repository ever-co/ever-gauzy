import { EntityRepository } from '@mikro-orm/knex';
import { Expense } from '../expense.entity';

export class MikroOrmExpenseRepository extends EntityRepository<Expense> { }
