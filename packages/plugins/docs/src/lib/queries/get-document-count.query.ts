import { IQuery } from '@nestjs/cqrs';
import { GetDocumentsQueryDTO } from '../dto';

export class GetDocumentCountQuery implements IQuery {
	public static readonly type = '[Documents] Get Count';
	constructor(public readonly params: GetDocumentsQueryDTO) {}
}
