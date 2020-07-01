import { ICommand } from '@nestjs/cqrs';
import { EditEntityByMemberInput as IOrganizationDepartmentEditByEmployeeInput } from '@gauzy/models';

export class OrganizationContactEditByEmployeeCommand implements ICommand {
	static readonly type = '[OrganizationContact] Edit By Employee';

	constructor(
		public readonly input: IOrganizationDepartmentEditByEmployeeInput
	) {}
}
