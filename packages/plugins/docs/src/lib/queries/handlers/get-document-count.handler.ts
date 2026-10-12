import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DocumentService } from '../../services/document.service';
import { GetDocumentCountQuery } from '../get-document-count.query';

@QueryHandler(GetDocumentCountQuery)
export class GetDocumentCountHandler implements IQueryHandler<GetDocumentCountQuery> {
	constructor(private readonly documentService: DocumentService) {}

	/**
	 * Handles the `GetDocumentCountQuery`: count for the same filter set as the list.
	 *
	 * @param query - The query carrying the filter set.
	 * @returns The matching row count.
	 */
	public async execute(query: GetDocumentCountQuery): Promise<number> {
		return this.documentService.getDocumentCount(query.params);
	}
}
