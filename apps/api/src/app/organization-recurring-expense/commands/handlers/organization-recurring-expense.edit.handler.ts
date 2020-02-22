import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationRecurringExpenseService } from '../../organization-recurring-expense.service';
import { OrganizationRecurringExpenseEditCommand } from '../organization-recurring-expense.edit.command';
import { RecurringExpenseEditHandler } from '../../../shared';
import { OrganizationRecurringExpense } from '../../organization-recurring-expense.entity';

/**
 * This edits the value of a recurring expense.
 * To edit a recurring expense
 * 1. Change the end date of the original expense so that old value is not modified for previous expense.
 * 2. Create a new expense to have new values for all future dates.
 */
@CommandHandler(OrganizationRecurringExpenseEditCommand)
export class OrganizationRecurringExpenseEditHandler
	extends RecurringExpenseEditHandler<OrganizationRecurringExpense>
	implements ICommandHandler<OrganizationRecurringExpenseEditCommand> {
	constructor(
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService
	) {
		super(organizationRecurringExpenseService);
	}

	public async execute(
		command: OrganizationRecurringExpenseEditCommand
	): Promise<any> {
		const { id, input } = command;
		return await this.executeCommand(id, input);
	}
}
