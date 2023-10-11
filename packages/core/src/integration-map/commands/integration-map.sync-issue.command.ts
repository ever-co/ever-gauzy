import { ICommand } from '@nestjs/cqrs';
import { IIntegrationMapSyncIssue } from '@gauzy/contracts';

export class IntegrationMapSyncIssueCommand implements ICommand {
	static readonly type = '[Integration Map] Sync Issue';

	constructor(
		public readonly request: IIntegrationMapSyncIssue
	) { }
}
