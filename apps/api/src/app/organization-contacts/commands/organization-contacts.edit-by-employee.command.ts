import { ICommand } from '@nestjs/cqrs';
import { EditEntityByMemberInput as IOrganizationDepartmentEditByEmployeeInput } from '@gauzy/models';

export class OrganizationContactsEditByEmployeeCommand implements ICommand {
	static readonly type = '[OrganizationContacts] Edit By Employee';

	constructor(
		public readonly input: IOrganizationDepartmentEditByEmployeeInput
	) {}
}
