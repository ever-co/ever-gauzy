import { IOrganizationRecurringExpenseForEmployeeOutput, IPagination } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EmployeeService } from '../../../employee/employee.service';
import { OrganizationService } from '../../../organization/organization.service';
import { OrganizationRecurringExpenseService } from '../../organization-recurring-expense.service';
import { OrganizationRecurringExpenseFindSplitExpenseQuery } from '../organization-recurring-expense.find-split-expense.query';
import { MoreThanOrEqual, IsNull, LessThanOrEqual } from 'typeorm';
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

		const filterDate = new Date(year, month, 1);

		//1. Find all recurring expenses for the organization which have splitExpense = true
		const {
			items,
			total
		} = await this.organizationRecurringExpenseService.findAll({
			where: [
				{
					splitExpense: true,
					organizationId : orgId,
					startDate: LessThanOrEqual(filterDate),
					endDate: IsNull()
				},
				{
					splitExpense: true,
					organizationId : orgId,
					startDate: LessThanOrEqual(filterDate),
					endDate: MoreThanOrEqual(filterDate)
				}
			]
		});

		const organization = await this.organizationService.findOneByWhereOptions({
			id: orgId
		});

		//2. Find all employees of the organization
		const orgEmployees = await this.employeeService.findAll({
			where: {
				organizationId: organization.id
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
