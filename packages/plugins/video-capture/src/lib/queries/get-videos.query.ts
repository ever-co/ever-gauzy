import { IQuery } from '@nestjs/cqrs';
import { PaginationParams } from '@gauzy/core';
import { IVideo } from '../video.model';

export class GetVideosQuery implements IQuery {
	public static readonly type = '[Videos] Get All';

	constructor(public readonly params: PaginationParams<IVideo>) {}
}
