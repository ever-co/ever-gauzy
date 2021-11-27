import { ICommand } from '@nestjs/cqrs';
import { IIntegrationMapSyncScreenshot } from '@gauzy/contracts';

export class IntegrationMapSyncScreenshotCommand implements ICommand {
	static readonly type = '[Integration Map] Sync Screenshot';

	constructor(
		public readonly input: IIntegrationMapSyncScreenshot
	) {}
}
