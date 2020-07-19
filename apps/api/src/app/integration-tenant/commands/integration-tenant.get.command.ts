import { ICommand } from '@nestjs/cqrs';
import { FindOneOptions } from 'typeorm';

export class IntegrationTenantGetCommand implements ICommand {
	static readonly type = '[Integration] Get Integration';

	constructor(public readonly input: FindOneOptions) {}
}
