import { ICommand } from '@nestjs/cqrs';
import { IIntegrationFilter } from '@gauzy/models';

export class IntegrationGetCommand implements ICommand {
	static readonly type = '[Integration] Get Integrations';

	constructor(public readonly input: IIntegrationFilter) {}
}
