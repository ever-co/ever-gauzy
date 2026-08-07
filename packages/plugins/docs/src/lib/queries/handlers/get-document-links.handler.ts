import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IDocumentLink, IPagination } from '@gauzy/contracts';
import { DocumentLinkService } from '../../services/document-link.service';
import { GetDocumentLinksQuery } from '../get-document-links.query';

@QueryHandler(GetDocumentLinksQuery)
export class GetDocumentLinksHandler implements IQueryHandler<GetDocumentLinksQuery> {
	constructor(private readonly documentLinkService: DocumentLinkService) {}

	/**
	 * Handles the `GetDocumentLinksQuery`, serving both directions: links attached to one
	 * business record (`entity` + `entityId`) or everything one document is attached to.
	 *
	 * @param query - The query carrying the direction filter.
	 * @returns The matching links.
	 */
	public async execute(query: GetDocumentLinksQuery): Promise<IPagination<IDocumentLink>> {
		const { entity, entityId, documentId, organizationId } = query.filter;
		if (documentId) {
			return this.documentLinkService.getLinksForDocument(documentId);
		}
		return this.documentLinkService.getLinksForEntity(entity, entityId, organizationId);
	}
}
