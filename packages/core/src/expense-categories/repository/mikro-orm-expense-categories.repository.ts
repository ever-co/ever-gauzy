import { EntityRepository } from '@mikro-orm/core';
import { ExpenseCategory } from '../expense-category.entity';

export class MikroOrmExpenseCategoryRepository extends EntityRepository<ExpenseCategory> { }
