import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmployeeService } from '../../employee.service';
import { UpdateEmployeeJobSearchStatusCommand } from '../update-employee-job-search-status.command';
import { GauzyAIService } from '@gauzy/integration-ai';

@CommandHandler(UpdateEmployeeJobSearchStatusCommand)
export class UpdateEmployeeJobSearchStatusHandler
	implements ICommandHandler<UpdateEmployeeJobSearchStatusCommand> {
	constructor(
		private readonly employeeService: EmployeeService,
		private readonly gauzyAIService: GauzyAIService
	) {}

	public async execute(command: UpdateEmployeeJobSearchStatusCommand) {
		const { employeeId, request } = command;

		this.gauzyAIService.updateEmployeeStatus(
			employeeId,
			request.isJobSearchActive
		);
		return this.employeeService.update(employeeId, request);
	}
}
