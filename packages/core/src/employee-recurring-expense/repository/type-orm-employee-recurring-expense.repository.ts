import { Repository } from 'typeorm';
import { EmployeeRecurringExpense } from '../employee-recurring-expense.entity';

export class TypeOrmEmployeeRecurringExpenseRepository extends Repository<EmployeeRecurringExpense> { }