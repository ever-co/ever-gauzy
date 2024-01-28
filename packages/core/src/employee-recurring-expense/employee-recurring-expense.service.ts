import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';

@Injectable()
export class EmployeeRecurringExpenseService extends TenantAwareCrudService<EmployeeRecurringExpense> {
	constructor(
		@InjectRepository(EmployeeRecurringExpense)
		employeeRecurringExpense: Repository<EmployeeRecurringExpense>,
		@MikroInjectRepository(EmployeeRecurringExpense)
		mikroEmployeeRecurringExpense: EntityRepository<EmployeeRecurringExpense>
	) {
		super(employeeRecurringExpense, mikroEmployeeRecurringExpense);
	}
}
