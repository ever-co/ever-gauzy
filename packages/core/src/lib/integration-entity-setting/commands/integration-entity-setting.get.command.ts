import { IIntegrationTenant } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class IntegrationEntitySettingGetCommand implements ICommand {
	static readonly type = '[Integration Entity Setting] Get By Integration';

	constructor(
		public readonly integrationId: IIntegrationTenant['id']
	) { }
}
