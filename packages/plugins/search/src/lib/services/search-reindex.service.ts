import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { In, IsNull, MoreThan, Not } from 'typeorm';
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
		const scope = this.tenantScope();
		let estimatedCount = 0;

		for (const entity of entities) {
			const definition = this.indexRegistry.get(entity);

			if (definition) {
				// The caller's tenant's rows, as the run sweeps them: counted across tenants, the estimate told a tenant
				// how many rows every tenant holds, and an id-scoped plan whether an id exists in any of them.
				estimatedCount += await this.indexer.countSourceRows(definition, {
					ids: request.ids,
					since: request.since,
					...scope
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
		// The caller's tenant's index and rows: read across tenants, the report gave any tenant the size and the
		// freshness of every tenant's index.
		const tenant = this.tenantScope();
		const statuses: ISearchIndexStatus[] = [];

		for (const entity of scope) {
			const definition = this.indexRegistry.get(entity);

			if (!definition) {
				continue;
			}

			const indexedCount = await this.typeOrmSearchDocumentRepository.count({
				where: { entity, deletedAt: IsNull(), ...tenant } as any
			});
			const newest = await this.typeOrmSearchDocumentRepository.findOne({
				where: { entity, deletedAt: IsNull(), ...tenant } as any,
				order: { indexedAt: 'DESC' } as any
			});
			const lastIndexedAt = newest?.indexedAt ?? undefined;
			const pendingCount = lastIndexedAt
				? await this.indexer.countSourceRows(definition, { since: lastIndexedAt, ...tenant })
				: await this.indexer.countSourceRows(definition, tenant);

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
	 * Drops the documents of one entity that belong to the organization an inactive definition is the own copy of.
	 *
	 * @param entity The entity key.
	 * @param definition The organization's own definition.
	 * @returns How many documents were dropped.
	 */
	private async dropOrganization(
		entity: string,
		definition: { tenantId?: ID | null; organizationId?: ID | null }
	): Promise<{ deletedCount: number }> {
		const result = await this.typeOrmSearchDocumentRepository.softDelete({
			entity,
			...this.tenantScope(),
			...(definition.tenantId ? { tenantId: definition.tenantId } : {}),
			organizationId: definition.organizationId
		} as any);

		return { deletedCount: Number(result?.affected ?? 0) };
	}

	/**
	 * Drops what an active sweep wrote for the organizations that switched their own definition of the entity off.
	 *
	 * The sweep reads every organization's source rows in its tenant, so an organization still on the shipped
	 * definition rebuilt the documents of one whose own copy is off — the documents its switch had dropped, which a
	 * search answers again (CodeRabbit). Each such organization's documents are dropped again, scoped to it.
	 *
	 * @param entity The entity key.
	 * @returns How many documents were dropped.
	 */
	private async dropSwitchedOffOrganizations(entity: string): Promise<number> {
		const copies = await this.definitionService.inactiveOrganizationCopies(
			entity,
			RequestContext.currentTenantId()
		);
		let dropped = 0;

		for (const copy of copies) {
			dropped += (await this.dropOrganization(entity, copy)).deletedCount;
		}

		return dropped;
	}

	/**
	 * Rebuilds one entity.
	 *
	 * **A sweep is partitioned by organization (Q16).** It reads every organization's rows of the tenant, and each
	 * organization's rows are written under the definition in force for that organization: its own copy when it has
	 * one, else the shipped row. The run therefore resolves the shipped row itself — never the copy of whichever
	 * organization the operator happened to have selected, which used to stamp the whole tenant with that copy's
	 * version (and, switched off, skip the whole tenant) — and the indexer applies each row's own copy.
	 *
	 * A shipped definition that is switched off no longer drops the documents of an organization whose own copy is
	 * on: those organizations are swept under their copies, and only the rest of the tenant's documents are dropped.
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

		const platform = await this.definitionService.platformDefinitionOf(entity);
		const active = platform ? platform.isActive !== false : definition.isActive !== false;
		const version = normaliseVersion(platform?.version);
		const run: ISearchReindexRun = { entity, indexed: 0, skipped: 0, removed: 0, batches: 0, stale: 0 };
		const copies = (
			await this.definitionService.organizationCopies(entity, RequestContext.currentTenantId())
		).filter((copy) => copy.isActive !== false);

		if (!active) {
			// An inactive definition is neither indexed nor queried, and its documents are removed so
			// that re-activating it starts from a clean index rather than from stale rows.
			// The organizations whose own copy is on keep theirs: the shipped switch is not theirs (Q16).
			run.removed += await this.dropExcept(
				entity,
				copies.map((copy) => copy.organizationId)
			);

			if (copies.length > 0 && request.ids?.length) {
				// The named rows are read once and each is written under its own organization's copy, or removed.
				// Narrowed to one organization at a time, a run reads none of another organization's ids — and an
				// id-scoped run that reads nothing removes those ids' documents as sources that are gone — so the named
				// ids are read, and removed, in the caller's tenant only: they are the caller's to name, not any
				// tenant's (CodeRabbit on #10850).
				await this.sweep(definition, request, version, run, this.tenantScope());
			} else {
				for (const copy of copies) {
					await this.sweep(definition, request, normaliseVersion(copy.version), run, {
						tenantId: copy.tenantId ?? null,
						organizationId: copy.organizationId ?? null
					});
				}
			}

			if (copies.length > 0) {
				run.removed += await this.removeOrphans(definition);
			}

			run.stale = await this.staleCount(entity, null, copies);

			return run;
		}

		// Every run reads and writes in the caller's tenant only, as the id-scoped one above does. A full sweep used to
		// read every tenant's rows inside one tenant's request, and answer how many it had written. A run with no
		// caller (a job) has no tenant, and still sweeps every tenant.
		await this.sweep(definition, request, version, run, this.tenantScope());

		// The orphan sweep runs for either shape of request, exactly as it did before: a document whose
		// source has been hard-deleted is unreachable by any event, and this is the only path that
		// notices it.
		run.removed += await this.removeOrphans(definition);
		run.removed += await this.dropSwitchedOffOrganizations(entity);
		run.stale = await this.staleCount(entity, version, copies);

		return run;
	}

	/**
	 * Indexes the source rows one run covers, a batch at a time.
	 *
	 * @param definition The declaration.
	 * @param request The reindex request.
	 * @param version The version the rows without an own copy are stamped with.
	 * @param run The run the outcome is added to.
	 * @param scope The tenant and organization the read is narrowed to; the whole tenant when empty.
	 */
	private async sweep(
		definition: ISearchIndexRegistration,
		request: ISearchReindexRequest,
		version: number,
		run: ISearchReindexRun,
		scope: { tenantId?: ID | null; organizationId?: ID | null }
	): Promise<void> {
		const entity = definition.entity;
		const batchSize = Math.max(1, Number(SEARCH_SETTING_DEFAULTS.reindexBatchSize) || 500);

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
				definitionVersion: version,
				...scope
			});

			run.batches += 1;
			run.indexed += outcome.indexed;
			run.skipped += outcome.skipped;
			run.removed += outcome.removed;

			return;
		}

		let skip = 0;

		while (true) {
			const outcome = await this.indexer.index(entity, {
				since: request.since,
				skip,
				take: batchSize,
				definitionVersion: version,
				...scope
			});

			run.batches += 1;
			run.indexed += outcome.indexed;
			run.skipped += outcome.skipped;
			// A removal the sweep performed used to be dropped on the floor here, so an operator was
			// told nothing was removed by a run that had removed documents.
			run.removed += outcome.removed;

			// The last page is the one that came back short. A page that is exactly full may or may not
			// be the last, so the loop asks once more and stops on the empty answer. A row the page read and
			// did not write — outside the row rule, or of an organization that switched the entity off — is
			// still a row of the page, so the count is the rows read rather than the documents written.
			if ((outcome.read ?? outcome.indexed + outcome.skipped) < batchSize) {
				break;
			}

			skip += batchSize;
		}
	}

	/**
	 * Drops one entity's documents in the caller's tenant, except those of the named organizations.
	 *
	 * @param entity The entity key.
	 * @param keep The organizations whose documents stay.
	 * @returns How many documents were dropped.
	 */
	private async dropExcept(entity: string, keep: Array<ID | null | undefined>): Promise<number> {
		const organizations = keep.filter((value): value is ID => !!value).map((value) => String(value));

		if (organizations.length === 0) {
			return (await this.drop(entity)).deletedCount;
		}

		const scope = this.tenantScope();
		// `NOT IN` never matches a NULL, so the documents that carry no organization are dropped by a second
		// statement rather than kept by accident.
		const others = await this.typeOrmSearchDocumentRepository.softDelete({
			entity,
			...scope,
			organizationId: Not(In(organizations))
		} as any);
		const unowned = await this.typeOrmSearchDocumentRepository.softDelete({
			entity,
			...scope,
			organizationId: IsNull()
		} as any);

		return Number(others?.affected ?? 0) + Number(unowned?.affected ?? 0);
	}

	/**
	 * How many of an entity's documents are still behind the definition version the run wrote.
	 *
	 * This is the read the `(entity, definitionVersion, indexedAt)` index was created for and that
	 * nothing performed: the column was stamped by every writer and compared by none, so a
	 * re-weighting could not be told apart from a rebuild that had finished. A full sweep that
	 * completed leaves this at zero; anything else names documents the sweep did not reach.
	 *
	 * Each organization's documents are compared with the version of the definition in force for it (Q16): its own
	 * copy's, else the shipped row's. It is ONE grouped read — the live documents behind the highest of those versions,
	 * counted per organization and version — whatever the number of copies (Greptile on #10850: two counts per copy
	 * made a tenant with many tuned organizations wait for thousands of sequential queries).
	 *
	 * @param entity The entity key.
	 * @param version The version the shipped definition stamped, or `null` when it is switched off.
	 * @param copies The organizations' own copies that are switched on.
	 * @returns How many live documents carry an older version.
	 */
	private async staleCount(
		entity: string,
		version: number | null,
		copies: Array<{ organizationId?: ID | null; version?: number | null }> = []
	): Promise<number> {
		const own = new Map<string, number>();

		for (const copy of copies) {
			if (copy.organizationId) {
				own.set(String(copy.organizationId), normaliseVersion(copy.version));
			}
		}

		// Nothing is behind version 1, so a read whose every threshold is 1 has nothing to count.
		const ceiling = Math.max(version ?? 0, ...own.values());

		if (ceiling <= 1) {
			return 0;
		}

		try {
			const { tenantId } = this.tenantScope() as { tenantId?: ID };
			const query = this.typeOrmSearchDocumentRepository
				.createQueryBuilder('document')
				.select('document.organizationId', 'organizationId')
				.addSelect('document.definitionVersion', 'definitionVersion')
				.addSelect('COUNT(*)', 'count')
				.where('document.entity = :entity', { entity })
				.andWhere('document.deletedAt IS NULL')
				.andWhere('document.definitionVersion < :ceiling', { ceiling });

			if (tenantId) {
				query.andWhere('document.tenantId = :tenantId', { tenantId });
			}

			const groups: Array<{ organizationId?: ID | null; definitionVersion?: unknown; count?: unknown }> =
				await query.groupBy('document.organizationId').addGroupBy('document.definitionVersion').getRawMany();
			let stale = 0;

			for (const group of groups) {
				const organizationId = group.organizationId ? String(group.organizationId) : null;
				const threshold = organizationId && own.has(organizationId) ? own.get(organizationId) : version;

				if (threshold !== null && threshold !== undefined && Number(group.definitionVersion) < threshold) {
					stale += Number(group.count) || 0;
				}
			}

			return stale;
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
 * The version a sweep stamps.
 *
 * @param value The persisted version.
 * @returns A version of at least one.
 */
function normaliseVersion(value: unknown): number {
	const version = Number(value ?? 1);

	return Number.isFinite(version) && version >= 1 ? Math.floor(version) : 1;
}

/**
 * @param error The failure.
 * @returns A one-line description.
 */
function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
