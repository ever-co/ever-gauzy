import { OrganizationRecurringExpense } from '@gauzy/models';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { IPagination } from '../../../core';
import { FindRecurringExpenseByMonthHandler } from '../../../shared/handlers';
import { OrganizationRecurringExpenseService } from '../../organization-recurring-expense.service';
import { OrganizationRecurringExpenseByMonthQuery } from '../organization-recurring-expense.by-month.query';

@QueryHandler(OrganizationRecurringExpenseByMonthQuery)
export class OrganizationRecurringExpenseByMonthHandler
	extends FindRecurringExpenseByMonthHandler
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

		return await this.executeCommand(input);
	}
}
