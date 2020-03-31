import {
	IFindStartDateUpdateTypeInput,
	IStartUpdateTypeInfo,
	RecurringExpenseModel,
	StartDateUpdateTypeEnum
} from '@gauzy/models';
import { Between, Not } from 'typeorm';
import { CrudService, getLastDayOfMonth } from '../../core';

/**
 * Finds the start date update type.
 *
 * When updating the start date, if
 * NO_CHANGE: When there is no change in the date.
 * WITHIN_MONTH: When the change is within a particular month.
 * INCREASE_SAFE_WITHIN_LIMIT: When the change is 'safe*' and the new start date is BEFORE the end date
 * INCREASE_SAFE_OUTSIDE_LIMIT: When the change is 'safe*' and the new start date is AFTER the end date
 * INCREASE_CONFLICT: When there are one or more conflicting expenses between the original start date and new start date
 * REDUCE_SAFE: When the new start date is before the old start date and it is 'safe*' to update the date
 * REDUCE_CONFLICT: When the new start date is before the old start date and there is some expense already with the same parentRecurringExpenseId for the date
 *
 * *safe: An expense update is 'safe' when there is no other expense with the same parentRecurringExpenseId for the new start date.
 */
export abstract class FindRecurringExpenseStartDateUpdateTypeHandler<
	T extends RecurringExpenseModel
> {
	constructor(private readonly crudService: CrudService<T>) {}

	public async executeQuery(
		input: IFindStartDateUpdateTypeInput
	): Promise<IStartUpdateTypeInfo> {
		const { newStartDate, recurringExpenseId } = input;

		const originalExpense = await this.crudService.findOne(
			recurringExpenseId
		);

		const oldStartDateObject = originalExpense.startDate;

		const newStartDateObject = new Date(newStartDate);

		if (oldStartDateObject.getTime() === newStartDateObject.getTime()) {
			return { value: StartDateUpdateTypeEnum.NO_CHANGE, conflicts: [] };
		} else if (
			newStartDateObject.getMonth() === oldStartDateObject.getMonth() &&
			newStartDateObject.getFullYear() ===
				oldStartDateObject.getFullYear()
		) {
			return {
				value: StartDateUpdateTypeEnum.WITHIN_MONTH,
				conflicts: []
			};
		} else if (
			newStartDateObject.getTime() > oldStartDateObject.getTime()
		) {
			return this.getIncreaseType(originalExpense, newStartDateObject);
		} else if (
			newStartDateObject.getTime() < oldStartDateObject.getTime()
		) {
			return this.getReduceType(originalExpense, newStartDate);
		}
	}

	/**
	 * Returns whether the increase is safe or has conflicts.
	 * 1. If new start date is more than original end date then it is outside limit
	 * 2. Find all expenses between original start date and new start date, if any expense found then conflict
	 */
	private async getIncreaseType(originalExpense, newStartDateObject) {
		const safeUpdateType =
			originalExpense.endDate &&
			newStartDateObject.getTime() > originalExpense.endDate.getTime()
				? StartDateUpdateTypeEnum.INCREASE_SAFE_OUTSIDE_LIMIT
				: StartDateUpdateTypeEnum.INCREASE_SAFE_WITHIN_LIMIT;

		const {
			items: foundRecurringExpenses,
			total
		} = await this.findAllExpensesInBetween(
			originalExpense.id,
			originalExpense.parentRecurringExpenseId,
			new Date(originalExpense.startYear, originalExpense.startMonth, 1),
			new Date(
				newStartDateObject.getFullYear(),
				newStartDateObject.getMonth(),
				getLastDayOfMonth(
					newStartDateObject.getFullYear(),
					newStartDateObject.getMonth()
				)
			)
		);

		return {
			value:
				total === 0
					? safeUpdateType
					: StartDateUpdateTypeEnum.INCREASE_CONFLICT,
			conflicts: foundRecurringExpenses
		};
	}

	/**
	 * Returns whether reducing the start date is safe or has conflicts.
	 * Find all expenses between new start date and original start date, if any expense found then conflict
	 */
	private async getReduceType(originalExpense, newStartDate) {
		const currentStartDate = new Date(
			originalExpense.startYear,
			originalExpense.startMonth,
			getLastDayOfMonth(
				originalExpense.startYear,
				originalExpense.startMonth
			)
		);

		const {
			items: foundRecurringExpenses,
			total
		} = await this.findAllExpensesInBetween(
			originalExpense.id,
			originalExpense.parentRecurringExpenseId,
			newStartDate,
			currentStartDate
		);

		return {
			value:
				total === 0
					? StartDateUpdateTypeEnum.REDUCE_SAFE
					: StartDateUpdateTypeEnum.REDUCE_CONFLICT,
			conflicts: foundRecurringExpenses
		};
	}

	/**
	 * Find all expenses (except the recurringExpenseId) between a given from and to date of the same parent recurring expense id.
	 */
	private async findAllExpensesInBetween(
		recurringExpenseId: string,
		parentRecurringExpenseId: string,
		fromStartDate: Date,
		toStartDate: Date
	) {
		return await this.crudService.findAll({
			where: [
				{
					id: Not(recurringExpenseId),
					parentRecurringExpenseId: parentRecurringExpenseId,
					startDate: Between(fromStartDate, toStartDate)
				},
				{
					id: Not(recurringExpenseId),
					parentRecurringExpenseId: parentRecurringExpenseId,
					endDate: Between(fromStartDate, toStartDate)
				}
			]
		});
	}
}
