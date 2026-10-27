import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationDepartment } from '@gauzy/contracts';
import { OrganizationDepartmentService } from '../../organization-department.service';
import { OrganizationDepartmentUpdateCommand } from '../organization-department.update.command';
import { withFormerEmployeeLinks } from '../../../employee/former-employees';

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

		// The members whose work ended are never listed (`former-employees.ts`), so an edit of the members never
		// sends them back: they stay linked, and Back to Work restores them
		if (Array.isArray(input.members)) {
			const { members: linked = [] } = await this.organizationDepartmentService.findOneByIdString(id, {
				relations: { members: true }
			});
			input.members = withFormerEmployeeLinks(input.members, linked);
		}

		//This will call save() with the id so that members[] also get saved accordingly
		return this.organizationDepartmentService.create({ ...input, id });
	}
}
