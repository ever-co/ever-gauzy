import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';
import { FindOneOptions } from 'typeorm';
import { IPlugin } from '../../shared/models/plugin.model';

export class GetPluginQuery implements IQuery {
	public static readonly type = '[Plugin] Get';
	constructor(public readonly id: ID, public readonly options: FindOneOptions<IPlugin>) {}
}
