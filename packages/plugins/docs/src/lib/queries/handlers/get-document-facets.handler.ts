import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DocumentService } from '../../services/document.service';
import { GetDocumentFacetsQuery } from '../get-document-facets.query';

@QueryHandler(GetDocumentFacetsQuery)
export class GetDocumentFacetsHandler implements IQueryHandler<GetDocumentFacetsQuery> {
	constructor(private readonly documentService: DocumentService) {}

	/**
	 * Handles the `GetDocumentFacetsQuery`: facet counts for the filter chips (each bucket
	 * computed over the *other* filters).
	 *
	 * @param query - The query carrying the filter set.
	 * @returns The facet-count envelope.
	 */
	public async execute(query: GetDocumentFacetsQuery): Promise<Record<string, any>> {
		return this.documentService.getDocumentFacets(query.params);
	}
}
