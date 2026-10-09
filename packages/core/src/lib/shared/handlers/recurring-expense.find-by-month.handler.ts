import {
	IPagination,
	IRecurringExpenseByMonthFindInput,
	IRecurringExpenseModel
} from '@gauzy/contracts';
import { FindOptionsWhere, IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import * as moment from 'moment';
import { CrudService } from './../../core/crud';
import { getDateRangeFormat } from './../../core/utils';
import { RequestContext } from './../../core/context';

/**
 * Finds income, expense, profit and bonus for all organizations for the given month.
 *
 * (start date) < (input date) < (end date, null for end date is treated as infinity)
 *
 * If year is different, only company year.
 * If year is same, compare month
 */
export abstract class FindRecurringExpenseByMonthHandler<
	T extends IRecurringExpenseModel
> {
	//TODO: Change CrudService<any> to be more specific
	constructor(private readonly crudService: CrudService<T>) {}

	public async executeCommand(
		input: IRecurringExpenseByMonthFindInput | any,
		relations?: string[]
	): Promise<IPagination<T>> {
		const { organizationId, employeeId, startDate, endDate } = input;
		const tenantId = RequestContext.currentTenantId();

		let where: Object = {
			organizationId,
			tenantId
		}
		where = employeeId ? { employeeId, ...where } : { ...where };
		if (input.parentRecurringExpenseId) {
			where = {
				...where,
				parentRecurringExpenseId: input.parentRecurringExpenseId
			};
		}
		const { start, end } = getDateRangeFormat(
			moment.utc(startDate),
			moment.utc(endDate)
		);
		// An expense belongs to the month when its own period overlaps it: it started on or before the
		// month's end, and it is open-ended or ends on or after the month's start. The first branch used
		// to require the start date INSIDE the month, so an open-ended expense was listed in its first
		// month only; the second required the expense to cover the whole month, which dropped the first
		// and last months of an expense that starts or ends mid-month.
		const expenses = await this.crudService.findAll({
			where: [
				{
					...where,
					startDate: LessThanOrEqual(end),
					endDate: IsNull()
				},
				{
					...where,
					startDate: LessThanOrEqual(end),
					endDate: MoreThanOrEqual(start)
				}
			] as FindOptionsWhere<T>[],
			relations
		});

		return expenses;
	}
}
