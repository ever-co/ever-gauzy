import { ICommand } from '@nestjs/cqrs';
import { IIntegrationMapSyncScreenshot, IIntegrationMapSyncEntity } from '@gauzy/contracts';

export class IntegrationMapSyncScreenshotCommand implements ICommand {
	static readonly type = '[Integration Map] Sync Screenshot';

	constructor(readonly input: IIntegrationMapSyncEntity<IIntegrationMapSyncScreenshot>) {}
}
