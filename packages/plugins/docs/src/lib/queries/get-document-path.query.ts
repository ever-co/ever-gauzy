import { IQuery } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class GetDocumentPathQuery implements IQuery {
	public static readonly type = '[Documents] Get Path';
	constructor(public readonly id: ID) {}
}
