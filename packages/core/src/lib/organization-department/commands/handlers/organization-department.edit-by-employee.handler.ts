import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationDepartmentEditByEmployeeCommand } from '../organization-department.edit-by-employee.command';
import { OrganizationDepartmentService } from '../../organization-department.service';
// Imported from its own module rather than from the `shared/handlers` barrel: the barrel reaches
// `core/index.ts`, which reaches `core.module`, which imports every domain module including this one — so
// entering the graph here yields an undefined base class and the suite fails to load.
import { UpdateEntityByMembersHandler } from '../../../shared/handlers/update-entity.by-member.handler';

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
