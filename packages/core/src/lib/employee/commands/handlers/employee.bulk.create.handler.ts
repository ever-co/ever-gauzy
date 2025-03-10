import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, Logger } from '@nestjs/common';
import { IEmployee } from '@gauzy/contracts';
import { EmployeeBulkCreateCommand } from '../employee.bulk.create.command';
import { EmployeeCreateCommand } from '../employee.create.command';

@CommandHandler(EmployeeBulkCreateCommand)
export class EmployeeBulkCreateHandler implements ICommandHandler<EmployeeBulkCreateCommand> {
	private readonly logger = new Logger(`GZY - ${EmployeeBulkCreateHandler.name}`);
	constructor(private readonly commandBus: CommandBus) {}

	/**
	 * Executes a bulk create operation for employees.
	 * @param command The bulk create command containing input, language code, and origin URL.
	 * @returns A promise that resolves to an array of created employees.
	 */
	public async execute(command: EmployeeBulkCreateCommand): Promise<IEmployee[]> {
		try {
			const { input, languageCode, originUrl } = command;

			// Initialize an empty array to store the results
			const results: IEmployee[] = [];

			// Sequentially process each entity and execute the respective command
			for (const entity of input) {
				// Execute the create command for the current entity
				const result = await this.commandBus.execute(
					new EmployeeCreateCommand(entity, languageCode, originUrl)
				);

				results.push(result);
			}

			return results;
		} catch (error) {
			// Return a more descriptive error message for bulk create failure
			this.logger.error('Failed to create multiple employees', error);
			throw new BadRequestException(error.message || 'Failed to create multiple employees');
		}
	}
}
