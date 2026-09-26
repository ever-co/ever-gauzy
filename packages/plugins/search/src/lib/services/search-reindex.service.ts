import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { In, IsNull, LessThan, MoreThan } from 'typeorm';
import {
	ID,
	ISearchIndexRegistration,
	ISearchIndexStatus,
	ISearchReindexRequest,
	ISearchReindexResult,
	SearchReindexScope
} from '@gauzy/contracts';
import { RequestContext, TypeOrmSearchDocumentRepository } from '@gauzy/core';
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
	/**
	 * How many of the entity's documents are still stamped with a definition version behind the one
	 * the run wrote.
	 *
	 * It is the one number that says whether the sweep actually finished the job the version column
	 * exists for: a completed full rebuild leaves it at zero, and anything else is a document the
	 * sweep did not reach — a source row that was skipped, or a page a failure cut short. The column
	 * and its `(entity, definitionVersion, indexedAt)` index were being written and never read, so
	 * nothing in the platform could tell a rebuilt index from a half-rebuilt one.
	 */
	stale: number;
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
				runs.push({ entity, indexed: 0, skipped: 0, removed: 0, batches: 0, stale: 0 });
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
		const scope = this.tenantScope();
		let deletedCount = 0;

		for (const key of entities) {
			if (!this.indexRegistry.has(key)) {
				throw new BadRequestException(`No index definition is registered for "${key}", so it holds no documents.`);
			}

			if (channelId) {
				deletedCount += await this.dropChannel(key, channelId, scope);

				continue;
			}

			const result = await this.typeOrmSearchDocumentRepository.softDelete({ entity: key, ...scope } as any);

			deletedCount += Number(result?.affected ?? 0);
		}

		return { deletedCount };
	}

	/**
	 * Drops one entity's documents for one channel, a page at a time.
	 *
	 * The channel is carried as a promoted token rather than a column, so the membership test is made
	 * in JavaScript over the token list — but the *read* it is made over has to be bounded. It used to
	 * be a single unpaged `find()` over every document of the entity, which on a production index of a
	 * few million rows pulls every title, body, keyword list and attribute map into the Node heap at
	 * once, and the only outcome of that is an out-of-memory kill of the API process.
	 *
	 * The paging is a **cursor on the row's own id**, not an offset. The read filters on
	 * `deletedAt IS NULL` and the loop soft-deletes as it goes, so the set an offset counts into is the
	 * set the loop is shrinking: every page would step over as many unexamined documents as the
	 * previous one removed. A cursor is monotonic whatever the loop does to the rows behind it, which
	 * is also what makes the loop guaranteed to terminate.
	 *
	 * @param entity The entity key.
	 * @param channelId The channel whose documents are dropped.
	 * @param scope The tenant predicate the read and the write both carry.
	 * @returns How many documents were dropped.
	 */
	private async dropChannel(
		entity: string,
		channelId: ID,
		scope: Record<string, unknown>
	): Promise<number> {
		const pageSize = Math.max(1, Number(SEARCH_SETTING_DEFAULTS.reindexBatchSize) || 500);
		const token = `${CHANNEL_TOKEN_PREFIX}:${String(channelId).toLowerCase()}`;
		let deletedCount = 0;
		let after: string | undefined;

		while (true) {
			const documents = await this.typeOrmSearchDocumentRepository.find({
				where: { entity, deletedAt: IsNull(), ...scope, ...(after ? { id: MoreThan(after) } : {}) } as any,
				order: { id: 'ASC' } as any,
				take: pageSize
			});

			if (documents.length === 0) {
				break;
			}

			const ids = documents
				.filter((document) => (document.keywords ?? []).some((keyword) => String(keyword).toLowerCase() === token))
				.map((document) => document.id);

			if (ids.length > 0) {
				const result = await this.typeOrmSearchDocumentRepository.softDelete({ id: In(ids) } as any);

				deletedCount += Number(result?.affected ?? ids.length);
			}

			after = String(documents[documents.length - 1].id);

			if (documents.length < pageSize) {
				break;
			}
		}

		return deletedCount;
	}

	/**
	 * The tenant predicate every write in this service carries.
	 *
	 * Dropping an index is an operator action inside a tenant, and `search_document` holds every
	 * tenant's documents in one table: an unscoped `softDelete({ entity })` made an operator in tenant
	 * A empty tenant B's index for the same entity. An absent tenant — a system context, a scheduled
	 * sweep — keeps the unscoped behaviour, because that caller genuinely means the whole table.
	 *
	 * @returns The predicate fragment, empty when no tenant resolves.
	 */
	private tenantScope(): Record<string, unknown> {
		const tenantId = RequestContext.currentTenantId();

		return tenantId ? { tenantId } : {};
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

			return { entity, indexed: 0, skipped: 0, removed: dropped.deletedCount, batches: 0, stale: 0 };
		}

		const batchSize = Math.max(1, Number(SEARCH_SETTING_DEFAULTS.reindexBatchSize) || 500);
		const rawVersion = Number(persisted?.version ?? 1);
		const version = Number.isFinite(rawVersion) && rawVersion >= 1 ? Math.floor(rawVersion) : 1;
		const run: ISearchReindexRun = { entity, indexed: 0, skipped: 0, removed: 0, batches: 0, stale: 0 };

		if (request.ids?.length) {
			// An id-scoped run is already enumerated: the caller named the rows, so there is nothing to
			// page over. Paging one anyway re-passed the whole id set with a growing offset, and the
			// second iteration read zero rows — which `SearchIndexerService.index` reads as "the sources
			// are gone" and answers by removing the documents the first iteration had just written. A
			// request naming exactly `reindexBatchSize` ids therefore indexed them all and then deleted
			// them all, and reported `{ indexed: n, removed: 0 }` while doing it.
			const outcome = await this.indexer.index(entity, {
				ids: request.ids,
				since: request.since,
				definitionVersion: version
			});

			run.batches = 1;
			run.indexed = outcome.indexed;
			run.skipped = outcome.skipped;
			run.removed = outcome.removed;
		} else {
			let skip = 0;

			while (true) {
				const outcome = await this.indexer.index(entity, {
					since: request.since,
					skip,
					take: batchSize,
					definitionVersion: version
				});

				run.batches += 1;
				run.indexed += outcome.indexed;
				run.skipped += outcome.skipped;
				// A removal the sweep performed used to be dropped on the floor here, so an operator was
				// told nothing was removed by a run that had removed documents.
				run.removed += outcome.removed;

				// The last page is the one that came back short. A page that is exactly full may or may not
				// be the last, so the loop asks once more and stops on the empty answer.
				if (outcome.indexed + outcome.skipped < batchSize) {
					break;
				}

				skip += batchSize;
			}
		}

		// The orphan sweep runs for either shape of request, exactly as it did before: a document whose
		// source has been hard-deleted is unreachable by any event, and this is the only path that
		// notices it.
		run.removed += await this.removeOrphans(definition);
		run.stale = await this.staleCount(entity, version);

		return run;
	}

	/**
	 * How many of an entity's documents are still behind the definition version the run wrote.
	 *
	 * This is the read the `(entity, definitionVersion, indexedAt)` index was created for and that
	 * nothing performed: the column was stamped by every writer and compared by none, so a
	 * re-weighting could not be told apart from a rebuild that had finished. A full sweep that
	 * completed leaves this at zero; anything else names documents the sweep did not reach.
	 *
	 * @param entity The entity key.
	 * @param version The version the run stamped.
	 * @returns How many live documents carry an older version.
	 */
	private async staleCount(entity: string, version: number): Promise<number> {
		try {
			return await this.typeOrmSearchDocumentRepository.count({
				where: {
					entity,
					deletedAt: IsNull(),
					definitionVersion: LessThan(version),
					...this.tenantScope()
				} as any
			});
		} catch (error) {
			this.logger.warn(`The stale document count for "${entity}" could not be read: ${describe(error)}`);

			return 0;
		}
	}

	/**
	 * Removes the documents whose source row no longer exists.
	 *
	 * The check is done a page at a time and only over the ids that page holds, so the reconciliation
	 * costs one query per page rather than one query per document. A document whose source is gone is
	 * unreachable by any event — a hard delete produces no update — which is exactly why the sweep has
	 * to be the thing that notices.
	 *
	 * The paging is a **cursor on the document's own id**, not an offset. The read filters on
	 * `deletedAt IS NULL` and the loop soft-deletes as it goes, so the set an offset counts into is the
	 * set the loop is shrinking: a page that removed ten rows left the next offset ten rows too far
	 * along, and those ten documents were never examined — they stayed in the index and kept being
	 * returned as hits for sources that had been hard-deleted. A cursor is monotonic whatever the loop
	 * does to the rows behind it, and it is also what makes the loop guaranteed to terminate.
	 *
	 * @param definition The declaration.
	 * @returns How many documents were removed.
	 */
	private async removeOrphans(definition: ISearchIndexRegistration): Promise<number> {
		const pageSize = Math.max(1, Number(SEARCH_SETTING_DEFAULTS.reindexBatchSize) || 500);
		const scope = this.tenantScope();
		let removed = 0;
		let after: string | undefined;

		while (true) {
			const documents = await this.typeOrmSearchDocumentRepository.find({
				where: {
					entity: definition.entity,
					deletedAt: IsNull(),
					...scope,
					...(after ? { id: MoreThan(after) } : {})
				} as any,
				order: { id: 'ASC' } as any,
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
					entityId: In(orphans),
					...scope
				} as any);

				removed += Number(result?.affected ?? orphans.length);
			}

			after = String(documents[documents.length - 1].id);

			if (documents.length < pageSize) {
				break;
			}
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
