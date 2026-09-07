import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

/**
 * Body of `POST /api/plugins/docs/documents/:id/knowledge/reindex`.
 */
export class ReindexDocumentKnowledgeDTO {
	/** True bypasses the `contentHash` skip-if-unchanged short-circuit. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly force?: boolean;
}

/**
 * Body of the bulk `POST /api/plugins/docs/knowledge/reindex` sweep (§8.4).
 */
export class BulkKnowledgeReindexDTO {
	/** `model-drift` re-indexes only mismatched documents; `all` re-indexes everything INDEXED. */
	@ApiPropertyOptional({ enum: ['model-drift', 'all'], default: 'model-drift' })
	@IsOptional()
	@IsIn(['model-drift', 'all'])
	readonly scope?: 'model-drift' | 'all';

	/** True returns the affected count without enqueueing. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly dryRun?: boolean;
}
