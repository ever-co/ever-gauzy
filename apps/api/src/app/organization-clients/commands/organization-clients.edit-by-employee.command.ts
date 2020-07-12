import { ICommand } from '@nestjs/cqrs';
import { EditEntityByMemberInput as IOrganizationDepartmentEditByEmployeeInput } from '@gauzy/models';

export class OrganizationClientsEditByEmployeeCommand implements ICommand {
	static readonly type = '[OrganizationClients] Edit By Employee';

	constructor(
		public readonly input: IOrganizationDepartmentEditByEmployeeInput
	) {}
}
