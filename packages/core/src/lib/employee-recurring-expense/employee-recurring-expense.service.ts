import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';
import { TypeOrmEmployeeRecurringExpenseRepository } from './repository/type-orm-employee-recurring-expense.repository';
import { MikroOrmEmployeeRecurringExpenseRepository } from './repository/mikro-orm-employee-recurring-expense.repository';

@Injectable()
export class EmployeeRecurringExpenseService extends TenantAwareCrudService<EmployeeRecurringExpense> {
	constructor(
		typeOrmEmployeeRecurringExpenseRepository: TypeOrmEmployeeRecurringExpenseRepository,
		mikroOrmEmployeeRecurringExpenseRepository: MikroOrmEmployeeRecurringExpenseRepository
	) {
		super(typeOrmEmployeeRecurringExpenseRepository, mikroOrmEmployeeRecurringExpenseRepository);
	}
}
