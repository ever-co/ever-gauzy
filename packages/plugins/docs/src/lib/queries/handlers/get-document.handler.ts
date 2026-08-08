import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IDocument } from '@gauzy/contracts';
import { DocumentService } from '../../services/document.service';
import { GetDocumentQuery } from '../get-document.query';

@QueryHandler(GetDocumentQuery)
export class GetDocumentHandler implements IQueryHandler<GetDocumentQuery> {
	constructor(private readonly documentService: DocumentService) {}

	/**
	 * Handles the `GetDocumentQuery`: single document with optional relations, tenant/org +
	 * visibility scoped (invisible ids resolve to 404, never 403).
	 *
	 * @param query - The query carrying the id and relations.
	 * @returns The scoped document.
	 */
	public async execute(query: GetDocumentQuery): Promise<IDocument> {
		return this.documentService.findOneScoped(query.id, query.relations);
	}
}
