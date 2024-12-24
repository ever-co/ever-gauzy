import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateEntityByMembersHandler } from '../../../shared/handlers';
import { OrganizationContactService } from '../../organization-contact.service';
import { OrganizationContactEditByEmployeeCommand } from '../organization-contact.edit-by-employee.command';

@CommandHandler(OrganizationContactEditByEmployeeCommand)
export class OrganizationContactEditByEmployeeHandler extends UpdateEntityByMembersHandler
	implements ICommandHandler<OrganizationContactEditByEmployeeCommand> {

	constructor(readonly organizationContactService: OrganizationContactService) {
		super(organizationContactService);
	}

	/**
	 * Executes the organization contact edit command by an employee.
	 *
	 * @param command - The command containing the input for editing the organization contact.
	 * @returns A promise that resolves with the result of the command execution.
	 */
	public async execute(
		command: OrganizationContactEditByEmployeeCommand
	): Promise<any> {
		// Extract the input from the command and execute the command logic
		return this.executeCommand(command.input);
	}
}
