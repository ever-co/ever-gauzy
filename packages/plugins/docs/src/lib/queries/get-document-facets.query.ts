import { IQuery } from '@nestjs/cqrs';
import { GetDocumentsQueryDTO } from '../dto';

export class GetDocumentFacetsQuery implements IQuery {
	public static readonly type = '[Documents] Get Facets';
	constructor(public readonly params: GetDocumentsQueryDTO) {}
}
