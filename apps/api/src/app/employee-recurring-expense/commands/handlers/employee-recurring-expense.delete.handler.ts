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
	 * 3. Update the end month of the original expense to one less than the month to be deleted
	 * 4. Create a new record with start month as one more than the month to be deleted
	 */
	private async deleteOneMonthOnly(
		id: string,
		deleteInput: EmployeeRecurringExpenseDeleteInput
	): Promise<EmployeeRecurringExpense | UpdateResult | DeleteResult> {
		const originalExpense = await this.employeeRecurringExpenseService.findOne(
			id
		);
		const originalStartDate = new Date(
			originalExpense.startYear,
			originalExpense.startMonth
		);
		const originalEndDate = new Date(
			originalExpense.endYear,
			originalExpense.endMonth
		);

		const deleteDate = new Date(deleteInput.year, deleteInput.month);

		if (
			originalStartDate.getTime() === originalEndDate.getTime() &&
			originalEndDate.getTime() === deleteDate.getTime()
		) {
			await this.employeeRecurringExpenseService.delete({
				id
			});
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
		return await this.employeeRecurringExpenseService.update(id, {
			endDay: 1,
			endMonth: deleteInput.month > 1 ? deleteInput.month - 1 : 12, //Because input.startMonth needs to be deleted
			endYear:
				deleteInput.month > 1 ? deleteInput.year : deleteInput.year - 1
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
		console.log('Create next month waa');

		const nextStartDate = new Date(deleteInput.year, deleteInput.month);

		// This is because we store months from 1, but Date() takes months from 0
		const originalEndDate = new Date(
			originalExpense.endYear,
			originalExpense.endMonth - 1
		);

		console.log('next start daate', nextStartDate);

		console.log('orig end date', originalEndDate);

		// If there is still more time left after deleting one month from in between
		if (
			!originalExpense.endYear ||
			nextStartDate.getDate() <= originalEndDate.getDate()
		) {
			//Create new expense for the remaining time
			return await this.employeeRecurringExpenseService.create({
				employeeId: originalExpense.employeeId,
				startDay: deleteInput.day,
				startMonth: nextStartDate.getMonth() + 1,
				startYear: nextStartDate.getFullYear(),
				endDay: originalExpense.endDay,
				endMonth: originalExpense.endMonth,
				endYear: originalExpense.endYear,
				value: originalExpense.value,
				categoryName: originalExpense.categoryName,
				currency: originalExpense.currency
			});
		}
		return;
	}
}
