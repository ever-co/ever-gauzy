import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IEmployee } from '@gauzy/contracts';
import { EmployeeService } from '../../employee.service';
import { EmployeeGetCommand } from '../employee.get.command';

@CommandHandler(EmployeeGetCommand)
export class EmployeeGetHandler implements ICommandHandler<EmployeeGetCommand> {

	constructor(
		private readonly employeeService: EmployeeService
	) { }

	/**
	 * Executes the given command to retrieve an employee based on provided input.
	 *
	 * @param command The command containing the input to fetch an employee.
	 * @returns A promise resolving to an IEmployee instance.
	 */
	public async execute(command: EmployeeGetCommand): Promise<IEmployee> {
		const { input } = command;
		return await this.employeeService.findOneByOptions(input);
	}
}
