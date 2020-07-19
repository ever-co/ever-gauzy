import { ICommand } from '@nestjs/cqrs';
import { IIntegrationMapSyncProject } from '@gauzy/models';

export class IntegrationMapSyncProjectCommand implements ICommand {
	static readonly type = '[Integration Map] Sync Project';

	constructor(public readonly input: IIntegrationMapSyncProject) {}
}
