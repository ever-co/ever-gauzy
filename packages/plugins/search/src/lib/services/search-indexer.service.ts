import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { In, IsNull } from 'typeorm';
import { ID, IEventEnvelope, ISearchDocument, ISearchIndexRegistration, ISearchProvider } from '@gauzy/contracts';
import { TypeOrmSearchIndexDefinitionRepository } from '@gauzy/core';
import { SearchIndexRegistry } from '../registry/search-index.registry';
import { SearchProviderRegistry } from '../providers/search-provider.registry';
import { IScopedSearchDelete, ISearchDeleteScope } from '../providers/database-search.provider';
import { buildDocument, isRowVisible, readPath, SearchSourceRow } from './search-document.builder';
import { ISearchSourceCriteria, ISearchSourceEntity, SearchSourceConnection } from './search-source.connection';

/** How the source rows of one index run are selected. */
export interface ISourceRowQuery {
	/** Read only these source ids. */
	ids?: ID[];
	/** Read only rows whose source timestamp moved on or after this moment. */
	since?: Date;
	/** How many rows to read. */
	take?: number;
	/** How many rows to skip. */
	skip?: number;
	/** Tenant to scope the read to; the caller's own when it states none. */
	tenantId?: ID | null;
	/** Organization to scope the read to. */
	organizationId?: ID | null;
	/** The declaration version the documents are stamped with. Defaults to the first version. */
	definitionVersion?: number;
	/** The engine the documents are written for, when the caller has already resolved the definition. */
	engineKey?: string;
}

/**
 * The persisted half of a declaration, as far as the write path needs it: whether the entity is indexed, the version
 * documents are stamped with and the engine that holds them, and — for an organization's own copy — whose it is.
 */
export interface IPersistedSearchDefinition {
	isActive?: boolean | null;
	version?: number | null;
	engineKey?: string | null;
	tenantId?: ID | null;
	organizationId?: ID | null;
}

/** What one indexing run did. */
export interface IIndexRunOutcome {
	entity: string;
	indexed: number;
	removed: number;
	skipped: number;
	/** The provider that answered, so a caller can say which backend holds the documents. */
	providerKey: string;
	/**
	 * How many source rows the run read, written or not. A paged sweep stops on the page that came back short, and a
	 * row that is not written — outside the row rule, or of an organization that switched the entity off — is still a
	 * row of the page.
	 */
	read?: number;
}

/**
 * The write half of the index: a platform event, or a range of source rows, becomes documents.
 *
 * Nothing about an entity is coded here. The declaration says which fields the index holds and where
 * each value is read from; this service reads the rows the declaration names, renders them with the
 * declaration's templates and hands the documents to whichever provider the entity's persisted
 * definition names. Adding a searchable entity is therefore a registration, not an indexer.
 *
 * **The index is disposable and never authoritative.** A document carries an entity type, an id and
 * display text; it never carries a price, a stock level, a balance, a status or a permission that
 * anything computes with. A reader re-reads the entity from the domain that owns it, which is what
 * lets the whole table be dropped and rebuilt.
 *
 * Weight normalisation happens here rather than at query time, so two entity types are comparable and
 * adding a searchable entity cannot silently reorder the ones that were already indexed. The
 * normalised number travels inside the document's own attribute map, so a rebuild reproduces it.
 *
 * **Both ORMs read.** The source rows are reached through {@link SearchSourceConnection} rather than
 * through TypeORM's `DataSource` directly. The whole indexer used to be wired to TypeORM's runtime
 * metadata, which under `DB_ORM=mikro-orm` described entities carrying four columns — the four the
 * base entity declares with raw TypeORM decorators — because `@MultiORMColumn` emitted only the active
 * ORM's. Every declared field came back as "not a column", the ordering was dropped, the tenant
 * predicate raised `EntityPropertyNotFoundError`, and the installation's global search answered
 * nothing with nothing to point at. The kernel now registers TypeORM's metadata under both ORMs
 * (d739d81b25); the source connection still reads through the configured ORM.
 */
@Injectable()
export class SearchIndexerService {
	private readonly logger = new Logger(SearchIndexerService.name);

