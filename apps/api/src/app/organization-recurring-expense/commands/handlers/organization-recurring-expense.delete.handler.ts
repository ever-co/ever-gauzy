import { OrganizationRecurringExpense } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult, UpdateResult } from 'typeorm';

import { RecurringExpenseDeleteHandler } from '../../../shared/handlers/recurring-expense.delete.handler';
import { OrganizationRecurringExpenseService } from '../../organization-recurring-expense.service';
import { OrganizationRecurringExpenseDeleteCommand } from '../organization-recurring-expense.delete.command';

/**
 * Deletes a OrganizationRecurringExpense based on RecurringExpenseDeleteHandler
 */
@CommandHandler(OrganizationRecurringExpenseDeleteCommand)
export class OrganizationRecurringExpenseDeleteHandler
	extends RecurringExpenseDeleteHandler
	implements ICommandHandler<OrganizationRecurringExpenseDeleteCommand> {
	constructor(
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService
	) {
		super(organizationRecurringExpenseService);
	}

	public async execute(
		command: OrganizationRecurringExpenseDeleteCommand
	): Promise<OrganizationRecurringExpense | UpdateResult | DeleteResult> {
		const { id, deleteInput } = command;

		return await this.executeCommand(id, deleteInput);
	}
}
