import { IEmployee } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmployeeUpdateCommand } from './../employee.update.command';
import { EmployeeService } from './../../employee.service';
import { BadRequestException } from '@nestjs/common';

@CommandHandler(EmployeeUpdateCommand)
export class EmployeeUpdateHandler
	implements ICommandHandler<EmployeeUpdateCommand> {
	constructor(
		private readonly employeeService: EmployeeService,
	) {}

	public async execute(command: EmployeeUpdateCommand): Promise<IEmployee> {
		const { input } = command;
		const { id } = input;

		try {
			//We are using create here because create calls the method save()
			//We need save() to save ManyToMany relations
			return await this.employeeService.create({
				id,
				...input
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
