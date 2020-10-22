import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { OrganizationRecurringExpense } from './organization-recurring-expense.entity';

@Injectable()
export class OrganizationRecurringExpenseService extends TenantAwareCrudService<
	OrganizationRecurringExpense
> {
	constructor(
		@InjectRepository(OrganizationRecurringExpense)
		private readonly organizationRecurringExpenseRepository: Repository<
			OrganizationRecurringExpense
		>
	) {
		super(organizationRecurringExpenseRepository);
	}
}
