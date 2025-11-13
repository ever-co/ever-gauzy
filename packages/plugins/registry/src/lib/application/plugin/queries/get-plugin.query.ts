import { ID } from '@gauzy/contracts';
import { BaseQueryDTO } from '@gauzy/core';
import { IQuery } from '@nestjs/cqrs';
import { IPlugin } from '../../../shared';

export class GetPluginQuery implements IQuery {
	public static readonly type = '[Plugin] Get';
	constructor(public readonly id: ID, public readonly options: BaseQueryDTO<IPlugin>) {}
}
