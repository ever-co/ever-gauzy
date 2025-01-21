import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationDepartmentEditByEmployeeCommand } from '../organization-department.edit-by-employee.command';
import { OrganizationDepartmentService } from '../../organization-department.service';
import { UpdateEntityByMembersHandler } from '../../../shared/handlers';

@CommandHandler(OrganizationDepartmentEditByEmployeeCommand)
export class OrganizationDepartmentEditByEmployeeHandler
	extends UpdateEntityByMembersHandler
	implements ICommandHandler<OrganizationDepartmentEditByEmployeeCommand>
{
	constructor(readonly organizationDepartmentService: OrganizationDepartmentService) {
		super(organizationDepartmentService);
	}

	/**
	 * Executes the organization department edit command by an employee.
	 *
	 * @param command - The command containing the input for editing the organization department.
	 * @returns A promise that resolves with the result of the command execution.
	 */
	public async execute(command: OrganizationDepartmentEditByEmployeeCommand): Promise<any> {
		// Extract the input from the command and execute the command logic
		return this.executeCommand(command.input);
	}
}