	constructor(
		private readonly source: SearchSourceConnection,
		private readonly indexRegistry: SearchIndexRegistry,
		private readonly providerRegistry: SearchProviderRegistry,
		private readonly typeOrmSearchIndexDefinitionRepository: TypeOrmSearchIndexDefinitionRepository
	) {}

	/**
	 * Turns one entity key into the key the declarations use.
	 *
	 * A platform event names its aggregate in PascalCase (`ProductVariant`); a declaration names it by
	 * the table it lives in (`product_variant`). Both are accepted, and the translation is read from
	 * the live metadata rather than from a table of names, so a package that renames a class does not
	 * silently stop being indexed.
	 *
	 * @param value The aggregate type or entity key.
	 * @returns The entity key, or `undefined` when nothing maps it.
	 */
	entityKeyOf(value: string): string | undefined {
		const key = String(value ?? '').trim();

		if (!key) {
			return undefined;
		}

		if (this.indexRegistry.has(key)) {
			return key;
		}

		const byTable = this.source.byTable(key);

		if (byTable) {
			return byTable.tableName;
		}

		const byClass = this.source.byClassName(key);

		if (byClass) {
			return byClass.tableName;
		}

		// The last resort is a spelling-insensitive match, and it exists because the platform's events
		// do not all spell an aggregate type the same way: the outbox rows this branch writes carry
		// `SELLER_OFFERING`, a declaration names `seller_offering` and a class is `SellerOffering`. All
		// three are the same entity, and an event whose aggregate type happens to be the third spelling
		// must not be silently unindexable. Only the separators and the case are ignored — nothing else
		// is guessed.
		const normalised = normaliseEntityKey(key);

		return this.source
			.entities()
			.find(
				(entity) =>
					normaliseEntityKey(entity.tableName) === normalised ||
					normaliseEntityKey(entity.className) === normalised
			)?.tableName;
	}

	/**
	 * The declaration behind one entity, refusing an entity nothing declares.
	 *
	 * @param entity The entity key or aggregate type.
	 * @returns The declaration.
	 * @throws BadRequestException when no declaration is registered for the entity.
	 */
	definitionFor(entity: string): ISearchIndexRegistration {
		const key = this.entityKeyOf(entity);
		const definition = key ? this.indexRegistry.get(key) : undefined;

		if (!definition) {
			throw new BadRequestException(
				`No index definition is registered for "${entity}", so there is nothing to index and nothing ` +
					'to query. A declaration is registered by the package that owns the entity.'
			);
		}

		return definition;
	}

