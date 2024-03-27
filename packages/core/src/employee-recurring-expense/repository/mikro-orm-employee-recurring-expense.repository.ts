import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { EmployeeRecurringExpense } from '../employee-recurring-expense.entity';

export class MikroOrmEmployeeRecurringExpenseRepository extends MikroOrmBaseEntityRepository<EmployeeRecurringExpense> { }
