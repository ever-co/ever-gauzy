import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RecurringExpenseDeleteHandler } from '../../../shared';
import { OrganizationRecurringExpense } from '../../organization-recurring-expense.entity';
import { OrganizationRecurringExpenseService } from '../../organization-recurring-expense.service';
import { OrganizationRecurringExpenseDeleteCommand } from '../organization-recurring-expense.delete.command';

/**
 * Deletes a OrganizationRecurringExpense based on RecurringExpenseDeleteHandler
 */
@CommandHandler(OrganizationRecurringExpenseDeleteCommand)
export class OrganizationRecurringExpenseDeleteHandler
	extends RecurringExpenseDeleteHandler<OrganizationRecurringExpense>
	implements ICommandHandler<OrganizationRecurringExpenseDeleteCommand> {
	constructor(
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService
	) {
		super(organizationRecurringExpenseService);
	}

	//TODO: Fix typescript return <any>
	public async execute(
		command: OrganizationRecurringExpenseDeleteCommand
	): Promise<any> {
		const { id, deleteInput } = command;

		return await this.executeCommand(id, deleteInput);
	}
}