	/**
	 * Writes the documents of one entity.
	 *
	 * @param entity The entity key or aggregate type.
	 * @param options Which source rows to read.
	 * @returns What the run did.
	 */
	async index(entity: string, options: ISourceRowQuery = {}): Promise<IIndexRunOutcome> {
		const definition = this.definitionFor(entity);
		const platform = await this.persistedDefinitionOf(definition.entity);
		const engineKey = options.engineKey ?? platform?.engineKey ?? undefined;
		const provider = this.writableProvider(definition, engineKey);
		const rows = await this.readSourceRows(definition, options);

		if (rows.length === 0) {
			// An absent source row is success, not an error: the row was deleted between the event and
			// this run, and the document that describes it is removed rather than left stale.
			//
			// **Only the first page may be read that way.** A paged run re-passes the whole id set on
			// every iteration, so the page after the last one is empty for the ordinary reason that the
			// rows have all been read — not because the sources are gone. Treating that empty page as a
			// deletion soft-deleted every document the run had just written, and reported `removed: 0`
			// while doing it. A run that skipped into the empty page therefore removes nothing.
			const removed =
				options.ids?.length && !(options.skip && options.skip > 0)
					? await this.deleteDocuments(provider, definition.entity, options.ids, {
							tenantId: options.tenantId ?? undefined,
							engineKey
						})
					: 0;

			return { entity: definition.entity, indexed: 0, removed, skipped: 0, providerKey: provider.key, read: 0 };
		}

		const channels = await this.resolveChannels(definition, rows);
		const version = normaliseVersion(options.definitionVersion ?? platform?.version ?? 1);
		// The definition in force is the row's organization's own copy when it has one, else the shipped row (Q16).
		// A run reads the rows of many organizations — a sweep reads the whole tenant, an event names one row — and
		// each row is written under its own organization's definition: an organization that switched the entity off
		// has its rows removed rather than re-indexed, and one that re-weighted it has its documents stamped with its
		// copy's version rather than the shipped one.
		const copies = await this.organizationCopiesOf(definition.entity, rows, options);
		const platformActive = platform ? platform.isActive !== false : definition.isActive !== false;
		let skipped = 0;
		const documents: ISearchDocument[] = [];
		// Keyed by the tenant whose copy is removed: a sweep that names no tenant reads every tenant's
		// rows, and a removal keyed on the id alone would take another tenant's document that happens
		// to carry the same id (see `deleteDocuments`).
		const hidden = new Map<string, ID[]>();

		for (const row of rows) {
			const own = ownCopyOf(row, options, copies);
			const active = own ? own.isActive !== false : platformActive;

			// A row the declaration's row rule does not admit is not the entity permission's to show
			// (a PRIVATE document, review R7-05). It is not written, and a document an earlier run wrote
			// for it — before the row moved outside the rule, or before the rule existed — is removed.
			// A row whose organization's definition is switched off is removed the same way (Q16): the
			// switch dropped its documents, and a live event must not write them back.
			if (!active || !isRowVisible(definition, row)) {
				const tenantId = String(options.tenantId ?? row.tenantId ?? '');
				hidden.set(tenantId, [...(hidden.get(tenantId) ?? []), row.id as ID]);
				continue;
			}

			try {
				documents.push({
					...buildDocument(definition, row, {
						tenantId: options.tenantId ?? null,
						organizationId: options.organizationId ?? null,
						engineKey,
						channelIds: channels.get(String(row.id)) ?? []
					}),
					definitionVersion: own ? normaliseVersion(own.version ?? version) : version
				});
			} catch (error) {
				// One unreadable row must not fail the batch: it is counted and reported, and the next
				// run picks it up again.
				skipped += 1;
				this.logger.warn(`A "${definition.entity}" row was skipped while indexing: ${describe(error)}`);
			}
		}

		const indexed = documents.length > 0 ? await provider.index(documents) : 0;
		let removed = 0;

		for (const [tenantId, ids] of hidden) {
			removed += await this.deleteDocuments(provider, definition.entity, ids, {
				tenantId: tenantId || undefined,
				engineKey
			});
		}

		return { entity: definition.entity, indexed, removed, skipped, providerKey: provider.key, read: rows.length };
	}

	/**
	 * Removes the documents of one entity.
	 *
	 * The rows are soft-deleted rather than destroyed: the index is a projection and a rebuild
	 * reproduces it, so nothing is gained by losing the record of what was indexed, and re-indexing
	 * the same source revives the row.
	 *
	 * @param entity The entity key or aggregate type.
	 * @param entityIds The source ids to remove.
	 * @returns How many documents were removed.
	 */
	async remove(entity: string, entityIds: ID[]): Promise<number> {
		const definition = this.definitionFor(entity);
		const ids = (entityIds ?? []).filter(Boolean);

		if (ids.length === 0) {
			return 0;
		}

		const engineKey = (await this.engineKeyOf(definition.entity)) ?? undefined;
		const provider = this.writableProvider(definition, engineKey);

		return await this.deleteDocuments(provider, definition.entity, ids, { engineKey });
	}

	/**
	 * Removes documents through a provider, narrowed to the copies this caller owns.
	 *
	 * A document is keyed by `(tenant, entity, entityId, engine)`. A removal that states only the
	 * entity and the id removes every tenant's copy of it — two tenants that ever share an entity id,
	 * which a seeded demo row or a copied fixture produces — and it removes an external engine's rows
	 * for the same source, leaving that engine's own delete with nothing to do. The engine is always
	 * known here, because it is what selected the provider; the tenant is stated only when the caller
	 * has one, and an unstated tenant keeps the previous cross-tenant behaviour for the sweeps that
	 * genuinely mean it.
	 *
	 * The third parameter is additive: `ISearchProvider.delete` in `@gauzy/contracts` declares two,
	 * and a provider that has not been widened ignores it and behaves exactly as it did.
	 *
	 * @param provider The provider that holds the documents.
	 * @param entity The entity key.
	 * @param entityIds The source ids to remove.
	 * @param scope The tenant and engine the removal belongs to.
	 * @returns How many documents were removed.
	 */
	private async deleteDocuments(
		provider: ISearchProvider,
		entity: string,
		entityIds: ID[],
		scope: { tenantId?: ID | null; engineKey?: string }
	): Promise<number> {
		const narrowed: ISearchDeleteScope = { engineKey: scope.engineKey ?? null };

		if (scope.tenantId) {
			narrowed.tenantId = scope.tenantId;
		}

		return await (provider as unknown as IScopedSearchDelete).delete(entity, entityIds, narrowed);
	}

