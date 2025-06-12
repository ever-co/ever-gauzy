import { IQuery } from '@nestjs/cqrs';
import { FindOneOptions } from 'typeorm';
import { ICamshot } from '../models/camshot.model';
import { ID } from '@gauzy/contracts';

export class GetCamshotQuery implements IQuery {
	public static readonly type = '[Camshot] Get';
	constructor(public readonly id: ID, public readonly options: FindOneOptions<ICamshot>) { }
}
