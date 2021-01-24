import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateEntityByMembersHandler } from '../../../shared';
import { OrganizationContactService } from '../../organization-contact.service';
import { OrganizationContactEditByEmployeeCommand } from '../organization-contact.edit-by-employee.command';

@CommandHandler(OrganizationContactEditByEmployeeCommand)
export class OrganizationContactEditByEmployeeHandler
	extends UpdateEntityByMembersHandler
	implements ICommandHandler<OrganizationContactEditByEmployeeCommand> {
	constructor(
		private readonly organizationContactService: OrganizationContactService
	) {
		super(organizationContactService);
	}

	public async execute(
		command: OrganizationContactEditByEmployeeCommand
	): Promise<any> {
		return this.executeCommand(command.input);
	}
}
