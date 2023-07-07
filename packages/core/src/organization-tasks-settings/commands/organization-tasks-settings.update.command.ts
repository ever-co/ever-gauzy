import { IOrganizationTasksSettingsUpdateInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class OrganizationTasksSettingsUpdateCommand implements ICommand {
	static readonly type = '[OrganizationTasksSettings] Update';

	constructor(
		public readonly id: string,
		public readonly input: IOrganizationTasksSettingsUpdateInput
	) {}
}
