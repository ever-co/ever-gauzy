import {
	RecurringExpenseEditInput,
	RecurringExpenseModel,
	StartDateUpdateTypeEnum
} from '@gauzy/models';
import { BadRequestException } from '@nestjs/common';
import {
	Between,
	In,
	IsNull,
	LessThanOrEqual,
	MoreThanOrEqual,
	Not
} from 'typeorm';
import { CrudService, getLastDayOfMonth } from '../../core';

/**
 * Edits a recurring expense.
 * To edit a recurring expense there can be different cases depending on the new start date.
 * For description of difference in each StartDateUpdateTypeEnum please refer to FindRecurringExpenseStartDateUpdateTypeHandler
 */
export abstract class RecurringExpenseEditHandler<
	T extends RecurringExpenseModel
> {
	constructor(private readonly crudService: CrudService<T>) {}

	public async executeCommand(
		id: string,
		input: RecurringExpenseEditInput
	): Promise<any> {
		const originalExpense: any = await this.crudService.findOne(id);

		const { startDateUpdateType } = input;

		switch (startDateUpdateType) {
			case StartDateUpdateTypeEnum.NO_CHANGE:
			case StartDateUpdateTypeEnum.WITHIN_MONTH:
			case StartDateUpdateTypeEnum.REDUCE_SAFE:
				return this.updateExpenseStartDateAndValue(id, input);
			case StartDateUpdateTypeEnum.INCREASE_SAFE_OUTSIDE_LIMIT:
			case StartDateUpdateTypeEnum.INCREASE_SAFE_WITHIN_LIMIT:
				return this.increaseSafe(id, input, originalExpense);
			case StartDateUpdateTypeEnum.REDUCE_CONFLICT:
				return this.reduceConflict(id, input, originalExpense);
			case StartDateUpdateTypeEnum.INCREASE_CONFLICT:
				//TODO: Handle this case too
				throw new BadRequestException(
					'Cannot increase start date with conflicts'
				);
			default:
				throw new BadRequestException(
					'Start Date Update Type Not Defined'
				);
		}
	}

	/**
	 * Update the original expense with the input values.
	 * This is to be used when there is no other change required to update the expense.
	 */
	private updateExpenseStartDateAndValue = async (
		id: string,
		input: RecurringExpenseEditInput
	) => {
		//TODO: Fix typescript
		const updateObject: any = {
			startDay: input.startDay,
			startMonth: input.startMonth,
			startYear: input.startYear,
			startDate: new Date(
				input.startYear,
				input.startMonth,
				input.startDay
			),
			value: input.value
		};
		return await this.crudService.update(id, updateObject);
	};

	/**
	 * This increases the date of the recurring expense when it is safe to do so
	 * i.e. it is not conflicting with any other expense with the same parentExpenseId
	 *
	 * To do this we
	 * 1. Change the end date of the original expense so that old value is not modified for previous expense.
	 * 2. Create a new expense to have new values for all future dates.
	 */
	private increaseSafe = async (
		id: string,
		input: RecurringExpenseEditInput,
		originalExpense: RecurringExpenseModel | any
	) => {
		const originalEndDate = new Date(
			originalExpense.endYear,
			originalExpense.endMonth,
			originalExpense.endDay
		);
		const newStartDate = new Date(
			input.startYear,
			input.startMonth,
			input.startDay
		);

		//1. Change the end date of the original expense so that old value is not modified for previous expense.
		const endMonth = input.startMonth > 0 ? input.startMonth - 1 : 11;
		const endYear =
			input.startMonth > 0 ? input.startYear : input.startYear - 1;
		const endDay = getLastDayOfMonth(endYear, endMonth);

		//TODO: Fix typescript
		const updateObject: any = {
			endDay,
			endMonth, //Because from input.startMonth the new value will be considered
			endYear,
			endDate: new Date(endYear, endMonth, endDay)
		};

		await this.crudService.update(id, updateObject);

		const createObject: any = {
			startDay: input.startDay,
			startMonth: input.startMonth,
			startYear: input.startYear,
			startDate: new Date(
				input.startYear,
				input.startMonth,
				input.startDay
			),
			endDay:
				originalEndDate > newStartDate ? originalExpense.endDay : null,
			endMonth:
				originalEndDate > newStartDate
					? originalExpense.endMonth
					: null,
			endYear:
				originalEndDate > newStartDate ? originalExpense.endYear : null,
			endDate:
				originalEndDate > newStartDate ? originalExpense.endDate : null,
			value: input.value,
			categoryName: originalExpense.categoryName,
			currency: originalExpense.currency,
			parentRecurringExpenseId: originalExpense.parentRecurringExpenseId
		};
		if (originalExpense.employeeId) {
			createObject.employeeId = originalExpense.employeeId;
		}
		if (originalExpense.organizationId) {
			createObject.organizationId = originalExpense.organizationId;
			createObject.splitExpense = originalExpense.splitExpense;
		}
		const newExpense = await this.crudService.create(createObject);

		return newExpense;
	};

	/**
	 * Decrease the date of the recurring expense while modifying the date of the conflicting expense
	 * 1. Find conflicting expense
	 * 2. Update end date of conflicting expense to one month after the input month
	 * 3. Remove any expense if is in between
	 * 4. This resolves the conflict, now do a simple non conflicting update.
	 */
	private reduceConflict = async (
		id: string,
		input: RecurringExpenseEditInput,
		originalExpense: RecurringExpenseModel
	) => {
		//1. Find conflicting expense
		const conflictingExpense = await this.findConflictingExpense(
			id,
			originalExpense.parentRecurringExpenseId,
			input.startYear,
			input.startMonth
		);

		//2. Update end date of conflicting expense to one month before the input start month
		if (conflictingExpense) {
			await this.reduceEndDateToPreviousMonth(
				conflictingExpense.id,
				input.startYear,
				input.startMonth
			);
		}

		//3. Remove expenses in between, if any
		const { items, total } = await this.findAllExpensesInBetween(
			originalExpense.id,
			originalExpense.parentRecurringExpenseId,
			input.startYear,
			input.startMonth,
			originalExpense.startYear,
			originalExpense.startMonth
		);

		if (total > 0) {
			const itemsInBetween: any = {
				id: In(items.map((i) => i.id))
			};
			await this.crudService.delete(itemsInBetween);
		}

		//4. This resolves the conflict, now do a simple non conflicting update.
		this.updateExpenseStartDateAndValue(id, input);
	};

	/**
	 * Decrease only the end date to the end of previous month without modifying any value
	 */
	private async reduceEndDateToPreviousMonth(
		id: string,
		startYear: number,
		startMonth: number
	) {
		const newEndYear = startMonth > 0 ? startYear : startYear - 1;
		const newEndMonth = startMonth > 0 ? startMonth - 1 : 11;
		const newEndDay = getLastDayOfMonth(newEndYear, newEndMonth);

		const dateUpdate: any = {
			endDay: newEndDay,
			endMonth: newEndMonth,
			endYear: newEndYear,
			endDate: new Date(newEndYear, newEndMonth, newEndDay)
		};
		await this.crudService.update(id, dateUpdate);
	}

	/**
	 * Find all expenses (except the recurringExpenseId) between a given start and end months of the same parent recurring expense id.
	 */
	async findAllExpensesInBetween(
		recurringExpenseId: string,
		parentRecurringExpenseId: string,
		updatedStartYear: number,
		updatedStartMonth: number,
		currentStartYear: number,
		currentStartMonth: number
	) {
		const lastDayOfMonth = getLastDayOfMonth(
			currentStartYear,
			currentStartMonth
		);
		const currentStartDate = new Date(
			currentStartYear,
			currentStartMonth,
			lastDayOfMonth
		);
		const updatedStartDate = new Date(
			updatedStartYear,
			updatedStartMonth,
			1
		);

		return await this.crudService.findAll({
			where: [
				{
					id: Not(recurringExpenseId),
					parentRecurringExpenseId: parentRecurringExpenseId,
					startDate: Between(updatedStartDate, currentStartDate)
				},
				{
					id: Not(recurringExpenseId),
					parentRecurringExpenseId: parentRecurringExpenseId,
					endDate: Between(updatedStartDate, currentStartDate)
				}
			]
		});
	}

	async findConflictingExpense(
		recurringExpenseId: string,
		parentRecurringExpenseId: string,
		year: number,
		month: number
	) {
		const lastDayOfMonth = getLastDayOfMonth(year, month);
		const inputStartDate = new Date(year, month, lastDayOfMonth);
		const inputEndDate = new Date(year, month, 1);

		try {
			const expense = await this.crudService.findOne({
				where: [
					{
						parentRecurringExpenseId: parentRecurringExpenseId,
						startDate: LessThanOrEqual(inputStartDate),
						endDate: IsNull()
					},
					{
						parentRecurringExpenseId: parentRecurringExpenseId,
						startDate: LessThanOrEqual(inputStartDate),
						endDate: MoreThanOrEqual(inputEndDate)
					}
				]
			});

			//If this is the same expense as the expense we want to update, then it is not a conflicting expense
			return expense.id !== recurringExpenseId ? expense : undefined;
		} catch (error) {
			//Ignore, this means record not found.
		}

		return undefined;
	}
}
