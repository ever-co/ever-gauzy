import { IQuery } from '@nestjs/cqrs';
import { FindOneOptions } from 'typeorm';
import { ISoundshot } from '../models/soundshot.model';
import { ID } from '@gauzy/contracts';

export class GetSoundshotQuery implements IQuery {
	public static readonly type = '[Soundshot] Get';
	constructor(public readonly id: ID, public readonly options: FindOneOptions<ISoundshot>) { }
}
