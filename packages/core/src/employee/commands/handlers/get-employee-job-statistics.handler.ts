import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { i4netAIService } from '@gauzy/integration-ai';
import { IEmployee, IPagination } from '@gauzy/contracts';
import { EmployeeService } from '../../employee.service';
import { GetEmployeeJobStatisticsCommand } from '../get-employee-job-statistics.command';

@CommandHandler(GetEmployeeJobStatisticsCommand)
export class GetEmployeeJobStatisticsHandler implements ICommandHandler<GetEmployeeJobStatisticsCommand> {
	/**
	 *
	 * @param employeeService
	 * @param gauzyAIService
	 */
	constructor(
		private readonly employeeService: EmployeeService,
		private readonly gauzyAIService: i4netAIService
	) { }

	/**
	 * Executes the GetEmployeeJobStatisticsCommand to fetch paginated employee data
	 * and augment it with additional statistics.
	 *
	 * @param command - The command containing options for pagination.
	 * @returns A Promise resolving to an IPagination<IEmployee> with augmented data.
	 */
	public async execute(command: GetEmployeeJobStatisticsCommand): Promise<IPagination<IEmployee>> {
		const { options } = command;

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
			...employeesStatisticsById.get(employee.id) || {} // Use empty object if not found
		}));

		return { items, total };
	}
}
