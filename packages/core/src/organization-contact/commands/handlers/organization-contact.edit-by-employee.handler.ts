import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateEntityByMembersHandler } from '../../../shared/handlers';
import { OrganizationContactService } from '../../organization-contact.service';
import { OrganizationContactEditByEmployeeCommand } from '../organization-contact.edit-by-employee.command';

@CommandHandler(OrganizationContactEditByEmployeeCommand)
export class OrganizationContactEditByEmployeeHandler extends UpdateEntityByMembersHandler
	implements ICommandHandler<OrganizationContactEditByEmployeeCommand> {

	constructor(
		protected readonly organizationContactService: OrganizationContactService
	) {
		super(organizationContactService);
	}

	public async execute(
		command: OrganizationContactEditByEmployeeCommand
	): Promise<any> {
		const { input } = command;
		return await this.executeCommand(input);
	}
}