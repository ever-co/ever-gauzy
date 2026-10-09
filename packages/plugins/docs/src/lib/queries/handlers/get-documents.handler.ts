import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IDocument, IPagination } from '@gauzy/contracts';
import { DocumentService } from '../../services/document.service';
import { GetDocumentsQuery } from '../get-documents.query';

@QueryHandler(GetDocumentsQuery)
export class GetDocumentsHandler implements IQueryHandler<GetDocumentsQuery> {
	constructor(private readonly documentService: DocumentService) {}

	/**
	 * Handles the `GetDocumentsQuery`: paginated, filtered list (content columns never selected).
	 *
	 * @param query - The query carrying the filter set.
	 * @returns Paginated documents with the list projection markers.
	 */
	public async execute(query: GetDocumentsQuery): Promise<IPagination<IDocument>> {
		return this.documentService.getDocuments(query.params);
	}
}
