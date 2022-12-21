import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationDepartmentEditByEmployeeCommand } from '../organization-department.edit-by-employee.command';
import { OrganizationDepartmentService } from '../../organization-department.service';
import { UpdateEntityByMembersHandler } from '../../../shared/handlers';

@CommandHandler(OrganizationDepartmentEditByEmployeeCommand)
export class OrganizationDepartmentEditByEmployeeHandler extends UpdateEntityByMembersHandler
	implements ICommandHandler<OrganizationDepartmentEditByEmployeeCommand> {

	constructor(
		protected readonly organizationDepartmentService: OrganizationDepartmentService
	) {
		super(organizationDepartmentService);
	}

	public async execute(
		command: OrganizationDepartmentEditByEmployeeCommand
	): Promise<any> {
		const { input } = command;
		return await this.executeCommand(input);
	}
}