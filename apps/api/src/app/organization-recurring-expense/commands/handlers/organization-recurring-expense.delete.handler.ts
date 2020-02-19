import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult, UpdateResult } from 'typeorm';

import { RecurringExpenseDeleteHandler } from '../../../shared/handlers/recurring-expense.delete.handler';
import { OrganizationRecurringExpenseService } from '../../organization-recurring-expense.service';
import { OrganizationRecurringExpenseDeleteCommand } from '../organization-recurring-expense.delete.command';
import { OrganizationRecurringExpense } from '../../organization-recurring-expense.entity';
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
