import { IVideo } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';
import { PaginationParams } from '@gauzy/core';

export class GetVideosQuery implements IQuery {
	public static readonly type = '[Videos] Get All';

	constructor(public readonly params: PaginationParams<IVideo>) {}
}
