import { ICommand } from '@nestjs/cqrs';
import { IEditEntityByMemberInput as IOrganizationDepartmentEditByEmployeeInput } from '@gauzy/contracts';

export class OrganizationContactEditByEmployeeCommand implements ICommand {
	static readonly type = '[OrganizationContact] Edit By Employee';

	constructor(
		public readonly input: IOrganizationDepartmentEditByEmployeeInput
	) {}
}
