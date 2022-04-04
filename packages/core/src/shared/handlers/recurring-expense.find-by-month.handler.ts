import {
	IPagination,
	IRecurringExpenseByMonthFindInput,
	IRecurringExpenseModel
} from '@gauzy/contracts';
import { Between, IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { CrudService } from './../../core/crud';
import { getDateRange } from './../../core/utils';
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

		const where: Object = {
			organizationId,
			tenantId
		}

		let whereId: Object = employeeId ? { employeeId, ...where } : { ...where };
		if (input.parentRecurringExpenseId) {
			whereId = {
				...whereId,
				parentRecurringExpenseId: input.parentRecurringExpenseId
			};
		}

		const { start, end } = getDateRange(startDate, endDate);
		const expenses = await this.crudService.findAll({
			where: [
				{
					...whereId,
					startDate: Between(start, end),
					endDate: IsNull()
				},
				{
					...whereId,
					startDate: LessThanOrEqual(start),
					endDate: MoreThanOrEqual(end)
				}
			],
			relations
		});

		return expenses;
	}
}
