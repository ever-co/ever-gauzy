import { IQuery } from '@nestjs/cqrs';
import { BaseQueryDTO } from '@gauzy/core';
import { IVideo } from '../video.model';

export class GetVideosQuery implements IQuery {
	public static readonly type = '[Videos] Get All';

	constructor(public readonly params: BaseQueryDTO<IVideo>) {}
}
