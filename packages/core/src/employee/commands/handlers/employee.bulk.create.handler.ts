import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { IEmployee, IEmployeeCreateInput } from '@gauzy/contracts';
import { EmployeeBulkCreateCommand } from '../employee.bulk.create.command';
import { EmployeeCreateCommand } from '../employee.create.command';

@CommandHandler(EmployeeBulkCreateCommand)
export class EmployeeBulkCreateHandler
	implements ICommandHandler<EmployeeBulkCreateCommand> {

	constructor(
		private readonly commandBus: CommandBus
	) {}

	public async execute(
		command: EmployeeBulkCreateCommand
	): Promise<IEmployee[]> {
		try {
			const { input, languageCode, originalUrl } = command;
			return await Promise.all(
				input.map(
					async (entity: IEmployeeCreateInput) => {
						return await this.commandBus.execute(
							new EmployeeCreateCommand(
								entity,
								languageCode,
								originalUrl
							)
						);
					}
				)
			);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
