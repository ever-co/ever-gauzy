import { CrudService } from '../../core';
import { EmployeeRecurringExpense } from '../../employee-recurring-expense';
import { OrganizationRecurringExpense } from '../../organization-recurring-expense';
import { RecurringExpenseEditInput } from '@gauzy/models';

/**
 * This edits the value of a recurring expense.
 * To edit a recurring expense
 * 1. Change the end date of the original expense so that old value is not modified for previous expense.
 * 2. Create a new expense to have new values for all future dates.
 */
export abstract class RecurringExpenseEditHandler {
	constructor(
		private readonly crudService: CrudService<
			EmployeeRecurringExpense | OrganizationRecurringExpense
		>
	) {}

	public async executeCommand(
		id: string,
		input: RecurringExpenseEditInput
	): Promise<any> {
		const originalExpense: any = await this.crudService.findOne(id);

		const inputDate = new Date(
			input.startYear,
			input.startMonth - 1,
			input.startDay
		);

		if (originalExpense.startDate.getTime() === inputDate.getTime()) {
			return await this.crudService.update(id, input);
		}

		const endMonth = input.startMonth > 1 ? input.startMonth - 1 : 12;
		const endYear =
			input.startMonth > 1 ? input.startYear : input.startYear - 1;

		await this.crudService.update(id, {
			endDay: input.startDay,
			endMonth, //Because from input.startMonth the new value will be considered
			endYear,
			endDate: new Date(endYear, endMonth - 1, input.startDay)
		});

		const createObject: any = {
			startDay: input.startDay,
			startMonth: input.startMonth,
			startYear: input.startYear,
			startDate: new Date(
				input.startYear,
				input.startMonth - 1,
				input.startDay
			),
			endDay: originalExpense.endDay,
			endMonth: originalExpense.endMonth,
			endYear: originalExpense.endYear,
			endDate: originalExpense.endDate,
			value: input.value,
			categoryName: originalExpense.categoryName,
			currency: originalExpense.currency
		};
		if (originalExpense.employeeId) {
			createObject.employeeId = originalExpense.employeeId;
		}
		if (originalExpense.orgId) {
			createObject.orgId = originalExpense.orgId;
		}
		const newExpense = await this.crudService.create(createObject);

		return newExpense;
	}
}
