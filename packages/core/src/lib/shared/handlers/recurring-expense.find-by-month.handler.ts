import {
	IPagination,
	IRecurringExpenseByMonthFindInput,
	IRecurringExpenseModel
} from '@gauzy/contracts';
import { Between, FindOptionsWhere, IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
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
		const expenses = await this.crudService.findAll({
			where: [
				{
					...where,
					startDate: Between(start, end),
					endDate: IsNull()
				},
				{
					...where,
					startDate: LessThanOrEqual(start),
					endDate: MoreThanOrEqual(end)
				}
			] as FindOptionsWhere<T>[],
			relations
		});

		return expenses;
	}
}
