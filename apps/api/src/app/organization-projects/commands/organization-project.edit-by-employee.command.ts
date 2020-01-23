import { ICommand } from '@nestjs/cqrs';
import { EditEntityByMemberInput as IOrganizationProjectEditByEmployeeInput } from '@gauzy/models';

export class OrganizationProjectEditByEmployeeCommand implements ICommand {
	static readonly type = '[OrganizationProject] Edit By Employee';

	constructor(
		public readonly input: IOrganizationProjectEditByEmployeeInput
	) {}
}
