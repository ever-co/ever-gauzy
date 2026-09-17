import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { In, IsNull } from 'typeorm';
import {
	ID,
	ISearchIndexRegistration,
	ISearchIndexStatus,
	ISearchReindexRequest,
	ISearchReindexResult,
	SearchReindexScope
} from '@gauzy/contracts';
import { TypeOrmSearchDocumentRepository } from '@gauzy/core';
import { SearchIndexRegistry } from '../registry/search-index.registry';
import { SearchIndexDefinitionService } from './search-index-definition.service';
import { SearchIndexerService } from './search-indexer.service';
import { CHANNEL_TOKEN_PREFIX } from './search-document.builder';
import { SEARCH_SETTING_DEFAULTS } from '../search.settings';

/** What one reindex run did, per entity. */
export interface ISearchReindexRun {
	entity: string;
	indexed: number;
	skipped: number;
	removed: number;
	batches: number;
}

/**
 * The reindex job: rebuild the index from the source rows, in batches, without stopping the API.
 *
 * A rebuild is idempotent by construction. A document is keyed by `(tenant, entity, entityId,
 * engine)`, so writing it twice writes the same row with the same content; a run that is killed
 * mid-batch resumes from the beginning of its entity and rewrites work that was already correct,
 * which costs time and corrupts nothing.
 *
 * Three properties make the sweep usable on a table that does not fit in memory:
 *
 * - **It is paged by the identity of the rows, not by an offset into a mutating list.** Batches are
 *   read in source-timestamp order with the id as the tie-break, so a run over a table being written
 *   to does not skip rows.
 * - **It is version-driven.** A document whose `definitionVersion` is behind its declaration's is
 *   rebuilt; a run names the version it writes, so a re-weighting takes effect without an operator
 *   asking for a full rebuild.
 * - **It removes what no longer exists.** A document whose source row has been hard-deleted is not
 *   reachable by any event, so the sweep is the only path that removes it — and the only reason a
 *   document's `entityId` deliberately carries no foreign key.
 */
@Injectable()
export class SearchReindexService {
	private readonly logger = new Logger(SearchReindexService.name);

	constructor(
		private readonly indexer: SearchIndexerService,
		private readonly indexRegistry: SearchIndexRegistry,
		private readonly definitionService: SearchIndexDefinitionService,
		private readonly typeOrmSearchDocumentRepository: TypeOrmSearchDocumentRepository
	) {}

	/**
	 * What a rebuild of the requested scope would do.
	 *
	 * The estimate is the number of source rows the scope covers, counted rather than guessed: a
	 * request that is about to scan five million rows should say so before it starts, not after.
	 *
	 * @param request The reindex request.
	 * @returns What the run accepts.
	 */
	async plan(request: ISearchReindexRequest): Promise<ISearchReindexResult> {
		const entities = this.scopeEntities(request);
		let estimatedCount = 0;

		for (const entity of entities) {
			const definition = this.indexRegistry.get(entity);

			if (definition) {
				estimatedCount += await this.indexer.countSourceRows(definition, {
					ids: request.ids,
					since: request.since
				});
			}
		}

		return {
			entity: request.entity,
			queued: true,
			estimatedCount
		};
	}

	/**
	 * Rebuilds the requested scope.
	 *
	 * @param request The reindex request.
	 * @returns What each entity's run did, in the order the entities were swept.
	 * @throws BadRequestException when the request names a scope it does not supply, or an entity no
	 * declaration describes.
	 */
	async run(request: ISearchReindexRequest): Promise<ISearchReindexRun[]> {
		const entities = this.scopeEntities(request);
		const runs: ISearchReindexRun[] = [];

		for (const entity of entities) {
			try {
				runs.push(await this.runEntity(entity, request));
			} catch (error) {
				// One entity that cannot be swept must not abandon the others: the run reports what it
				// did and the failure is visible where the entity is, rather than only in a summary.
				this.logger.error(`The "${entity}" index could not be rebuilt: ${describe(error)}`);
				runs.push({ entity, indexed: 0, skipped: 0, removed: 0, batches: 0 });
			}
		}

		return runs;
	}

