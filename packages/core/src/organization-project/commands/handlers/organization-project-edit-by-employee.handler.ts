import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationProjectService } from '../../organization-project.service';
import { OrganizationProjectEditByEmployeeCommand } from '../organization-project-edit-by-employee.command';

@CommandHandler(OrganizationProjectEditByEmployeeCommand)
export class OrganizationProjectEditByEmployeeHandler
	implements ICommandHandler<OrganizationProjectEditByEmployeeCommand>
{
	constructor(readonly organizationProjectService: OrganizationProjectService) {}

	/**
	 * Executes the organization project edit command by an employee.
	 *
	 * @param command - The command containing the input for editing the organization project.
	 * @returns A promise that resolves with the result of the command execution.
	 */
	public async execute(command: OrganizationProjectEditByEmployeeCommand): Promise<any> {
		// Extracts the input from the command and executes the command logic
		const { input } = command;

		// Update the organization project by an employee
		return await this.organizationProjectService.updateByEmployee(input);
	}
}
