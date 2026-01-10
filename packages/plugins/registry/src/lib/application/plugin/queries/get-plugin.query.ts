import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';
import { PluginQueryOptions } from '../../../shared';

export class GetPluginQuery implements IQuery {
	public static readonly type = '[Plugin] Get';
	constructor(public readonly id: ID, public readonly options: PluginQueryOptions) {}
}
