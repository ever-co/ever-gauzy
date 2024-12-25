import { IQuery } from '@nestjs/cqrs';
import { FindOneOptions } from 'typeorm';
import { IVideo } from '../video.model';

export class GetVideoQuery implements IQuery {
	public static readonly type = '[Video] Get';
	constructor(public readonly id: string, public readonly options: FindOneOptions<IVideo>) {}
}
