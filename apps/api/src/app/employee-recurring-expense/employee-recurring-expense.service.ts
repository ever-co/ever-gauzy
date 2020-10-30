import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';

@Injectable()
export class EmployeeRecurringExpenseService extends TenantAwareCrudService<
	EmployeeRecurringExpense
> {
	constructor(
		@InjectRepository(EmployeeRecurringExpense)
		private readonly employeeRecurringExpense: Repository<
			EmployeeRecurringExpense
		>
	) {
		super(employeeRecurringExpense);
	}
}
