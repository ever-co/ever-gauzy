import { ICommand } from '@nestjs/cqrs';
import { EditEntityByMemberInput as IOrganizationDepartmentEditByEmployeeInput } from '@gauzy/models';

export class OrganizationDepartmentEditByEmployeeCommand implements ICommand {
	static readonly type = '[OrganizationDepartment] Edit By Employee';

	constructor(
		public readonly input: IOrganizationDepartmentEditByEmployeeInput
	) {}
}
