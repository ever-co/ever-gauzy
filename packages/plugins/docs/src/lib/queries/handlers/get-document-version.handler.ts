import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IDocumentVersion } from '@gauzy/contracts';
import { DocumentService } from '../../services/document.service';
import { DocumentVersionService } from '../../services/document-version.service';
import { GetDocumentVersionQuery } from '../get-document-version.query';

@QueryHandler(GetDocumentVersionQuery)
export class GetDocumentVersionHandler implements IQueryHandler<GetDocumentVersionQuery> {
	constructor(
		private readonly documentService: DocumentService,
		private readonly documentVersionService: DocumentVersionService
	) {}

	/**
	 * Handles the `GetDocumentVersionQuery`: one full snapshot incl. content columns.
	 *
	 * @param query - The query carrying the document and version ids.
	 * @returns The full snapshot.
	 */
	public async execute(query: GetDocumentVersionQuery): Promise<IDocumentVersion> {
		const document = await this.documentService.findOneScoped(query.id);
		return this.documentVersionService.getVersion(document, query.versionId);
	}
}
