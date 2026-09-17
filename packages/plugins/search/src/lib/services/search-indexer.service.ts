import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityMetadata, In, IsNull, MoreThanOrEqual } from 'typeorm';
import { ID, IEventEnvelope, ISearchDocument, ISearchIndexRegistration, ISearchProvider } from '@gauzy/contracts';
import { TypeOrmSearchIndexDefinitionRepository } from '@gauzy/core';
import { SearchIndexRegistry } from '../registry/search-index.registry';
import { SearchProviderRegistry } from '../providers/search-provider.registry';
import { buildDocument, readPath, SearchSourceRow } from './search-document.builder';

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

/** What one indexing run did. */
export interface IIndexRunOutcome {
	entity: string;
	indexed: number;
	removed: number;
	skipped: number;
	/** The provider that answered, so a caller can say which backend holds the documents. */
	providerKey: string;
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
 */
@Injectable()
export class SearchIndexerService {
	private readonly logger = new Logger(SearchIndexerService.name);

	constructor(
		private readonly dataSource: DataSource,
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

		const byTable = this.dataSource.entityMetadatas.find((metadata) => metadata.tableName === key);

		if (byTable) {
			return byTable.tableName;
		}

		const byClass = this.dataSource.entityMetadatas.find(
			(metadata) => metadata.name === key || metadata.targetName === key
		);

		return byClass?.tableName;
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
		const engineKey = options.engineKey ?? (await this.engineKeyOf(definition.entity)) ?? undefined;
		const provider = this.writableProvider(definition, engineKey);
		const rows = await this.readSourceRows(definition, options);

		if (rows.length === 0) {
			// An absent source row is success, not an error: the row was deleted between the event and
			// this run, and the document that describes it is removed rather than left stale.
			const removed = options.ids?.length ? await provider.delete(definition.entity, options.ids) : 0;

			return { entity: definition.entity, indexed: 0, removed, skipped: 0, providerKey: provider.key };
		}

		const channels = await this.resolveChannels(definition, rows);
		const version = normaliseVersion(options.definitionVersion ?? 1);
		let skipped = 0;
		const documents: ISearchDocument[] = [];

		for (const row of rows) {
			try {
				documents.push({
					...buildDocument(definition, row, {
						tenantId: options.tenantId ?? null,
						organizationId: options.organizationId ?? null,
						engineKey,
						channelIds: channels.get(String(row.id)) ?? []
					}),
					definitionVersion: version
				});
			} catch (error) {
				// One unreadable row must not fail the batch: it is counted and reported, and the next
				// run picks it up again.
				skipped += 1;
				this.logger.warn(`A "${definition.entity}" row was skipped while indexing: ${describe(error)}`);
			}
		}

		const indexed = documents.length > 0 ? await provider.index(documents) : 0;

		return { entity: definition.entity, indexed, removed: 0, skipped, providerKey: provider.key };
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

		return await this.writableProvider(definition).delete(definition.entity, ids);
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
		const engineKey = (await this.engineKeyOf(definition.entity)) ?? undefined;
		const provider = this.writableProvider(definition, engineKey);

		if (action === 'deleted') {
			const removed = await provider.delete(definition.entity, [aggregateId]);

			return { entity: definition.entity, indexed: 0, removed, skipped: 0, providerKey: provider.key };
		}

		return await this.index(definition.entity, {
			ids: [aggregateId],
			tenantId: event.tenantId ?? null,
			organizationId: event.organizationId ?? null,
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

		const updatedField = definition.sourceUpdatedAtField || 'updatedAt';
		const where: Record<string, unknown> = {};

		if (options.ids?.length) {
			where.id = In(options.ids.map((id) => String(id)));
		}

		if (options.since) {
			where[updatedField] = MoreThanOrEqual(options.since);
		}

		if (options.tenantId) {
			where.tenantId = options.tenantId;
		}

		if (options.organizationId) {
			where.organizationId = options.organizationId;
		}

		const order: Record<string, 'ASC' | 'DESC'> = {};

		if (this.hasColumn(metadata, updatedField)) {
			order[updatedField] = 'ASC';
		}

		if (this.hasColumn(metadata, 'id')) {
			order.id = 'ASC';
		}

		return (await this.dataSource.getRepository(metadata.target).find({
			where: where as any,
			relations: (definition.relations ?? []) as any,
			order: order as any,
			skip: options.skip && options.skip > 0 ? options.skip : undefined,
			take: options.take && options.take > 0 ? options.take : undefined
		})) as SearchSourceRow[];
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

		const pivot = this.dataSource.entityMetadatas.find((metadata) => metadata.tableName === pivotName);
		const source = this.sourceMetadata(definition.entity);

		if (!pivot || !source) {
			this.logger.warn(
				`The publication table "${pivotName}" of the "${definition.entity}" declaration is not mapped, ` +
					'so its documents carry no channel tokens.'
			);

			return resolved;
		}

		const relation = pivot.relations.find(
			(candidate) => candidate.inverseEntityMetadata?.tableName === source.tableName
		);
		const foreignKey = relation?.joinColumns?.[0]?.propertyName ?? `${singular(definition.entity)}Id`;

		if (!this.hasColumn(pivot, foreignKey) || !this.hasColumn(pivot, 'channelId')) {
			this.logger.warn(
				`The publication table "${pivotName}" has no usable "${foreignKey}" or "channelId" column, so the ` +
					`documents of "${definition.entity}" carry no channel tokens.`
			);

			return resolved;
		}

		try {
			const pivots = (await this.dataSource.getRepository(pivot.target).find({
				where: { [foreignKey]: In(rows.map((row) => String(row.id))) } as any
			})) as SearchSourceRow[];

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

		const where: Record<string, unknown> = {};

		if (options.ids?.length) {
			where.id = In(options.ids.map((id) => String(id)));
		}

		if (options.since) {
			where[definition.sourceUpdatedAtField || 'updatedAt'] = MoreThanOrEqual(options.since);
		}

		if (options.tenantId) {
			where.tenantId = options.tenantId;
		}

		if (options.organizationId) {
			where.organizationId = options.organizationId;
		}

		try {
			return await this.dataSource.getRepository(metadata.target).count({ where: where as any });
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
		try {
			const row = await this.typeOrmSearchIndexDefinitionRepository.findOne({
				where: { entity, organizationId: IsNull() } as any
			});

			return row?.engineKey ?? null;
		} catch (error) {
			this.logger.warn(`The "${entity}" index definition could not be read: ${describe(error)}`);

			return null;
		}
	}

	/**
	 * The metadata of the table a declaration indexes.
	 *
	 * @param entity The entity key.
	 * @returns The metadata, or `undefined` when nothing maps the table.
	 */
	private sourceMetadata(entity: string): EntityMetadata | undefined {
		const key = String(entity ?? '').trim();

		return key ? this.dataSource.entityMetadatas.find((metadata) => metadata.tableName === key) : undefined;
	}

	/**
	 * Whether an entity carries a column.
	 *
	 * @param metadata The entity's metadata.
	 * @param name The column's property name.
	 * @returns True when the column exists.
	 */
	private hasColumn(metadata: EntityMetadata, name: string): boolean {
		return Boolean(metadata.columns.find((column) => column.propertyName === name));
	}
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
