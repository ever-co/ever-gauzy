import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationDepartmentEditByEmployeeCommand } from '../organization-department.edit-by-employee.command';
import { OrganizationDepartmentService } from '../../organization-department.service';
import { UpdateEntityByMembersHandler } from '../../../shared';

@CommandHandler(OrganizationDepartmentEditByEmployeeCommand)
export class OrganizationDepartmentEditByEmployeeHandler
	extends UpdateEntityByMembersHandler
	implements ICommandHandler<OrganizationDepartmentEditByEmployeeCommand> {
	constructor(
		private readonly organizationDepartmentService: OrganizationDepartmentService
	) {
		super(organizationDepartmentService);
	}

	public async execute(
		command: OrganizationDepartmentEditByEmployeeCommand
	): Promise<any> {
		return this.executeCommand(command.input);
	}
}