	/**
	 * Applies one platform event to the index.
	 *
	 * This is the whole event seam, and it is deliberately this small: an event names an aggregate and
	 * an action, and an action is either "read this row again" or "this row is gone". Everything a
	 * document contains is re-read from the source at that moment, so an event is a hint and never the
	 * content — which is what keeps a redelivered event a no-op write of the same document.
	 *
	 * @param event The event envelope.
	 * @returns What the run did, or `undefined` when the event names an entity nothing indexes.
	 */
	async handleEvent(event: IEventEnvelope): Promise<IIndexRunOutcome | undefined> {
		const aggregateId = event?.aggregate?.id;
		const action = String(event?.name ?? '')
			.split('.')
			.pop();
		const entity = this.entityKeyOf(event?.aggregate?.type ?? '');

		if (!entity || !aggregateId) {
			return undefined;
		}

		const definition = this.definitionFor(entity);
		const persisted = await this.persistedDefinitionOf(definition.entity);
		const engineKey = persisted?.engineKey ?? undefined;
		const provider = this.writableProvider(definition, engineKey);

		if (action === 'deleted') {
			const removed = await this.deleteDocuments(provider, definition.entity, [aggregateId], {
				tenantId: event.tenantId ?? undefined,
				engineKey
			});

			return { entity: definition.entity, indexed: 0, removed, skipped: 0, providerKey: provider.key };
		}

		// The live path stamps the declaration's real version, exactly as the sweep does. It used to
		// stamp the default `1` for every event, so the first ordinary update after a re-weighting
		// rewrote a document the sweep had just stamped at version 3 back down to 1 — and the column
		// the reindex index exists to read (`entity, definitionVersion, indexedAt`) stopped
		// identifying stale documents at all.
		//
		// The version passed is the shipped row's; `index` replaces it, row by row, with the version of
		// the row's organization's own copy, and leaves a row whose organization switched the entity off
		// unwritten (Q16). The event path used to read the shipped row alone, so an organization that
		// had switched the entity off was re-indexed by its next ordinary update.
		return await this.index(definition.entity, {
			ids: [aggregateId],
			tenantId: event.tenantId ?? null,
			organizationId: event.organizationId ?? null,
			definitionVersion: Number(persisted?.version ?? 1),
			engineKey
		});
	}

	/**
	 * Reads the source rows one declaration describes.
	 *
	 * The read is paged and ordered by the declaration's own source timestamp, so a sweep over a table
	 * with millions of rows costs a bounded amount of memory and resumes from where it stopped. The
	 * relations the declaration names are preloaded: a title built from a translation is a title built
	 * from the row the domain owns, not from a second lookup per document.
	 *
	 * @param definition The declaration.
	 * @param options Which rows to read.
	 * @returns The source rows.
	 * @throws BadRequestException when nothing maps the declaration's entity.
	 */
	async readSourceRows(
		definition: ISearchIndexRegistration,
		options: ISourceRowQuery = {}
	): Promise<SearchSourceRow[]> {
		const metadata = this.sourceMetadata(definition.entity);

		if (!metadata) {
			throw new BadRequestException(
				`Nothing maps the table "${definition.entity}", so its declaration describes an entity this ` +
					'installation does not have.'
			);
		}

		const criteria = this.sourceCriteria(metadata, definition, options);

		criteria.relations = definition.relations ?? [];
		criteria.skip = options.skip && options.skip > 0 ? options.skip : undefined;
		criteria.take = options.take && options.take > 0 ? options.take : undefined;

		return await this.source.find(metadata, criteria);
	}

