import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateEntityByMembersHandler } from '../../../shared';
import { OrganizationProjectService } from '../../organization-project.service';
import { OrganizationProjectEditByEmployeeCommand } from '../organization-project.edit-by-employee.command';

@CommandHandler(OrganizationProjectEditByEmployeeCommand)
export class OrganizationProjectEditByEmployeeHandler
	extends UpdateEntityByMembersHandler
	implements ICommandHandler<OrganizationProjectEditByEmployeeCommand> {
	constructor(
		private readonly organizationProjectService: OrganizationProjectService
	) {
		super(organizationProjectService);
	}

	public async execute(
		command: OrganizationProjectEditByEmployeeCommand
	): Promise<any> {
		return this.executeCommand(command.input);
	}
}
