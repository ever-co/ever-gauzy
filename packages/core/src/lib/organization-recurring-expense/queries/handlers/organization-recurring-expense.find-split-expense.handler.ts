import { EmployeeKindEnum, IOrganizationRecurringExpenseForEmployeeOutput, IPagination } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EmployeeService } from '../../../employee/employee.service';
import { OrganizationService } from '../../../organization/organization.service';
import { OrganizationRecurringExpenseService } from '../../organization-recurring-expense.service';
import { OrganizationRecurringExpenseFindSplitExpenseQuery } from '../organization-recurring-expense.find-split-expense.query';
import { MoreThanOrEqual, IsNull, LessThanOrEqual } from 'typeorm';
import * as moment from 'moment';
/**
 * Finds the split recurring expense for a given organization.
 *
 * 1. Find all recurring expenses for the organization which have splitExpense = true
 * 2. Find all employees of the organization (TODO: No. of employees CURRENTLY in the organization?)
 * 3. Divide the value of the expense found in 1 to the no. of employees found in 2 to 'split' the expense equally for all employees.
 */
@QueryHandler(OrganizationRecurringExpenseFindSplitExpenseQuery)
export class OrganizationRecurringExpenseFindSplitExpenseHandler
	implements
		IQueryHandler<OrganizationRecurringExpenseFindSplitExpenseQuery> {
	constructor(
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService,
		private readonly organizationService: OrganizationService,
		private readonly employeeService: EmployeeService
	) {}

	public async execute(
		query: OrganizationRecurringExpenseFindSplitExpenseQuery
	): Promise<IPagination<IOrganizationRecurringExpenseForEmployeeOutput>> {
		const {
			orgId,
			findInput: { year, month }
		} = query;

		// The expenses running during the month: started by its end, and open-ended or ending after its start.
		// Comparing both dates with the 1st alone dropped an expense starting later in the month from that month.
		const monthStart = new Date(year, month, 1);
		const monthEnd = moment(monthStart).endOf('month').toDate();

		//1. Find all recurring expenses for the organization which have splitExpense = true
		const {
			items,
			total
		} = await this.organizationRecurringExpenseService.findAll({
			where: [
				{
					splitExpense: true,
					organizationId : orgId,
					startDate: LessThanOrEqual(monthEnd),
					endDate: IsNull()
				},
				{
					splitExpense: true,
					organizationId : orgId,
					startDate: LessThanOrEqual(monthEnd),
					endDate: MoreThanOrEqual(monthStart)
				}
			]
		});

		const organization = await this.organizationService.findOneByWhereOptions({
			id: orgId
		});

		//2. Find all employees of the organization: people only, an agent employee takes no share of an expense
		const orgEmployees = await this.employeeService.findAll({
			where: {
				organizationId: organization.id,
				kind: EmployeeKindEnum.HUMAN
			}
		});

		//3. Divide the value of the expense found in 1 to the no. of employees found in 2 to 'split' the expense equally for all employees.
		const splitItems = items.map((e) => ({
			...e,
			value: +(
				e.value / (orgEmployees.total !== 0 ? orgEmployees.total : 1)
			).toFixed(2),
			originalValue: +e.value,
			employeeCount: orgEmployees.total
		}));

		return { items: splitItems, total };
	}
}
