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
		const { input, languageCode, originUrl } = command;
		const results = [];
		try {
			for (const entity of input) {
				const result = await this.commandBus.execute(
					new EmployeeCreateCommand(entity, languageCode, originUrl)
				);
				results.push(result);
			}
			return results;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
