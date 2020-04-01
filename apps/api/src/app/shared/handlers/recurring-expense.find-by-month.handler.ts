import {
	RecurringExpenseByMonthFindInput,
	RecurringExpenseModel
} from '@gauzy/models';
import { IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { CrudService, getLastDayOfMonth, IPagination } from '../../core';

/**
 * Finds income, expense, profit and bonus for all organizations for the given month.
 *
 * (start date) < (input date) < (end date, null for end date is treated as infinity)
 *
 * If year is different, only company year.
 * If year is same, compare month
 */
export abstract class FindRecurringExpenseByMonthHandler<
	T extends RecurringExpenseModel
> {
	//TODO: Change CrudService<any> to be more specific
	constructor(private readonly crudService: CrudService<T>) {}

	public async executeCommand(
		input: RecurringExpenseByMonthFindInput | any
	): Promise<IPagination<T>> {
		const lastDayOfMonth = getLastDayOfMonth(input.year, input.month);
		const inputStartDate = new Date(
			input.year,
			input.month,
			lastDayOfMonth
		);
		const inputEndDate = new Date(input.year, input.month, 1);

		let whereId: Object = input.orgId
			? {
					orgId: input.orgId
			  }
			: {
					employeeId: input.employeeId
			  };

		if (input.parentRecurringExpenseId) {
			whereId = {
				...whereId,
				parentRecurringExpenseId: input.parentRecurringExpenseId
			};
		}

		const expenses = await this.crudService.findAll({
			where: [
				{
					...whereId,
					startDate: LessThanOrEqual(inputStartDate),
					endDate: IsNull()
				},
				{
					...whereId,
					startDate: LessThanOrEqual(inputStartDate),
					endDate: MoreThanOrEqual(inputEndDate)
				}
			]
		});

		return expenses;
	}
}