	/**
	 * The selection one index run describes, in terms both ORMs can express.
	 *
	 * The scope is applied only where the entity actually carries the property. Not every searchable
	 * entity is tenant- or organization-scoped, and a predicate naming a property the entity does not
	 * declare is an error rather than a wider read — so the check is what lets every caller pass the
	 * scope unconditionally. The property list is the *reading* ORM's, which is the reason it comes
	 * from the source connection rather than from TypeORM's metadata.
	 *
	 * @param metadata The source entity.
	 * @param definition The declaration.
	 * @param options Which rows the caller asked for.
	 * @returns The selection, without its paging.
	 */
	private sourceCriteria(
		metadata: ISearchSourceEntity,
		definition: ISearchIndexRegistration,
		options: ISourceRowQuery
	): ISearchSourceCriteria {
		const updatedField = definition.sourceUpdatedAtField || 'updatedAt';
		const equals: Record<string, unknown> = {};
		const criteria: ISearchSourceCriteria = {};

		if (options.ids?.length) {
			criteria.in = { field: 'id', values: options.ids.map((id) => String(id)) };
		}

		if (options.since) {
			// Stated unconditionally, unlike the scope below: the field is the declaration's own and a
			// declaration naming a column its entity does not have must fail loudly rather than quietly
			// widen an incremental run into a full sweep.
			criteria.gte = { field: updatedField, value: options.since };
		}

		if (options.tenantId && this.hasColumn(metadata, 'tenantId')) {
			equals.tenantId = options.tenantId;
		}

		if (options.organizationId && this.hasColumn(metadata, 'organizationId')) {
			equals.organizationId = options.organizationId;
		}

		if (Object.keys(equals).length > 0) {
			criteria.equals = equals;
		}

		const order: Array<{ field: string; direction: 'ASC' | 'DESC' }> = [];

		if (this.hasColumn(metadata, updatedField)) {
			order.push({ field: updatedField, direction: 'ASC' });
		}

		if (this.hasColumn(metadata, 'id')) {
			order.push({ field: 'id', direction: 'ASC' });
		}

		if (order.length > 0) {
			criteria.order = order;
		}

		return criteria;
	}

	/**
	 * The channels each source row is published to.
	 *
	 * A declaration that names a publication table is channel scoped, and the channels live in that
	 * table rather than on the row: a product is published to a channel by a `product_channel` row.
	 * The pivot is read in one query for the whole batch, and the column that points back at the
	 * entity is discovered from the pivot's own metadata rather than assumed — a package that renames
	 * its foreign key does not silently stop publishing.
	 *
	 * A pivot that cannot be read is a warning and not a failure: the documents are still written,
	 * without channel tokens, which is the same state as an entity that is not channel scoped.
	 *
	 * @param definition The declaration.
	 * @param rows The source rows.
	 * @returns Channel ids by source id.
	 */
	async resolveChannels(
		definition: ISearchIndexRegistration,
		rows: SearchSourceRow[]
	): Promise<Map<string, ID[]>> {
		const resolved = new Map<string, ID[]>();
		const pivotName = definition.channels;

		if (!pivotName || rows.length === 0) {
			return resolved;
		}

		const pivot = this.source.byTable(pivotName);
		const source = this.sourceMetadata(definition.entity);

		if (!pivot || !source) {
			this.logger.warn(
				`The publication table "${pivotName}" of the "${definition.entity}" declaration is not mapped, ` +
					'so its documents carry no channel tokens.'
			);

			return resolved;
		}

		const foreignKey = this.source.foreignKeyOf(pivot, source) ?? `${singular(definition.entity)}Id`;

		if (!this.hasColumn(pivot, foreignKey) || !this.hasColumn(pivot, 'channelId')) {
			this.logger.warn(
				`The publication table "${pivotName}" has no usable "${foreignKey}" or "channelId" column, so the ` +
					`documents of "${definition.entity}" carry no channel tokens.`
			);

			return resolved;
		}

		try {
			const pivots = await this.source.find(pivot, {
				in: { field: foreignKey, values: rows.map((row) => String(row.id)) }
			});

			for (const row of pivots) {
				const sourceId = readPath(row, foreignKey);
				const channelId = readPath(row, 'channelId');

				if (!sourceId || !channelId) {
					continue;
				}

				const key = String(sourceId);
				const channels = resolved.get(key) ?? [];

				if (!channels.includes(channelId as ID)) {
					channels.push(channelId as ID);
				}

				resolved.set(key, channels);
			}
		} catch (error) {
			this.logger.warn(
				`The publication table "${pivotName}" could not be read, so the documents of ` +
					`"${definition.entity}" carry no channel tokens: ${describe(error)}`
			);
		}

		return resolved;
	}

