import { ICommand } from '@nestjs/cqrs';
import { FindOneOptions } from 'typeorm';

export class IntegrationSettingGetCommand implements ICommand {
	static readonly type = '[Integration Setting] Get Integration Setting';

	constructor(public readonly input: FindOneOptions) {}
}
