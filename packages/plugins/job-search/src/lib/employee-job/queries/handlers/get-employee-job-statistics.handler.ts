import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GauzyAIService } from '@gauzy/plugin-integration-ai';
import { IEmployee, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { EmployeeService, RequestContext } from '@gauzy/core';
import { GetEmployeeJobStatisticsQuery } from '../get-employee-job-statistics.query';

@QueryHandler(GetEmployeeJobStatisticsQuery)
export class GetEmployeeJobStatisticsHandler implements IQueryHandler<GetEmployeeJobStatisticsQuery> {
	/**
	 *
	 * @param employeeService
	 * @param gauzyAIService
	 */
	constructor(private readonly employeeService: EmployeeService, private readonly gauzyAIService: GauzyAIService) {}

	/**
	 * Executes the GetEmployeeJobStatisticsQuery to fetch paginated employee data
	 * and augment it with additional statistics.
	 *
	 * @param query - The query containing options for pagination.
	 * @returns A Promise resolving to an IPagination<IEmployee> with augmented data.
	 */
	public async execute(query: GetEmployeeJobStatisticsQuery): Promise<IPagination<IEmployee>> {
		const { options } = query;

		// Check for permission CHANGE_SELECTED_EMPLOYEE
		if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			// Filter by current employee ID if the permission is not present
			options.where.id = RequestContext.currentEmployeeId();
		}

		// Use Promise.all for concurrent requests
		const [paginationResult, employeesStatistics] = await Promise.all([
			this.employeeService.paginate(options),
			this.gauzyAIService.getEmployeesStatistics()
		]);

		let { items, total } = paginationResult;

		// Create a map for faster lookup
		const employeesStatisticsById = new Map<string, any>(
			employeesStatistics.map((statistic: any) => [statistic.employeeId, statistic])
		);

		// Combine mappings into a single map function
		items = items.map((employee: IEmployee) => ({
			...employee,
			...(employeesStatisticsById.get(employee.id) || {}) // Use empty object if not found
		}));

		return { items, total };
	}
}
