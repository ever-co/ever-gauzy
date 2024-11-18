import {
	IOrganizationRecurringExpense,
	IRecurringExpenseDeleteInput,
	RecurringExpenseDeletionEnum,
	IRecurringExpenseModel
} from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { DeleteResult, UpdateResult } from 'typeorm';
import { CrudService, getLastDayOfMonth } from '../../core';

/**
 * Deletes a OrganizationRecurringExpense based on command.deleteInput.deletionType:
 *
 * 1. ALL: Delete all entries for an expense (By actually deleting it from the db)
 * 2. FUTURE : Delete only current and future events (By reducing the end date)
 * 3. CURRENT : Delete only one month (By splitting the expense into two)
 *
 * TODO: Fix typescript, remove usage of :any
 */
export abstract class RecurringExpenseDeleteHandler<
	T extends IRecurringExpenseModel
> {
	constructor(private readonly crudService: CrudService<T>) {}

	public async executeCommand(
		id: string,
		deleteInput: IRecurringExpenseDeleteInput
	): Promise<IOrganizationRecurringExpense | UpdateResult | DeleteResult> {
		let result;
		switch (deleteInput.deletionType) {
			case RecurringExpenseDeletionEnum.ALL:
				const deleteId: any = {
					id
				};
				result = await this.crudService.delete(deleteId);
				break;
			case RecurringExpenseDeletionEnum.FUTURE:
				result = await this.updateEndDateToLastMonth(id, deleteInput);
				break;
			case RecurringExpenseDeletionEnum.CURRENT:
				result = await this.deleteOneMonthOnly(id, deleteInput);
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
		deleteInput: IRecurringExpenseDeleteInput
	): Promise<IOrganizationRecurringExpense | UpdateResult | DeleteResult> {
		const originalExpense = await this.crudService.findOneByIdString(id);

		const deleteDate = new Date(deleteInput.year, deleteInput.month);
		const deleteId: any = {
			id
		};

		if (
			deleteDate.getTime() === originalExpense.startDate.getTime() &&
			originalExpense.endDate &&
			originalExpense.endDate.getTime() === deleteDate.getTime()
		) {
			//Only delete
			return await this.crudService.delete(deleteId);
		} else if (
			deleteDate.getTime() === originalExpense.startDate.getTime()
		) {
			//Delete and create for next month onwards
			await this.crudService.delete(deleteId);
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
		deleteInput: IRecurringExpenseDeleteInput
	): Promise<any> {
		const endMonth = deleteInput.month > 0 ? deleteInput.month - 1 : 11; //Because input.startMonth needs to be deleted
		const endYear =
			deleteInput.month > 0 ? deleteInput.year : deleteInput.year - 1;
		const endDay = getLastDayOfMonth(endYear, endMonth);
		const updateOptions: any = {
			endDay,
			endMonth,
			endYear,
			endDate: new Date(endYear, endMonth, endDay)
		};
		return await this.crudService.update(id, updateOptions);
	}

	/**
	 * Creates a copy of the originalExpense but with start date are one month more than deleteInput
	 * By default, start date is the first day of the month & end date is the last date of the month
	 *
	 * @param deleteInput The delete input
	 * @param originalExpense The original (non modified) expense
	 */
	private async createExpenseFromNextMonth(
		deleteInput: IRecurringExpenseDeleteInput,
		originalExpense: IRecurringExpenseModel | any
	): Promise<any> {
		const nextStartDate = new Date(
			deleteInput.year,
			deleteInput.month + 1,
			1
		);

		// If there is still more time left after deleting one month from in between
		if (
			!originalExpense.endDate ||
			nextStartDate.getTime() <= originalExpense.endDate.getTime()
		) {
			const createOptions: any = {
				startDay: 1,
				startMonth: deleteInput.month + 1,
				startYear: deleteInput.year,
				startDate: nextStartDate,
				endDay: getLastDayOfMonth(
					originalExpense.endYear,
					originalExpense.endMonth
				),
				endMonth: originalExpense.endMonth,
				endYear: originalExpense.endYear,
				endDate: originalExpense.endDate,
				categoryName: originalExpense.categoryName,
				currency: originalExpense.currency,
				value: originalExpense.value,
				parentRecurringExpenseId:
					originalExpense.parentRecurringExpenseId
			};
			if (originalExpense.organizationId) {
				createOptions.organizationId = originalExpense.organizationId;
				createOptions.splitExpense = originalExpense.splitExpense;
			} 
			if (originalExpense.employeeId) {
				createOptions.employeeId = originalExpense.employeeId;
			}
			//Create new expense for the remaining time
			return await this.crudService.create(createOptions);
		}
		return;
	}
}
