import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RecurringExpenseDeleteHandler } from '../../../shared';
import { OrganizationRecurringExpense } from '../../organization-recurring-expense.entity';
import { OrganizationRecurringExpenseService } from '../../organization-recurring-expense.service';
import { OrganizationRecurringExpenseCreateCommand } from '../organization-recurring-expense.create.command';

@CommandHandler(OrganizationRecurringExpenseCreateCommand)
export class OrganizationRecurringExpenseCreateHandler
	implements ICommandHandler<OrganizationRecurringExpenseCreateCommand> {
	constructor(
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService
	) {}

	public async execute(
		command: OrganizationRecurringExpenseCreateCommand
	): Promise<any> {
		const { input } = command;
		const createdExpense = await this.organizationRecurringExpenseService.create(
			input
		);

		await this.organizationRecurringExpenseService.update(
			createdExpense.id,
			{
				parentRecurringExpenseId: createdExpense.id
			}
		);

		return {
			...createdExpense,
			parentRecurringExpenseId: createdExpense.id
		};
	}
}
