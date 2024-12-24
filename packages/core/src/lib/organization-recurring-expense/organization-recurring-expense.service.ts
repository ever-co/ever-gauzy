import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationRecurringExpense } from './organization-recurring-expense.entity';
import { TypeOrmOrganizationRecurringExpenseRepository } from './repository/type-orm-organization-recurring-expense.repository';
import { MikroOrmOrganizationRecurringExpenseRepository } from './repository/mikro-orm-organization-recurring-expense.repository';

@Injectable()
export class OrganizationRecurringExpenseService extends TenantAwareCrudService<OrganizationRecurringExpense> {
	constructor(
		@InjectRepository(OrganizationRecurringExpense)
		typeOrmOrganizationRecurringExpenseRepository: TypeOrmOrganizationRecurringExpenseRepository,

		mikroOrmOrganizationRecurringExpenseRepository: MikroOrmOrganizationRecurringExpenseRepository
	) {
		super(typeOrmOrganizationRecurringExpenseRepository, mikroOrmOrganizationRecurringExpenseRepository);
	}
}
