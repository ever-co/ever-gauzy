import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmployeeService } from '../../employee.service';
import { IEmployee } from '@gauzy/models';
import { EmployeeGetCommand } from '../employee.get.command';

@CommandHandler(EmployeeGetCommand)
export class EmployeeGetHandler implements ICommandHandler<EmployeeGetCommand> {
	constructor(private readonly employeeService: EmployeeService) {}

	public async execute(command: EmployeeGetCommand): Promise<IEmployee> {
		const { input } = command;

		return await this.employeeService.findOne(input);
	}
}
