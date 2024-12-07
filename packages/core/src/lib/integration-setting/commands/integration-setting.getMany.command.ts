import { ICommand } from '@nestjs/cqrs';
import { FindManyOptions } from 'typeorm';

export class IntegrationSettingGetManyCommand implements ICommand {
	static readonly type = '[Integration Setting] Get Many Integration Setting';

	constructor(public readonly input: FindManyOptions) {}
}
