import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { IEmployee, IEmployeeCreateInput } from '@gauzy/contracts';
import { EmployeeBulkCreateCommand } from '../employee.bulk.create.command';
import { EmployeeCreateCommand } from '../employee.create.command';

@CommandHandler(EmployeeBulkCreateCommand)
export class EmployeeBulkCreateHandler implements ICommandHandler<EmployeeBulkCreateCommand> {
	constructor(private readonly commandBus: CommandBus) {}

	/**
	 * Executes a bulk create operation for employees.
	 * @param command The bulk create command containing input, language code, and origin URL.
	 * @returns A promise that resolves to an array of created employees.
	 */
	public async execute(command: EmployeeBulkCreateCommand): Promise<IEmployee[]> {
		try {
			const { input, languageCode, originUrl } = command;
			// Use Promise.all to execute each creation command asynchronously
			const results = await Promise.all(
				input.map(async (entity: IEmployeeCreateInput) => {
					return await this.commandBus.execute(new EmployeeCreateCommand(entity, languageCode, originUrl));
				})
			);
			// Return the results array containing created employees
			return results;
		} catch (error) {
			// If an error occurs, throw a BadRequestException with the error message
			throw new BadRequestException(error);
		}
	}
}
