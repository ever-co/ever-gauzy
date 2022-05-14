import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GauzyAIService } from '@gauzy/integration-ai';
import { indexBy } from 'underscore';
import { EmployeeService } from '../../employee.service';
import { GetEmployeeJobStatisticsCommand } from '../get-employee-job-statistics.command';

@CommandHandler(GetEmployeeJobStatisticsCommand)
export class GetEmployeeJobStatisticsHandler
	implements ICommandHandler<GetEmployeeJobStatisticsCommand> {
	constructor(
		private readonly employeeService: EmployeeService,
		private readonly gauzyAIService: GauzyAIService
	) {}

	public async execute(command: GetEmployeeJobStatisticsCommand) {
		const { request } = command;

		let { items, total } = await this.employeeService.paginate(request);
		const employeesStatistics = await this.gauzyAIService.getEmployeesStatistics();
		const employeesStatisticsById = indexBy(
			employeesStatistics,
			'employeeId'
		);

		items = items.map((employee) => {
			const employeesStatistic = employeesStatisticsById[employee.id];
			return {
				...employee,
				...employeesStatistic
			};
		});
		return { items, total };
	}
}
