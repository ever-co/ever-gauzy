import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateEntityByMembersHandler } from '../../../shared';
import { OrganizationContactsService } from '../../organization-contacts.service';
import { OrganizationContactsEditByEmployeeCommand } from '../organization-contacts.edit-by-employee.command';

@CommandHandler(OrganizationContactsEditByEmployeeCommand)
export class OrganizationContactsEditByEmployeeHandler
	extends UpdateEntityByMembersHandler
	implements ICommandHandler<OrganizationContactsEditByEmployeeCommand> {
	constructor(
		private readonly organizationContactsService: OrganizationContactsService
	) {
		super(organizationContactsService);
	}

	public async execute(
		command: OrganizationContactsEditByEmployeeCommand
	): Promise<any> {
		return this.executeCommand(command.input);
	}
}
