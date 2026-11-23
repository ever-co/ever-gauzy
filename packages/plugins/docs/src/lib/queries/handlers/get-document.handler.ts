import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IDocument } from '@gauzy/contracts';
import { DocumentService } from '../../services/document.service';
import { GetDocumentQuery } from '../get-document.query';

@QueryHandler(GetDocumentQuery)
export class GetDocumentHandler implements IQueryHandler<GetDocumentQuery> {
	constructor(private readonly documentService: DocumentService) {}

	/**
	 * Handles the `GetDocumentQuery`: single document with optional relations, tenant/org +
	 * visibility scoped (invisible ids resolve to 404, never 403). An explicit `organizationId`
	 * (the client's selected organization) wins over the request context's.
	 *
	 * The answer says whether the caller may change the document (`canWrite`): reading a page does not mean
	 * writing it, and a client that only learns it from a refused save has let the person type first.
	 *
	 * @param query - The query carrying the id, relations and optional organization scope.
	 * @returns The scoped document, with `canWrite` for this caller.
	 */
	public async execute(query: GetDocumentQuery): Promise<IDocument> {
		const document = await this.documentService.findOneScoped(query.id, query.relations, query.organizationId);
		document.canWrite = await this.documentService.canWrite(document);
		return document;
	}
}