	/**
	 * How many source rows a declaration describes.
	 *
	 * It is the honest answer to "how much work would a rebuild be", and the reason a reindex can
	 * report an estimate before it starts rather than after it finishes. A table nothing maps counts
	 * as zero rather than failing: the request is about the entity, and the entity is absent.
	 *
	 * @param definition The declaration.
	 * @param options The same selection the read takes, minus the paging.
	 * @returns The number of matching source rows.
	 */
	async countSourceRows(
		definition: ISearchIndexRegistration,
		options: Omit<ISourceRowQuery, 'skip' | 'take'> = {}
	): Promise<number> {
		const metadata = this.sourceMetadata(definition.entity);

		if (!metadata) {
			return 0;
		}

		try {
			return await this.source.count(metadata, this.sourceCriteria(metadata, definition, options));
		} catch (error) {
			this.logger.warn(`The "${definition.entity}" source rows could not be counted: ${describe(error)}`);

			return 0;
		}
	}

	/**
	 * The provider a declaration's documents are written to.
	 *
	 * Selection is strict here, unlike a read. A definition written for an engine must be written *by*
	 * that engine: quietly falling back to the built-in index would put the rows in a place the read
	 * path is not looking, and the failure would surface as "search returns nothing" long after the
	 * cause. So a key nothing claims is refused, and the delivery is retried rather than mislaid.
	 *
	 * @param definition The declaration.
	 * @param engineKey The engine the declaration's persisted row names, when it names one.
	 * @returns The provider.
	 * @throws Error when the definition names an engine nothing registered.
	 */
	private writableProvider(definition: ISearchIndexRegistration, engineKey?: string): ISearchProvider {
		const key = String(engineKey ?? '').trim();

		if (!key) {
			return this.providerRegistry.get(this.providerRegistry.defaultKey) as ISearchProvider;
		}

		const provider = this.providerRegistry.get(key);

		if (!provider) {
			throw new Error(
				`The index definition for "${definition.entity}" is written for the engine "${key}", which no ` +
					'registered provider claims. The documents are not written to another backend, because a ' +
					'reader looking for them there would not find them.'
			);
		}

		return provider;
	}

	/**
	 * The engine a declaration's persisted row names.
	 *
	 * The engine key is not part of the declaration in code: a declaration states which fields of which
	 * entity the index holds, and an engine is an installation's choice rather than a fact about the
	 * entity. So it is read from the row the definition sync wrote, and an entity with no row — or a
	 * row with no engine — is the built-in provider's, which is the deployment that needs nothing
	 * configured.
	 *
	 * @param entity The entity key.
	 * @returns The engine key, or `null` when the built-in provider owns the entity.
	 */
	private async engineKeyOf(entity: string): Promise<string | null> {
		return (await this.persistedDefinitionOf(entity))?.engineKey ?? null;
	}

	/**
	 * The persisted half of a declaration: the engine an installation chose and the version an
	 * operator's edits have reached.
	 *
	 * Both are read in one statement because both are needed together on the live path — the engine
	 * decides which provider writes the document, and the version is what the document is stamped
	 * with. Reading them separately meant the event path read the engine and defaulted the version,
	 * which is how the incremental writes drifted a version behind every sweep.
	 *
	 * @param entity The entity key.
	 * @returns The row, or `null` when the entity has no persisted definition or it cannot be read.
	 */
	private async persistedDefinitionOf(entity: string): Promise<IPersistedSearchDefinition | null> {
		try {
			const row = await this.typeOrmSearchIndexDefinitionRepository.findOne({
				where: { entity, organizationId: IsNull() } as any
			});

			return row ?? null;
		} catch (error) {
			this.logger.warn(`The "${entity}" index definition could not be read: ${describe(error)}`);

			return null;
		}
	}