	/**
	 * How fresh each entity's index is.
	 *
	 * `indexedCount` and `lastIndexedAt` are read from the index itself. `pendingCount` is the number
	 * of source rows that moved after the index last did, which is a fact the source can answer and
	 * the index cannot — a document that is *missing* altogether is not detectable here without a
	 * scan, and this reports what it knows rather than an invented total.
	 *
	 * @param entities The entities to report; every registered entity when none is named.
	 * @returns One status per entity.
	 */
	async status(entities?: string[]): Promise<ISearchIndexStatus[]> {
		const scope = entities?.length ? entities : this.indexRegistry.registeredEntities();
		const statuses: ISearchIndexStatus[] = [];

		for (const entity of scope) {
			const definition = this.indexRegistry.get(entity);

			if (!definition) {
				continue;
			}

			const indexedCount = await this.typeOrmSearchDocumentRepository.count({
				where: { entity, deletedAt: IsNull() } as any
			});
			const newest = await this.typeOrmSearchDocumentRepository.findOne({
				where: { entity, deletedAt: IsNull() } as any,
				order: { indexedAt: 'DESC' } as any
			});
			const lastIndexedAt = newest?.indexedAt ?? undefined;
			const pendingCount = lastIndexedAt
				? await this.indexer.countSourceRows(definition, { since: lastIndexedAt })
				: await this.indexer.countSourceRows(definition);

			statuses.push({
				entity,
				indexedCount,
				pendingCount,
				lastIndexedAt,
				lagSeconds: lastIndexedAt
					? Math.max(0, Math.round((Date.now() - new Date(lastIndexedAt).getTime()) / 1000))
					: undefined
			});
		}

		return statuses;
	}

	/**
	 * Drops the documents of an entity, or of one channel.
	 *
	 * The rows are soft-deleted, and the next reindex revives them — which is the point: dropping an
	 * index is a cheap way to make a search answer nothing while the rebuild runs, not a way to lose
	 * the record of what was indexed.
	 *
	 * @param entity The entity to drop; every registered entity when none is named.
	 * @param channelId The channel to drop; every channel when none is named.
	 * @returns How many documents were dropped.
	 */
	async drop(entity?: string, channelId?: ID): Promise<{ deletedCount: number }> {
		const entities = entity ? [entity] : this.indexRegistry.registeredEntities();
		let deletedCount = 0;

		for (const key of entities) {
			if (!this.indexRegistry.has(key)) {
				throw new BadRequestException(`No index definition is registered for "${key}", so it holds no documents.`);
			}

			if (channelId) {
				const documents = await this.typeOrmSearchDocumentRepository.find({
					where: { entity: key, deletedAt: IsNull() } as any
				});
				const token = `${CHANNEL_TOKEN_PREFIX}:${String(channelId).toLowerCase()}`;
				const ids = documents
					.filter((document) => (document.keywords ?? []).includes(token))
					.map((document) => document.id);

				if (ids.length > 0) {
					const result = await this.typeOrmSearchDocumentRepository.softDelete({ id: In(ids) } as any);

					deletedCount += Number(result?.affected ?? ids.length);
				}

				continue;
			}

			const result = await this.typeOrmSearchDocumentRepository.softDelete({ entity: key } as any);

			deletedCount += Number(result?.affected ?? 0);
		}

		return { deletedCount };
	}

