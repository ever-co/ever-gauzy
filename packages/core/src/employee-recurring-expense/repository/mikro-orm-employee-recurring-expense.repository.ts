import { EntityRepository } from '@mikro-orm/knex';
import { EmployeeRecurringExpense } from '../employee-recurring-expense.entity';

export class MikroOrmEmployeeRecurringExpenseRepository extends EntityRepository<EmployeeRecurringExpense> { }
