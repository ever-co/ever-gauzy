import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { IPagination } from '../../../core';
import { FindRecurringExpenseByMonthHandler } from '../../../shared';
import { OrganizationRecurringExpenseService } from '../../organization-recurring-expense.service';
import { OrganizationRecurringExpenseByMonthQuery } from '../organization-recurring-expense.by-month.query';
import { OrganizationRecurringExpense } from '../../organization-recurring-expense.entity';

@QueryHandler(OrganizationRecurringExpenseByMonthQuery)
export class OrganizationRecurringExpenseByMonthHandler
	extends FindRecurringExpenseByMonthHandler<OrganizationRecurringExpense>
	implements IQueryHandler<OrganizationRecurringExpenseByMonthQuery> {
	constructor(
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService
	) {
		super(organizationRecurringExpenseService);
	}

	public async execute(
		command: OrganizationRecurringExpenseByMonthQuery
	): Promise<IPagination<OrganizationRecurringExpense>> {
		const { input } = command;

		const recurringExpenses = await this.executeCommand(input);
		return recurringExpenses;
	}
}
