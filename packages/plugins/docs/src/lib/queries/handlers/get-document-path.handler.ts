import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DocumentPathService, IDocumentPathSegment } from '../../services/document-path.service';
import { GetDocumentPathQuery } from '../get-document-path.query';

@QueryHandler(GetDocumentPathQuery)
export class GetDocumentPathHandler implements IQueryHandler<GetDocumentPathQuery> {
	constructor(private readonly documentPathService: DocumentPathService) {}

	/**
	 * Handles the `GetDocumentPathQuery`: the breadcrumb chain root → document, with every
	 * ancestor the requester cannot read masked as `{ id: null, restricted: true }`.
	 *
	 * @param query - The query carrying the document id.
	 * @returns The breadcrumb segments.
	 */
	public async execute(query: GetDocumentPathQuery): Promise<IDocumentPathSegment[]> {
		return this.documentPathService.getPath(query.id);
	}
}