	/**
	 * The organizations' own copies of one declaration, for the organizations a batch of rows belongs to.
	 *
	 * A copy is what `SearchIndexDefinitionService.findFor` answers for its organization, so it is the definition in
	 * force for that organization's rows. The read is bounded by the batch: it names only the organizations the rows
	 * carry (or the one the caller stated), which is a handful per page of a sweep and one for an event. Copies that
	 * cannot be read are a warning, and the rows are written under the shipped definition as they were before.
	 *
	 * @param entity The entity key.
	 * @param rows The batch.
	 * @param options The run's scope.
	 * @returns The copies, by organization id.
	 */
	private async organizationCopiesOf(
		entity: string,
		rows: SearchSourceRow[],
		options: ISourceRowQuery
	): Promise<Map<string, IPersistedSearchDefinition>> {
		const copies = new Map<string, IPersistedSearchDefinition>();
		const organizationIds = [
			...new Set(
				rows
					.map((row) => row.organizationId ?? options.organizationId)
					.filter((value) => !!value)
					.map((value) => String(value))
			)
		];

		if (organizationIds.length === 0) {
			return copies;
		}

		try {
			const found: IPersistedSearchDefinition[] = await this.typeOrmSearchIndexDefinitionRepository.find({
				where: {
					entity,
					organizationId: In(organizationIds),
					...(options.tenantId ? { tenantId: options.tenantId } : {})
				} as any
			});

			for (const copy of found ?? []) {
				if (copy?.organizationId) {
					copies.set(String(copy.organizationId), copy);
				}
			}
		} catch (error) {
			this.logger.warn(
				`The organizations' own "${entity}" index definitions could not be read: ${describe(error)}`
			);
		}

		return copies;
	}

	/**
	 * The metadata of the table a declaration indexes.
	 *
	 * @param entity The entity key.
	 * @returns The metadata, or `undefined` when nothing maps the table.
	 */
	private sourceMetadata(entity: string): ISearchSourceEntity | undefined {
		return this.source.byTable(entity);
	}

	/**
	 * Whether an entity carries a property, as the reading ORM describes it.
	 *
	 * @param metadata The entity.
	 * @param name The property name.
	 * @returns True when the property exists.
	 */
	private hasColumn(metadata: ISearchSourceEntity, name: string): boolean {
		return metadata.properties.has(name);
	}
}

/**
 * One entity key reduced to the form every spelling of it shares.
 *
 * A table is `product_variant`, a class is `ProductVariant` and an outbox row's aggregate type is
 * `PRODUCT_VARIANT` — three spellings of one entity, all of which reach the indexer. Reducing each to
 * lower case without separators is what makes them comparable without guessing at anything else.
 *
 * @param value The key, in any of the platform's spellings.
 * @returns The comparable form.
 */
export function normaliseEntityKey(value: string): string {
	return String(value ?? '')
		.replace(/[_\-\s]/g, '')
		.toLowerCase();
}

/**
 * The organization's own copy of the definition one source row is written under, when its organization has one.
 *
 * The copy must belong to the row's tenant: an organization id is unique, but a copy is a tenant's row and a row of
 * another tenant is never written under it.
 *
 * @param row The source row.
 * @param options The run's scope, whose organization stands in for a row that carries none.
 * @param copies The copies the batch's organizations hold.
 * @returns The copy, or `undefined` when the row is written under the shipped definition.
 */
function ownCopyOf(
	row: SearchSourceRow,
	options: ISourceRowQuery,
	copies: Map<string, IPersistedSearchDefinition>
): IPersistedSearchDefinition | undefined {
	const organizationId = row.organizationId ?? options.organizationId;

	if (!organizationId) {
		return undefined;
	}

	const copy = copies.get(String(organizationId));
	const tenantId = row.tenantId ?? options.tenantId;

	if (!copy || (copy.tenantId && tenantId && String(copy.tenantId) !== String(tenantId))) {
		return undefined;
	}

	return copy;
}

/**
 * The version a document is stamped with.
 *
 * @param value The candidate version.
 * @returns A version of at least one.
 */
function normaliseVersion(value: unknown): number {
	const version = Number(value);

	return Number.isFinite(version) && version >= 1 ? Math.floor(version) : 1;
}

/**
 * The singular of a table name, used to guess a pivot's foreign key when its metadata carries no
 * relation to read it from.
 *
 * @param table The table name.
 * @returns The singular.
 */
function singular(table: string): string {
	return String(table ?? '').replace(/ies$/, 'y').replace(/s$/, '');
}

/**
 * @param error The failure.
 * @returns A one-line description.
 */
function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
