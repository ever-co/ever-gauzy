import { EntityRepository } from '@mikro-orm/core';
import { Expense } from '../expense.entity';

export class MikroOrmExpenseRepository extends EntityRepository<Expense> { }