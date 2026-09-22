import { IQuery } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class GetDocumentVersionQuery implements IQuery {
	public static readonly type = '[Document Versions] Get One';
	constructor(public readonly id: ID, public readonly versionId: ID) {}
}
