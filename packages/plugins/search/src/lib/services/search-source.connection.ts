import { Injectable, Logger, Optional } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { DataSource, EntityMetadata, In, MoreThanOrEqual } from 'typeorm';
import { getORMType, MultiORMEnum } from '@gauzy/core';
import { SearchSourceRow } from './search-document.builder';

/**
 * One searchable table, as whichever ORM will actually read it describes it.
 *
 * The indexer only ever needs three facts about a source table: what it is called, what the class
 * behind it is, and which properties it declares. Everything else — how a row is read, how a
 * relation is preloaded, how an ordering is expressed — belongs to the ORM and is answered by
 * {@link SearchSourceConnection}.
 */
export interface ISearchSourceEntity {
	/** The table the rows live in. This is the key a declaration and a search request both use. */
	tableName: string;
	/** The class name a platform event names the aggregate by, for example `ProductVariant`. */
	className: string;
	/** The class the rows are read through. */
	target: any;
	/**
	 * The property names the reading ORM declares for the entity.
	 *
	 * It is the reading ORM's list and not the other one's, which is the whole point of the type:
	 * `@MultiORMColumn` emits only the active ORM's decorator, so under `DB_ORM=mikro-orm` TypeORM's
	 * metadata for the same class carries four columns — `id`, `createdAt`, `updatedAt`, `deletedAt`
	 * — and nothing else. A `tenantId` predicate built from that list is an
	 * `EntityPropertyNotFoundError`, and an ordering built from it is silently dropped.
	 */
	properties: ReadonlySet<string>;
}

/** How one page of source rows is selected, in terms both ORMs can express. */
export interface ISearchSourceCriteria {
	/** `field IN (values)`. */
	in?: { field: string; values: string[] };
	/** `field >= value`. */
	gte?: { field: string; value: Date };
	/** `field = value`, for each entry. */
	equals?: Record<string, unknown>;
	/** Relations to preload, named the way the declaration names them. */
	relations?: string[];
	/** The ordering, applied in the order the entries are given. */
	order?: Array<{ field: string; direction: 'ASC' | 'DESC' }>;
	/** How many rows to skip. */
	skip?: number;
	/** How many rows to read. */
	take?: number;
}

/**
 * The source half of the index, over whichever ORM the installation selected.
 *
 * The whole write path used to be wired to TypeORM: `dataSource.entityMetadatas` for the metadata,
 * `dataSource.getRepository(target).find(...)` for the rows and `metadata.columns` for the "does this
 * entity carry that column" probes. Under `DB_ORM=mikro-orm` none of that describes the entities the
 * platform is actually running: `MultiORMEntity` applies TypeORM's `@Entity()` unconditionally, so
 * the table names are still there and nothing fails at boot, but `@MultiORMColumn` applies only the
 * active ORM's decorator — so every domain column is missing from TypeORM's metadata. The ordering is
 * dropped, the tenant predicate raises `EntityPropertyNotFoundError`, and global search returns
 * nothing for the whole installation with no boot-time error to point at.
 *
 * Both ORMs' connections are global and both are initialised on every boot
 * (`packages/core/src/lib/database/database.module.ts`), so both are injected optionally and exactly
 * one of them reads. The configured ORM is preferred and the other is the fallback, which is the same
 * rule `MeasurementAuditConnection` follows for the same reason: an installation whose `DB_ORM` names
 * one ORM while both connections were started still reads through the one it actually writes with.
 */
@Injectable()
export class SearchSourceConnection {
	private readonly logger = new Logger(SearchSourceConnection.name);

	constructor(
		@Optional() private readonly dataSource?: DataSource,
		@Optional() private readonly mikroOrm?: MikroORM
	) {}

	/**
	 * Whether this connection can read at all.
	 *
	 * @returns True when one of the two ORMs was injected.
	 */
	get available(): boolean {
		return this.usesMikroOrm() || Boolean(this.dataSource);
	}

	/**
	 * Every entity the reading ORM maps.
	 *
	 * @returns The entities, in the order the ORM discovered them.
	 */
	entities(): ISearchSourceEntity[] {
		if (this.usesMikroOrm()) {
			return Object.values(this.mikroOrm.getMetadata().getAll()).map((metadata) => ({
				tableName: String(metadata.tableName ?? metadata.collection ?? ''),
				className: String(metadata.className ?? metadata.name ?? ''),
				target: metadata.class,
				properties: new Set<string>(Object.keys(metadata.properties ?? {}))
			}));
		}

		return (this.dataSource?.entityMetadatas ?? []).map((metadata) => this.fromTypeOrm(metadata));
	}

