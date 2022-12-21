import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateEntityByMembersHandler } from '../../../shared/handlers';
import { OrganizationProjectService } from '../../organization-project.service';
import { OrganizationProjectEditByEmployeeCommand } from '../organization-project.edit-by-employee.command';

@CommandHandler(OrganizationProjectEditByEmployeeCommand)
export class OrganizationProjectEditByEmployeeHandler extends UpdateEntityByMembersHandler
	implements ICommandHandler<OrganizationProjectEditByEmployeeCommand> {

	constructor(
		protected readonly organizationProjectService: OrganizationProjectService
	) {
		super(organizationProjectService);
	}

	public async execute(
		command: OrganizationProjectEditByEmployeeCommand
	): Promise<any> {
		const { input } = command;
		return await this.executeCommand(input);
	}
}
