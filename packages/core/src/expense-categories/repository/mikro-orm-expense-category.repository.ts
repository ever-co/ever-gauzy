import { EntityRepository } from '@mikro-orm/knex';
import { ExpenseCategory } from '../expense-category.entity';

export class MikroOrmExpenseCategoryRepository extends EntityRepository<ExpenseCategory> { }