	/**
	 * The entity that maps one table.
	 *
	 * @param table The table name.
	 * @returns The entity, or `undefined` when nothing maps the table.
	 */
	byTable(table: string): ISearchSourceEntity | undefined {
		const key = String(table ?? '').trim();

		return key ? this.entities().find((entity) => entity.tableName === key) : undefined;
	}

	/**
	 * The entity one class name names.
	 *
	 * @param name The class name, as a platform event states its aggregate type.
	 * @returns The entity, or `undefined` when nothing carries the name.
	 */
	byClassName(name: string): ISearchSourceEntity | undefined {
		const key = String(name ?? '').trim();

		return key ? this.entities().find((entity) => entity.className === key) : undefined;
	}

	/**
	 * Reads a page of source rows.
	 *
	 * @param entity The entity to read.
	 * @param criteria Which rows to read, and how many.
	 * @returns The rows.
	 * @throws Error when neither ORM is available.
	 */
	async find(entity: ISearchSourceEntity, criteria: ISearchSourceCriteria = {}): Promise<SearchSourceRow[]> {
		this.assertAvailable();

		if (this.usesMikroOrm()) {
			const options: Record<string, unknown> = {};
			const orderBy = this.mikroOrderBy(criteria.order);

			if (criteria.relations?.length) {
				options.populate = criteria.relations;
			}

			if (orderBy) {
				options.orderBy = orderBy;
			}

			if (criteria.skip && criteria.skip > 0) {
				options.offset = criteria.skip;
			}

			if (criteria.take && criteria.take > 0) {
				options.limit = criteria.take;
			}

			// A fork rather than the shared entity manager: the indexer runs inside a request on one
			// path and inside a queue consumer on another, and MikroORM refuses context-specific calls
			// on the global instance. A fork has its own identity map, so a sweep over millions of rows
			// does not accumulate one.
			const rows = await this.mikroOrm.em
				.fork()
				.find(entity.target, this.mikroWhere(criteria) as any, options as any);

			return rows as unknown as SearchSourceRow[];
		}

		if (!this.dataSource) {
			throw new Error('SEARCH_SOURCE_NO_CONNECTION: neither ORM is available to the search indexer.');
		}

		return (await this.dataSource.getRepository(entity.target).find({
			where: this.typeOrmWhere(criteria) as any,
			relations: (criteria.relations ?? []) as any,
			order: this.typeOrmOrder(criteria.order) as any,
			skip: criteria.skip && criteria.skip > 0 ? criteria.skip : undefined,
			take: criteria.take && criteria.take > 0 ? criteria.take : undefined
		})) as SearchSourceRow[];
	}

	/**
	 * Counts the source rows a selection covers.
	 *
	 * @param entity The entity to count.
	 * @param criteria Which rows to count; the paging members are ignored.
	 * @returns The number of matching rows.
	 * @throws Error when neither ORM is available.
	 */
	async count(entity: ISearchSourceEntity, criteria: ISearchSourceCriteria = {}): Promise<number> {
		this.assertAvailable();

		if (this.usesMikroOrm()) {
			return await this.mikroOrm.em.fork().count(entity.target, this.mikroWhere(criteria) as any);
		}

		if (!this.dataSource) {
			throw new Error('SEARCH_SOURCE_NO_CONNECTION: neither ORM is available to the search indexer.');
		}

		return await this.dataSource.getRepository(entity.target).count({ where: this.typeOrmWhere(criteria) as any });
	}

	/**
	 * The name of the property that points from a pivot row back at the entity it publishes.
	 *
	 * A publication table names its own foreign key, and a package that renames it must not silently
	 * stop publishing — so the name is read from the pivot's own metadata rather than assumed. Only
	 * the shape of the metadata differs between the two ORMs, not the question.
	 *
	 * @param pivot The publication table.
	 * @param source The entity it publishes.
	 * @returns The property name, or `undefined` when the metadata carries no relation between them.
	 */
	foreignKeyOf(pivot: ISearchSourceEntity, source: ISearchSourceEntity): string | undefined {
		if (this.usesMikroOrm()) {
			const metadata = this.mikroOrm.getMetadata().getAll()[pivot.className];
			const relation = (metadata?.relations ?? []).find(
				(candidate: any) =>
					String(candidate?.targetMeta?.tableName ?? '') === source.tableName ||
					String(candidate?.type ?? '') === source.className
			);

			// MikroORM names the owning property, and the property is what a `where` addresses; the
			// column behind it is `fieldNames[0]`, which is the same value TypeORM's join column carries.
			return relation ? String(relation.fieldNames?.[0] ?? relation.name) : undefined;
		}

		const metadata = this.dataSource?.entityMetadatas.find((candidate) => candidate.tableName === pivot.tableName);
		const relation = metadata?.relations.find(
			(candidate) => candidate.inverseEntityMetadata?.tableName === source.tableName
		);

		return relation?.joinColumns?.[0]?.propertyName;
	}

