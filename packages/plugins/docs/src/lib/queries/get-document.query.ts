import { IQuery } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class GetDocumentQuery implements IQuery {
	public static readonly type = '[Documents] Get One';
	constructor(public readonly id: ID, public readonly relations: string[] = []) {}
}
