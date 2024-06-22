import { ICommand } from '@nestjs/cqrs';
import { ITenantCreateInput } from '@gauzy/contracts';

export class i4netCloudTenantMigrateCommand implements ICommand {
	static readonly type = '[i4net Cloud] Tenant Migrate';

	constructor(
		public readonly input: ITenantCreateInput,
		public readonly token: string
	) { }
}
