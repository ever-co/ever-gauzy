import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IEmployee } from '@gauzy/contracts';
import { GauzyAIService } from '@gauzy/integration-ai';
import { UpdateResult } from 'typeorm';
import { EmployeeService } from '../../employee.service';
import { UpdateEmployeeJobSearchStatusCommand } from '../update-employee-job-search-status.command';

@CommandHandler(UpdateEmployeeJobSearchStatusCommand)
export class UpdateEmployeeJobSearchStatusHandler
	implements ICommandHandler<UpdateEmployeeJobSearchStatusCommand> {

	constructor(
		private readonly employeeService: EmployeeService,
		private readonly gauzyAIService: GauzyAIService
	) {}

	public async execute(command: UpdateEmployeeJobSearchStatusCommand): Promise<IEmployee | UpdateResult> {
		const { employeeId, request } = command;

		this.gauzyAIService.updateEmployeeStatus(
			employeeId,
			request.isJobSearchActive
		);
		return await this.employeeService.update(employeeId, {
			isJobSearchActive: request.isJobSearchActive
		});
	}
}
