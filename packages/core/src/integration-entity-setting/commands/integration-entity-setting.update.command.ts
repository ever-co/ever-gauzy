import { ICommand } from '@nestjs/cqrs';
import { IIntegrationEntitySetting } from '@gauzy/contracts';

export class IntegrationEntitySettingUpdateCommand implements ICommand {
	static readonly type = '[Integration Entity Setting] Update By Integration';

	constructor(
		public readonly integrationId: string,
		public readonly input: IIntegrationEntitySetting | IIntegrationEntitySetting[],
	) {}
}
