import { IQuery } from '@nestjs/cqrs';
import { GetDocumentsQueryDTO } from '../dto';

export class GetDocumentStatsQuery implements IQuery {
	public static readonly type = '[Documents] Get Stats';
	constructor(public readonly params: GetDocumentsQueryDTO) {}
}
