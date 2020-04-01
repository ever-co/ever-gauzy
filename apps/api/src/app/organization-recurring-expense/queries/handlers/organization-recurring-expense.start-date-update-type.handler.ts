import { IStartUpdateTypeInfo } from '@gauzy/models';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindRecurringExpenseStartDateUpdateTypeHandler } from '../../../shared/handlers/recurring-expense.find-update-type.handler';
import { OrganizationRecurringExpense } from '../../organization-recurring-expense.entity';
import { OrganizationRecurringExpenseService } from '../../organization-recurring-expense.service';
import { OrganizationRecurringExpenseStartDateUpdateTypeQuery } from '../organization-recurring-expense.update-type.query';

@QueryHandler(OrganizationRecurringExpenseStartDateUpdateTypeQuery)
export class OrganizationRecurringExpenseUpdateTypeHandler
	extends FindRecurringExpenseStartDateUpdateTypeHandler<
		OrganizationRecurringExpense
	>
	implements
		IQueryHandler<OrganizationRecurringExpenseStartDateUpdateTypeQuery> {
	constructor(
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService
	) {
		super(organizationRecurringExpenseService);
	}

	public async execute(
		command: OrganizationRecurringExpenseStartDateUpdateTypeQuery
	): Promise<IStartUpdateTypeInfo> {
		return await this.executeQuery(command.input);
	}
}
