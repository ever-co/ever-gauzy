import { EntityRepository } from '@mikro-orm/core';
import { EmployeeRecurringExpense } from '../employee-recurring-expense.entity';

export class MikroOrmEmployeeRecurringExpenseRepository extends EntityRepository<EmployeeRecurringExpense> { }