	/**
	 * Whether the MikroORM arm is the one in use.
	 *
	 * @returns True when the configured ORM is MikroORM and its connection was injected, or when it is
	 * the only connection there is.
	 */
	private usesMikroOrm(): boolean {
		if (!this.mikroOrm) {
			return false;
		}

		return getORMType() === MultiORMEnum.MikroORM || !this.dataSource;
	}

	/**
	 * Renders one TypeORM metadata into the shape the indexer reads.
	 *
	 * @param metadata The metadata.
	 * @returns The entity.
	 */
	private fromTypeOrm(metadata: EntityMetadata): ISearchSourceEntity {
		return {
			tableName: metadata.tableName,
			className: metadata.targetName || metadata.name,
			target: metadata.target,
			properties: new Set<string>(metadata.columns.map((column) => column.propertyName))
		};
	}

	/**
	 * The TypeORM `where` of a selection.
	 *
	 * @param criteria The selection.
	 * @returns The `where`.
	 */
	private typeOrmWhere(criteria: ISearchSourceCriteria): Record<string, unknown> {
		const where: Record<string, unknown> = { ...(criteria.equals ?? {}) };

		if (criteria.in) {
			where[criteria.in.field] = In(criteria.in.values);
		}

		if (criteria.gte) {
			where[criteria.gte.field] = MoreThanOrEqual(criteria.gte.value);
		}

		return where;
	}

	/**
	 * The MikroORM `where` of a selection.
	 *
	 * @param criteria The selection.
	 * @returns The `where`.
	 */
	private mikroWhere(criteria: ISearchSourceCriteria): Record<string, unknown> {
		const where: Record<string, unknown> = { ...(criteria.equals ?? {}) };

		if (criteria.in) {
			where[criteria.in.field] = { $in: criteria.in.values };
		}

		if (criteria.gte) {
			where[criteria.gte.field] = { $gte: criteria.gte.value };
		}

		return where;
	}

	/**
	 * The TypeORM ordering of a selection.
	 *
	 * @param order The ordering.
	 * @returns The ordering, or `undefined` when there is none.
	 */
	private typeOrmOrder(
		order?: Array<{ field: string; direction: 'ASC' | 'DESC' }>
	): Record<string, 'ASC' | 'DESC'> | undefined {
		if (!order?.length) {
			return undefined;
		}

		const rendered: Record<string, 'ASC' | 'DESC'> = {};

		for (const entry of order) {
			rendered[entry.field] = entry.direction;
		}

		return rendered;
	}

	/**
	 * The MikroORM ordering of a selection.
	 *
	 * @param order The ordering.
	 * @returns The ordering, or `undefined` when there is none.
	 */
	private mikroOrderBy(
		order?: Array<{ field: string; direction: 'ASC' | 'DESC' }>
	): Record<string, 'ASC' | 'DESC'> | undefined {
		if (!order?.length) {
			return undefined;
		}

		const rendered: Record<string, 'ASC' | 'DESC'> = {};

		for (const entry of order) {
			rendered[entry.field] = entry.direction;
		}

		return rendered;
	}

	/**
	 * Refuses a read when neither ORM is available.
	 *
	 * An installation that indexes nothing because no connection was injected is the one failure this
	 * class cannot recover from, and it is worth naming rather than answering with an empty page that
	 * looks like an empty table.
	 *
	 * @throws Error when neither connection is present.
	 */
	private assertAvailable(): void {
		if (this.available) {
			return;
		}

		this.logger.error(
			'Neither ORM is available to the search indexer, so no document can be built and no source ' +
				'row can be re-read. The index will answer nothing until a connection is present.'
		);

		throw new Error('SEARCH_SOURCE_NO_CONNECTION: neither ORM is available to the search indexer.');
	}
}