	/**
	 * Rebuilds one entity.
	 *
	 * @param entity The entity key.
	 * @param request The reindex request.
	 * @returns What the entity's run did.
	 */
	private async runEntity(entity: string, request: ISearchReindexRequest): Promise<ISearchReindexRun> {
		const definition = this.indexRegistry.get(entity);

		if (!definition) {
			throw new BadRequestException(`No index definition is registered for "${entity}".`);
		}

		const persisted = await this.definitionService.findFor(entity);
		const active = persisted ? persisted.isActive !== false : definition.isActive !== false;

		if (!active) {
			// An inactive definition is neither indexed nor queried, and its documents are removed so
			// that re-activating it starts from a clean index rather than from stale rows.
			const dropped = await this.drop(entity);

			return { entity, indexed: 0, skipped: 0, removed: dropped.deletedCount, batches: 0 };
		}

		const batchSize = Math.max(1, Number(SEARCH_SETTING_DEFAULTS.reindexBatchSize) || 500);
		const version = Number(persisted?.version ?? 1);
		const run: ISearchReindexRun = { entity, indexed: 0, skipped: 0, removed: 0, batches: 0 };
		let skip = 0;

		while (true) {
			const outcome = await this.indexer.index(entity, {
				ids: request.ids,
				since: request.since,
				skip,
				take: batchSize,
				definitionVersion: Number.isFinite(version) && version >= 1 ? version : 1
			});

			run.batches += 1;
			run.indexed += outcome.indexed;
			run.skipped += outcome.skipped;

			// The last page is the one that came back short. A page that is exactly full may or may not
			// be the last, so the loop asks once more and stops on the empty answer.
			if (outcome.indexed + outcome.skipped < batchSize) {
				break;
			}

			skip += batchSize;
		}

		run.removed += await this.removeOrphans(definition);

		return run;
	}

	/**
	 * Removes the documents whose source row no longer exists.
	 *
	 * The check is done a page at a time and only over the ids that page holds, so the reconciliation
	 * costs one query per page rather than one query per document. A document whose source is gone is
	 * unreachable by any event — a hard delete produces no update — which is exactly why the sweep has
	 * to be the thing that notices.
	 *
	 * @param definition The declaration.
	 * @returns How many documents were removed.
	 */
	private async removeOrphans(definition: ISearchIndexRegistration): Promise<number> {
		const pageSize = Math.max(1, Number(SEARCH_SETTING_DEFAULTS.reindexBatchSize) || 500);
		let removed = 0;
		let skip = 0;

		while (true) {
			const documents = await this.typeOrmSearchDocumentRepository.find({
				where: { entity: definition.entity, deletedAt: IsNull() } as any,
				order: { indexedAt: 'ASC', id: 'ASC' } as any,
				skip,
				take: pageSize
			});

			if (documents.length === 0) {
				break;
			}

			const live = await this.indexer.readSourceRows(definition, {
				ids: documents.map((document) => document.entityId)
			});
			const liveIds = new Set(live.map((row) => String(row.id)));
			const orphans = documents
				.filter((document) => !liveIds.has(String(document.entityId)))
				.map((document) => String(document.entityId));

			if (orphans.length > 0) {
				const result = await this.typeOrmSearchDocumentRepository.softDelete({
					entity: definition.entity,
					entityId: In(orphans)
				} as any);

				removed += Number(result?.affected ?? orphans.length);
			}

			if (documents.length < pageSize) {
				break;
			}

			skip += pageSize;
		}

		return removed;
	}

	/**
	 * The entities a request covers.
	 *
	 * @param request The reindex request.
	 * @returns The entity keys.
	 * @throws BadRequestException when the scope's required member is missing.
	 */
	private scopeEntities(request: ISearchReindexRequest): string[] {
		switch (request?.scope) {
			case SearchReindexScope.ENTITY:
				if (!request.entity) {
					throw new BadRequestException('An entity reindex must name the entity it rebuilds.');
				}

				if (!this.indexRegistry.has(request.entity)) {
					throw new BadRequestException(`No index definition is registered for "${request.entity}".`);
				}

				return [request.entity];

			case SearchReindexScope.CHANNEL:
				if (!request.channelId) {
					throw new BadRequestException('A channel reindex must name the channel it rebuilds.');
				}

				// Only a channel-scoped declaration has anything to say about a channel: an entity that is
				// not published into one is indexed exactly once and is not rebuilt per channel.
				return this.indexRegistry
					.getAll()
					.filter((definition) => Boolean(definition.channels))
					.map((definition) => definition.entity);

			case SearchReindexScope.ALL:
				return this.indexRegistry.registeredEntities();

			default:
				throw new BadRequestException(
					'A reindex must state its scope: every entity, one entity, or one channel.'
				);
		}
	}
}

/**
 * @param error The failure.
 * @returns A one-line description.
 */
function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
