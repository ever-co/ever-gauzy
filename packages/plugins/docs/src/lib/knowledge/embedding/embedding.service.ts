import { Injectable, Logger } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { getDocsConfig } from '../../docs.config';
import { DocsPermanentError, DocsTransientError } from '../errors';
import { DocsAiService, IResolvedEmbeddingModel } from '../ai/docs-ai.service';

/**
 * Chunk/query embedding through the provider-resolved embedding model
 * (§7 of the AI-knowledge spec).
 *
 * - Model: `GAUZY_DOCS_EMBEDDING_MODEL` (default `text-embedding-3-small`), dimensions
 *   pinned to `GAUZY_DOCS_EMBEDDING_DIMS` (default 1536) — a vector of any other length is
 *   rejected with a permanent error naming the setting, so a mis-configured model can
 *   never write vectors that do not fit the `vector(1536)` column.
 * - Batching: `embedMany` with ≤ `GAUZY_DOCS_EMBED_BATCH_SIZE` (hard max 64) inputs.
 * - Every call site emits a `DocsAiUsageEvent` (debug-logged in P0).
 * - No provider ⇒ `null` resolution upstream ⇒ the caller runs lexical-only. This service
 *   is only invoked with an already-resolved model.
 */
@Injectable()
export class EmbeddingService {
	private readonly logger = new Logger(EmbeddingService.name);

	constructor(private readonly docsAiService: DocsAiService) {}

	/**
	 * Resolves the tenant's embedding model (`null` = lexical-only path).
	 */
	public resolve(tenantId: ID): Promise<IResolvedEmbeddingModel | null> {
		return this.docsAiService.resolveEmbeddingModel(tenantId);
	}

	/**
	 * Embeds a batch of chunk texts (≤ the configured batch size per provider call).
	 *
	 * @param resolved The resolved embedding model handle.
	 * @param texts The chunk contents, in order.
	 * @param scope Tenant/org snapshot for usage accounting.
	 * @param feature Usage feature tag (`docs-embed` for chunks, `docs-query-embed` for queries).
	 * @returns One embedding per input, in the same order.
	 */
	public async embedBatch(
		resolved: IResolvedEmbeddingModel,
		texts: string[],
		scope: { tenantId: ID; organizationId: ID },
		feature: 'docs-embed' | 'docs-query-embed' = 'docs-embed'
	): Promise<number[][]> {
		if (!texts.length) {
			return [];
		}
		const sdk = await this.docsAiService.loadAiSdk();
		if (!sdk) {
			throw new DocsTransientError('The AI SDK could not be loaded for embedding.');
		}

		const config = getDocsConfig();
		const batchSize = Math.min(Math.max(config.embedBatchSize, 1), 64);
		// Providers reject empty strings — such chunks should not exist post-chunker, but
		// the guard stays (§7.3).
		const values = texts.map((text) => (text && text.trim().length ? text : ' '));

		const embeddings: number[][] = [];
		for (let offset = 0; offset < values.length; offset += batchSize) {
			const batch = values.slice(offset, offset + batchSize);
			const startedAt = Date.now();
			try {
				const result = await sdk.embedMany({
					model: resolved.model,
					values: batch,
					// Dimensions pinned in the request where the provider supports the option
					// (e.g. OpenAI `dimensions`); the hard length check below is the guarantee.
					providerOptions: { [resolved.providerId]: { dimensions: resolved.dims } } as any
				});

				const reportedTokens = Number((result as any).usage?.tokens);
				this.docsAiService.emitUsage({
					tenantId: scope.tenantId,
					organizationId: scope.organizationId,
					feature,
					providerId: resolved.providerId,
					model: resolved.modelId,
					inputTokens: Number.isFinite(reportedTokens)
						? reportedTokens
						: Math.ceil(batch.join(' ').length / 4),
					outputTokens: 0,
					estimated: !Number.isFinite(reportedTokens),
					durationMs: Date.now() - startedAt,
					success: true
				});

				for (const embedding of result.embeddings) {
					if (!Array.isArray(embedding) || embedding.length !== resolved.dims) {
						throw new DocsPermanentError(
							`The embedding model '${resolved.modelId}' returned ${embedding?.length ?? 0} dimensions ` +
								`but GAUZY_DOCS_EMBEDDING_DIMS is ${resolved.dims} — fix the model or the setting.`
						);
					}
					embeddings.push(embedding as number[]);
				}
			} catch (error) {
				if (!(error instanceof DocsPermanentError)) {
					this.docsAiService.emitUsage({
						tenantId: scope.tenantId,
						organizationId: scope.organizationId,
						feature,
						providerId: resolved.providerId,
						model: resolved.modelId,
						inputTokens: Math.ceil(batch.join(' ').length / 4),
						outputTokens: 0,
						estimated: true,
						durationMs: Date.now() - startedAt,
						success: false
					});
				}
				throw error;
			}
		}
		return embeddings;
	}

	/**
	 * Embeds one retrieval query. Returns `null` on ANY failure — a transient provider
	 * error degrades the QUERY (lexical-only leg), never the request (§9.3).
	 */
	public async embedQuery(
		resolved: IResolvedEmbeddingModel,
		query: string,
		scope: { tenantId: ID; organizationId: ID }
	): Promise<number[] | null> {
		try {
			const [embedding] = await this.embedBatch(resolved, [query], scope, 'docs-query-embed');
			return embedding ?? null;
		} catch (error) {
			this.logger.debug(`Query embedding failed — degrading to lexical-only: ${(error as Error).message}`);
			return null;
		}
	}
}
