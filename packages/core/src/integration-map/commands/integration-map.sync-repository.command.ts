import { IIntegrationMapSyncRepository } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class IntegrationMapSyncRepositoryCommand implements ICommand {
	static readonly type = '[Integration Map] Sync Repository';

	constructor(
		public readonly input: IIntegrationMapSyncRepository
	) { }
}
