import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateEntityByMembersHandler } from '../../../shared';
import { OrganizationClientsService } from '../../organization-clients.service';
import { OrganizationClientsEditByEmployeeCommand } from '../organization-clients.edit-by-employee.command';

@CommandHandler(OrganizationClientsEditByEmployeeCommand)
export class OrganizationClientsEditByEmployeeHandler
	extends UpdateEntityByMembersHandler
	implements ICommandHandler<OrganizationClientsEditByEmployeeCommand> {
	constructor(
		private readonly organizationClientsService: OrganizationClientsService
	) {
		super(organizationClientsService);
	}

	public async execute(
		command: OrganizationClientsEditByEmployeeCommand
	): Promise<any> {
		return this.executeCommand(command.input);
	}
}
