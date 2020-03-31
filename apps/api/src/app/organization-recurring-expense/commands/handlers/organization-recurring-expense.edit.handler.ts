import { IStartUpdateTypeInfo } from '@gauzy/models';
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { RecurringExpenseEditHandler } from '../../../shared';
import { OrganizationRecurringExpense } from '../../organization-recurring-expense.entity';
import { OrganizationRecurringExpenseService } from '../../organization-recurring-expense.service';
import { OrganizationRecurringExpenseStartDateUpdateTypeQuery } from '../../queries/organization-recurring-expense.update-type.query';
import { OrganizationRecurringExpenseEditCommand } from '../organization-recurring-expense.edit.command';

/**
 * This edits a recurring expense.
 * To edit a recurring expense
 * 1. Change the end date of the original expense so that old value is not modified for previous expense.
 * 2. Create a new expense to have new values for all future dates.
 */
@CommandHandler(OrganizationRecurringExpenseEditCommand)
export class OrganizationRecurringExpenseEditHandler
	extends RecurringExpenseEditHandler<OrganizationRecurringExpense>
	implements ICommandHandler<OrganizationRecurringExpenseEditCommand> {
	constructor(
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService,
		private readonly queryBus: QueryBus
	) {
		super(organizationRecurringExpenseService);
	}

	public async execute(
		command: OrganizationRecurringExpenseEditCommand
	): Promise<any> {
		const { id, input } = command;

		const updateType: IStartUpdateTypeInfo = await this.queryBus.execute(
			new OrganizationRecurringExpenseStartDateUpdateTypeQuery({
				newStartDate: new Date(
					input.startYear,
					input.startMonth,
					input.startDay
				),
				recurringExpenseId: id
			})
		);

		return await this.executeCommand(id, {
			...input,
			startDateUpdateType: updateType.value
		});
	}
}
