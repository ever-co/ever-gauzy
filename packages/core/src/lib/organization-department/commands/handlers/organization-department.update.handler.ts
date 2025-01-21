import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationDepartment } from '@gauzy/contracts';
import { OrganizationDepartmentService } from '../../organization-department.service';
import { OrganizationDepartmentUpdateCommand } from '../organization-department.update.command';

@CommandHandler(OrganizationDepartmentUpdateCommand)
export class OrganizationDepartmentUpdateHandler implements ICommandHandler<OrganizationDepartmentUpdateCommand> {
	constructor(private readonly organizationDepartmentService: OrganizationDepartmentService) {}

	/**
	 *
	 * @param command
	 * @returns
	 */
	public async execute(command: OrganizationDepartmentUpdateCommand): Promise<IOrganizationDepartment> {
		const { id, input } = command;

		//This will call save() with the id so that members[] also get saved accordingly
		return this.organizationDepartmentService.create({
			id,
			...input
		});
	}
}
