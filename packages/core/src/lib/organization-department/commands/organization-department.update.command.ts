import { IOrganizationDepartmentCreateInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class OrganizationDepartmentUpdateCommand implements ICommand {
	static readonly type = '[OrganizationDepartment] Update';

	constructor(
		public readonly id: string,
		public readonly input: IOrganizationDepartmentCreateInput
	) {}
}
