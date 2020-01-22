import {
	EmployeeRecurringExpense,
	EmployeeRecurringExpenseDeleteInput,
	RecurringExpenseDeletionEnum
} from '@gauzy/models';
import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult, UpdateResult } from 'typeorm';
import { EmployeeRecurringExpenseService } from '../../employee-recurring-expense.service';
import { EmployeeRecurringExpenseDeleteCommand } from '../employee-recurring-expense.delete.command';

/**
 * Deletes a EmployeeRecurringExpense based on command.deleteInput.deletionType:
 *
 * 1. ALL: Delete all entries for an expense (By actually deleting it from the db)
 * 2. FUTURE : Delete only current and future events (By reducing the end date)
 * 3. CURRENT : Delete only one month (By splitting the expense into two)
 *
 */
@CommandHandler(EmployeeRecurringExpenseDeleteCommand)
export class EmployeeRecurringExpenseDeleteHandler
	implements ICommandHandler<EmployeeRecurringExpenseDeleteCommand> {
	constructor(
		private readonly employeeRecurringExpenseService: EmployeeRecurringExpenseService
	) {}

	public async execute(
		command: EmployeeRecurringExpenseDeleteCommand
	): Promise<EmployeeRecurringExpense | UpdateResult | DeleteResult> {
		const { id, deleteInput } = command;

		let result;

		switch (deleteInput.deletionType) {
			case RecurringExpenseDeletionEnum.ALL:
				result = await this.employeeRecurringExpenseService.delete({
					id
				});
				break;
			case RecurringExpenseDeletionEnum.FUTURE:
				await this.updateEndDateToLastMonth(id, deleteInput);
				break;
			case RecurringExpenseDeletionEnum.CURRENT:
				await this.deleteOneMonthOnly(id, deleteInput);
				break;
			default:
				throw new BadRequestException(
					`Unsupported deletion type ${deleteInput.deletionType}`
				);
		}

		return result;
	}

	/**
	 * This removes the given month in deleteInput from the expense.
	 * 1. Find the original expense.
	 * 2. Check if there is only one month in the original month (start date = end date = the one which needs to be deleted)
	 * 2.a If true then delete the entry completely.
	 * 2.b If false proceed to 3
	 * 3. Check if this is the first month (start date = the one which needs to be deleted)
	 * 3.a If true then delete entry but create for next months
	 * 3.b If false then proceed to 4
	 * 4. Update the end month of the original expense to one less than the month to be deleted
	 * 5. Create a new record with start month as one more than the month to be deleted
	 */
	private async deleteOneMonthOnly(
		id: string,
		deleteInput: EmployeeRecurringExpenseDeleteInput
	): Promise<EmployeeRecurringExpense | UpdateResult | DeleteResult> {
		const originalExpense = await this.employeeRecurringExpenseService.findOne(
			id
		);

		const deleteDate = new Date(deleteInput.year, deleteInput.month - 1);

		if (
			deleteDate.getTime() === originalExpense.startDate.getTime() &&
			originalExpense.endDate &&
			originalExpense.endDate.getTime() === deleteDate.getTime()
		) {
			//Only delete
			return await this.employeeRecurringExpenseService.delete({
				id
			});
		} else if (
			deleteDate.getTime() === originalExpense.startDate.getTime()
		) {
			//Delete and create for next month onwards
			await this.employeeRecurringExpenseService.delete({
				id
			});
			return await this.createExpenseFromNextMonth(
				deleteInput,
				originalExpense
			);
		} else {
			await this.updateEndDateToLastMonth(id, deleteInput);
			return await this.createExpenseFromNextMonth(
				deleteInput,
				originalExpense
			);
		}
	}

	/**
	 * Updates the end date to one month before deleteInput.month
	 */
	private async updateEndDateToLastMonth(
		id: string,
		deleteInput: EmployeeRecurringExpenseDeleteInput
	): Promise<EmployeeRecurringExpense | UpdateResult | DeleteResult> {
		const endMonth = deleteInput.month > 1 ? deleteInput.month - 1 : 12; //Because input.startMonth needs to be deleted
		const endYear =
			deleteInput.month > 1 ? deleteInput.year : deleteInput.year - 1;
		return await this.employeeRecurringExpenseService.update(id, {
			endDay: 1,
			endMonth,
			endYear,
			endDate: new Date(endYear, endMonth - 1, 1)
		});
	}

	/**
	 * Creates a copy of the originalExpense but with start date are one month more than deleteInput
	 *
	 * @param deleteInput The delete input
	 * @param originalExpense The original (non modified) expense
	 */
	private async createExpenseFromNextMonth(
		deleteInput: EmployeeRecurringExpenseDeleteInput,
		originalExpense: EmployeeRecurringExpense
	): Promise<EmployeeRecurringExpense> {
		const nextStartDate = new Date(deleteInput.year, deleteInput.month, 1);

		// If there is still more time left after deleting one month from in between
		if (
			!originalExpense.endDate ||
			nextStartDate.getTime() <= originalExpense.endDate.getTime()
		) {
			//Create new expense for the remaining time
			return await this.employeeRecurringExpenseService.create({
				employeeId: originalExpense.employeeId,
				startDay: 1,
				startMonth: deleteInput.month + 1,
				startYear: deleteInput.year,
				startDate: nextStartDate,
				endDay: originalExpense.endDay,
				endMonth: originalExpense.endMonth,
				endYear: originalExpense.endYear,
				endDate: originalExpense.endDate,
				categoryName: originalExpense.categoryName,
				currency: originalExpense.currency,
				value: originalExpense.value
			});
		}
		return;
	}
}
