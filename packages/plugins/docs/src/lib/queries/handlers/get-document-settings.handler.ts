import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IDocumentSettings } from '../../dto/document-settings.dto';
import { DocumentSettingsService } from '../../services/document-settings.service';
import { GetDocumentSettingsQuery } from '../get-document-settings.query';

@QueryHandler(GetDocumentSettingsQuery)
export class GetDocumentSettingsHandler implements IQueryHandler<GetDocumentSettingsQuery> {
	constructor(private readonly documentSettingsService: DocumentSettingsService) {}

	/**
	 * Handles the `GetDocumentSettingsQuery`: org defaults + read-only deployment capabilities.
	 *
	 * @param query - The query carrying the organization id.
	 * @returns The settings envelope.
	 */
	public async execute(query: GetDocumentSettingsQuery): Promise<IDocumentSettings> {
		return this.documentSettingsService.getSettings(query.organizationId);
	}
}
