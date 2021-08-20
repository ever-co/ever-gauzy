import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IEmployee, IPagination } from '@gauzy/contracts';
import { EmployeeService } from '../../employee.service';
import { WorkingEmployeeGetCommand } from './../working-employee.get.command';

@CommandHandler(WorkingEmployeeGetCommand)
export class WorkingEmployeeGetHandler implements ICommandHandler<WorkingEmployeeGetCommand> {

	constructor(
		private readonly employeeService: EmployeeService
	) {}

	public async execute(
		command: WorkingEmployeeGetCommand
	): Promise<IPagination<IEmployee>> {
		const { input } = command;
		const {
			organizationId = null,
			forMonth = new Date(),
			withUser
		} = input;

		return await this.employeeService.findWorkingEmployees(
			organizationId,
			new Date(forMonth),
			withUser
		);
	}
}