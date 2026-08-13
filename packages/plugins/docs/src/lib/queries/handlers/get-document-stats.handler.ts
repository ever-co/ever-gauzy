import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DocumentStatsService, IDocumentStats } from '../../services/document-stats.service';
import { GetDocumentStatsQuery } from '../get-document-stats.query';

@QueryHandler(GetDocumentStatsQuery)
export class GetDocumentStatsHandler implements IQueryHandler<GetDocumentStatsQuery> {
	constructor(private readonly documentStatsService: DocumentStatsService) {}

	/**
	 * Handles the `GetDocumentStatsQuery`: org-global counts for the stats tiles
	 * (status totals, needs-review, storage quota state).
	 *
	 * @param query - The query carrying the organization scope.
	 * @returns The stats envelope.
	 */
	public async execute(query: GetDocumentStatsQuery): Promise<IDocumentStats> {
		return this.documentStatsService.getDocumentStats(query.params);
	}
}
