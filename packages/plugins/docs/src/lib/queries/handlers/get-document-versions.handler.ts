import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IDocumentVersion, IPagination } from '@gauzy/contracts';
import { DocumentService } from '../../services/document.service';
import { DocumentVersionService } from '../../services/document-version.service';
import { GetDocumentVersionsQuery } from '../get-document-versions.query';

@QueryHandler(GetDocumentVersionsQuery)
export class GetDocumentVersionsHandler implements IQueryHandler<GetDocumentVersionsQuery> {
	constructor(
		private readonly documentService: DocumentService,
		private readonly documentVersionService: DocumentVersionService
	) {}

	/**
	 * Handles the `GetDocumentVersionsQuery`: paginated version history, newest first — the
	 * list projection never returns content columns.
	 *
	 * @param query - The query carrying the document id and pagination.
	 * @returns Paginated version list projections.
	 */
	public async execute(query: GetDocumentVersionsQuery): Promise<IPagination<IDocumentVersion>> {
		const document = await this.documentService.findOneScoped(query.id);
		return this.documentVersionService.getVersions(document, query.params);
	}
}
