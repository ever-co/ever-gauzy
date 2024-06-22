import { ICommand } from '@nestjs/cqrs';
import { IOrganizationCreateInput } from '@gauzy/contracts';

export class i4netCloudOrganizationMigrateCommand implements ICommand {
	static readonly type = '[i4net Cloud] Organization Migrate';

	constructor(
		public readonly input: IOrganizationCreateInput,
		public readonly token: string
	) { }
}
