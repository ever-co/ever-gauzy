import { Logger } from '@nestjs/common';
import { DefaultNamingStrategy, getMetadataArgsStorage } from 'typeorm';
import type { MetadataArgsStorage } from 'typeorm/metadata-args/MetadataArgsStorage';
import type { TableMetadataArgs } from 'typeorm/metadata-args/TableMetadataArgs';
import { MetadataUtils } from 'typeorm/metadata-builder/MetadataUtils';
import { MultiORMEnum, getORMType } from '../core/utils';

/** A decorated class, which is what TypeORM's metadata args name as their `target` unless it is a schema's name. */
type EntityClass = Exclude<TableMetadataArgs['target'], string>;

/**
 * TypeORM's metadata under `DB_ORM=mikro-orm`: the entries that name a property TypeORM never saw.
 *
 * 🛑 **Under `DB_ORM=typeorm` — production — this does nothing at all.** {@link pruneTypeOrmSkeletonMetadata}
 * returns before it so much as reads TypeORM's metadata storage, so the metadata, the SQL and the boot of a
 * TypeORM process are exactly what they were without it.
 *
 * **Why it exists.** Both ORMs are initialised whatever `DB_ORM` says (see `database.module.ts`), but the entity
 * decorators register most of a class with the active ORM only: `@MultiORMEntity` gives the class to both, while
 * `@MultiORMColumn`, `@ColumnIndex` and the `@MultiORM*` relation decorators apply the active ORM's decorator
 * alone. Under MikroORM TypeORM therefore sees skeleton entities — a table, the raw TypeORM columns of the base
 * entity, and a handful of raw TypeORM relations — yet the raw TypeORM decorators that sit beside those
 * MultiORM ones still register:
 *
 * - `@RelationId((it) => it.organization)` on `organizationId`, beside a `@MultiORMManyToOne` TypeORM never
 *   received. TypeORM resolves the relation through the entity's `propertiesMap`, reads `undefined`, and
 *   `buildMetadatas` fails with "Cannot find relation undefined. Wrong relation specified for @RelationId
 *   decorator" — so no TypeORM data source could initialise under MikroORM, and the API could not boot, on
 *   `develop` as much as here;
 * - `@Index([...])` and `@Unique([...])` naming properties that are `@MultiORMColumn`s, which fail the same
 *   build with "Index … contains column that is missing in the entity".
 *
 * **What is removed.** Exactly the entries that name a property TypeORM does not know, resolved the way
 * TypeORM resolves them while it builds an entity's metadata:
 *
 * - a `relationIds` entry whose relation — its string, or its function called with the entity's
 *   `propertiesMap` — is not a relation TypeORM has for the entity;
 * - an `indices`, `uniques`, `checks` or `exclusions` entry whose `columns` — the list, or the function called
 *   with the `propertiesMap` — name anything that is neither a column nor a relation of the entity. A
 *   `@Check` or `@Exclusion` carries only a raw SQL expression that TypeORM never resolves against the
 *   entity's properties, so those two kinds are scanned the same way and, naming no property, always kept.
 *
 * An entry declared on a class is built into every entity whose inheritance tree includes that class (an
 * `@RelationId` on `TenantOrganizationBaseEntity` reaches every tenant-and-organization entity), so it is
 * resolved against each of them and removed if any one of them does not know the property. An entry on a class
 * no entity extends — an embeddable, or an unused base — is resolved against that class itself. Everything else
 * in the storage — tables, columns, relations, embeddeds, join columns, trees — is never touched, and what
 * TypeORM knows is computed from exactly those, so removing an entry cannot change whether another resolves.
 *
 * **When it runs.** Once before a TypeORM data source builds its metadata, from the application's
 * `dataSourceFactory` (`database.module.ts`). It is idempotent: a second pass finds nothing left to remove and
 * logs nothing, and an entity class imported after the first pass is still covered by the next one — so any
 * other code that builds its own TypeORM data source under MikroORM (the migration executor, the seeder) can
 * call it too, right before `new DataSource(...)`.
 *
 * Under MikroORM the removed entries only ever described TypeORM's view of properties TypeORM does not map,
 * and nothing under MikroORM reads through a TypeORM relation id or relies on a TypeORM-built index.
 */

/** The kinds of metadata args the pass prunes, in the order it reports them. */
export const TYPEORM_SKELETON_PRUNED_KINDS = ['relationIds', 'indices', 'uniques', 'checks', 'exclusions'] as const;

/** One of the {@link TYPEORM_SKELETON_PRUNED_KINDS}. */
export type TypeOrmSkeletonPrunedKind = (typeof TYPEORM_SKELETON_PRUNED_KINDS)[number];

/** How many entries one pass removed, per kind. */
export type ITypeOrmSkeletonPruneReport = Record<TypeOrmSkeletonPrunedKind, number>;

/** Where the pass says what it removed: once, the first time it removes anything. */
const defaultLogger = new Logger('TypeOrmSkeletonMetadata');

/**
 * Removes, from TypeORM's metadata storage, every entry that names a property TypeORM does not know — ONLY
 * when the active ORM is MikroORM. See the file header for what is removed and why.
 *
 * @param storage - The storage to prune. Defaults to TypeORM's global one, which every decorator writes to;
 * the parameter exists so a spec can hand in its own. Not read at all under TypeORM.
 * @param logger - Where to report the counts. Called only when the pass removed something.
 * @returns How many entries were removed per kind, or `null` when the active ORM is not MikroORM and nothing
 * was looked at.
 */
export function pruneTypeOrmSkeletonMetadata(
	storage?: MetadataArgsStorage,
	logger: Pick<Logger, 'log'> = defaultLogger
): ITypeOrmSkeletonPruneReport | null {
	// 🛑 Production runs TypeORM: leave before the storage — or anything else — is read.
	if (getORMType() !== MultiORMEnum.MikroORM) {
		return null;
	}

	const report = pruneUnknownProperties(storage ?? getMetadataArgsStorage());
	const removed = TYPEORM_SKELETON_PRUNED_KINDS.reduce((total, kind) => total + report[kind], 0);

	if (removed > 0) {
		const perKind = TYPEORM_SKELETON_PRUNED_KINDS.map((kind) => `${kind}: ${report[kind]}`).join(', ');
		logger.log(
			`DB_ORM=mikro-orm: removed ${removed} TypeORM metadata entries naming properties only MikroORM maps (${perKind})`
		);
	}

	return report;
}

/**
 * The pass itself, with no ORM check: callers go through {@link pruneTypeOrmSkeletonMetadata}.
 *
 * @param storage - The storage to prune, in place.
 * @returns How many entries were removed per kind.
 */
function pruneUnknownProperties(storage: MetadataArgsStorage): ITypeOrmSkeletonPruneReport {
	const resolver = new TypeOrmPropertyResolver(storage);

	return {
		relationIds: removeWhere(
			storage.relationIds,
			(entry) =>
				!resolver.resolvesForEveryEntity(entry.target, (known) => resolvesRelation(known, entry.relation))
		),
		indices: removeWhere(
			storage.indices,
			(entry) => !resolver.resolvesForEveryEntity(entry.target, (known) => resolvesColumns(known, entry.columns))
		),
		uniques: removeWhere(
			storage.uniques,
			(entry) => !resolver.resolvesForEveryEntity(entry.target, (known) => resolvesColumns(known, entry.columns))
		),
		// Neither carries a `columns` list today (see the file header); read it the same way so a TypeORM that
		// adds one is covered rather than silently skipped.
		checks: removeWhere(
			storage.checks,
			(entry) =>
				!resolver.resolvesForEveryEntity(entry.target, (known) => resolvesColumns(known, columnsOf(entry)))
		),
		exclusions: removeWhere(
			storage.exclusions,
			(entry) =>
				!resolver.resolvesForEveryEntity(entry.target, (known) => resolvesColumns(known, columnsOf(entry)))
		)
	};
}

/** The `columns` an index-like entry names: a list of property names, or a function of the `propertiesMap`. */
type EntryColumns = string[] | ((propertiesMap?: any) => any[] | { [key: string]: number }) | undefined;

/** The `columns` of an entry whose TypeORM type declares none. */
function columnsOf(entry: object): EntryColumns {
	return (entry as { columns?: EntryColumns }).columns;
}

/** What TypeORM knows about one entity's properties once it has built the entity's metadata. */
interface IKnownProperties {
	/**
	 * The entity's `propertiesMap` — `{ id: 'id', embedded: { field: 'embedded.field' }, relation: 'relation' }` —
	 * which is what TypeORM calls a `@RelationId` function and an index's column function with.
	 */
	readonly propertiesMap: Record<string, unknown>;
	/** Property paths of the entity's columns, embedded ones included (`embedded.field`). */
	readonly columns: ReadonlySet<string>;
	/** Property paths of the entity's relations, embedded ones included. */
	readonly relations: ReadonlySet<string>;
}

/**
 * Whether a `@RelationId` resolves, as `RelationIdMetadata.build()` resolves it: the relation's name, or its
 * function called with the `propertiesMap`, must be the property path of one of the entity's relations.
 */
function resolvesRelation(known: IKnownProperties, relation: string | ((propertiesMap: any) => any)): boolean {
	const path = typeof relation === 'function' ? attempt(() => relation(known.propertiesMap)) : relation;
	return typeof path === 'string' && known.relations.has(path);
}

/**
 * Whether every property an index, unique, check or exclusion names is one TypeORM knows, as
 * `IndexMetadata.build()` and `UniqueMetadata.build()` read them: a list is trimmed name by name; a function is
 * called with the `propertiesMap` and answers a list (names) or an object (its keys). A name must be a column or a
 * relation of the entity. No `columns` names nothing, and resolves.
 */
function resolvesColumns(known: IKnownProperties, columns: EntryColumns): boolean {
	if (!columns) {
		return true;
	}

	let names: string[];
	if (Array.isArray(columns)) {
		names = columns.map((name) => String(name).trim());
	} else {
		const resolved = attempt(() => columns(known.propertiesMap));
		if (resolved === UNRESOLVED) {
			return false;
		}
		names = Array.isArray(resolved) ? resolved.map((name) => String(name)) : Object.keys(resolved ?? {});
	}

	return names.every((name) => known.columns.has(name) || known.relations.has(name));
}

/** What {@link attempt} answers for a function that threw — reading through an embedded TypeORM never saw. */
const UNRESOLVED = Symbol('unresolved');

/** Calls `fn`, answering {@link UNRESOLVED} if it throws: TypeORM's build would throw at the same point. */
function attempt<T>(fn: () => T): T | typeof UNRESOLVED {
	try {
		return fn();
	} catch {
		return UNRESOLVED;
	}
}

/**
 * Removes, in place, every entry `unresolvable` answers `true` for, keeping the others in their order.
 *
 * In place rather than by assigning a filtered copy: the storage's arrays are `readonly` properties, and every
 * decorator reaches them afresh through `getMetadataArgsStorage()`.
 *
 * @returns How many entries were removed.
 */
function removeWhere<T>(entries: T[], unresolvable: (entry: T) => boolean): number {
	let kept = 0;
	for (const entry of entries) {
		if (!unresolvable(entry)) {
			entries[kept++] = entry;
		}
	}

	const removed = entries.length - kept;
	entries.length = kept;
	return removed;
}

/**
 * Computes what TypeORM will know about each entity, from the same metadata args and by the same rules
 * `EntityMetadataBuilder` uses — the inheritance tree, the storage's own `filter*` methods, embeddeds, and the
 * columns TypeORM generates itself — without building a data source.
 *
 * It reads only tables, columns, relations, embeddeds, trees and inheritances, none of which the pass removes,
 * so what it memoises stays true for the whole pass.
 */
class TypeOrmPropertyResolver {
	/** Every entity class TypeORM builds metadata for. */
	private readonly entities: EntityClass[];
	private readonly inheritanceTrees = new Map<EntityClass, EntityClass[]>();
	private readonly consumers = new Map<EntityClass, EntityClass[]>();
	private readonly known = new Map<EntityClass, IKnownProperties>();

	constructor(private readonly storage: MetadataArgsStorage) {
		this.entities = storage.tables.map((table) => table.target).filter(isClass);
	}

	/**
	 * Whether `resolves` holds for every entity an entry declared on `target` is built into.
	 *
	 * An entry on a string target (an entity schema's name) is not one a decorator wrote, and is kept.
	 */
	resolvesForEveryEntity(target: EntityClass | string, resolves: (known: IKnownProperties) => boolean): boolean {
		if (!isClass(target)) {
			return true;
		}

		return this.consumersOf(target).every((entity) => resolves(this.knownPropertiesOf(entity)));
	}

	/**
	 * Every entity whose inheritance tree includes `target`, which is every entity `filterRelationIds`,
	 * `filterIndices` and the rest hand an entry on `target` to — or `target` itself when no entity extends it.
	 */
	private consumersOf(target: EntityClass): EntityClass[] {
		let consumers = this.consumers.get(target);
		if (!consumers) {
			consumers = this.entities.filter((entity) => this.inheritanceTreeOf(entity).includes(target));
			if (consumers.length === 0) {
				consumers = [target];
			}
			this.consumers.set(target, consumers);
		}
		return consumers;
	}

	/**
	 * The classes TypeORM collects an entity's metadata args from (`EntityMetadataBuilder.createEntityMetadata`):
	 * the class and its ancestors, plus — for single-table inheritance — every child entity of the table.
	 */
	private inheritanceTreeOf(target: EntityClass): EntityClass[] {
		let tree = this.inheritanceTrees.get(target);
		if (!tree) {
			tree = MetadataUtils.getInheritanceTree(target);

			const isChildEntity = this.storage.tables.some(
				(table) => table.target === target && table.type === 'entity-child'
			);
			if (this.storage.findInheritanceType(target)?.pattern === 'STI' || isChildEntity) {
				tree.push(
					...this.storage
						.filterSingleTableChildren(target)
						.map((table) => table.target)
						.filter(isClass)
				);
			}
			this.inheritanceTrees.set(target, tree);
		}
		return tree;
	}

	/** What TypeORM knows about `entity`'s properties: its `propertiesMap`, columns and relations. */
	private knownPropertiesOf(entity: EntityClass): IKnownProperties {
		let known = this.known.get(entity);
		if (!known) {
			known = this.describe(this.inheritanceTreeOf(entity), '');
			for (const generated of this.generatedColumnsOf(entity)) {
				(known.columns as Set<string>).add(generated);
				known.propertiesMap[generated] = generated;
			}
			this.known.set(entity, known);
		}
		return known;
	}

	/**
	 * The properties the classes in `tree` declare, with their paths under `prefix` — `EntityMetadata`'s
	 * `createPropertiesMap()`, from the args its columns, embeddeds and relations are built from.
	 */
	private describe(tree: EntityClass[], prefix: string): IKnownProperties {
		const propertiesMap: Record<string, unknown> = {};
		const columns = new Set<string>();
		const relations = new Set<string>();

		for (const column of this.storage.filterColumns(tree)) {
			propertiesMap[column.propertyName] = prefix + column.propertyName;
			columns.add(prefix + column.propertyName);
		}

		for (const embedded of this.storage.filterEmbeddeds(tree)) {
			const type = embedded.type();
			if (!isClass(type)) {
				continue;
			}

			const nested = this.describe(MetadataUtils.getInheritanceTree(type), `${prefix}${embedded.propertyName}.`);
			propertiesMap[embedded.propertyName] = nested.propertiesMap;
			nested.columns.forEach((path) => columns.add(path));
			nested.relations.forEach((path) => relations.add(path));
		}

		for (const relation of this.storage.filterRelations(tree)) {
			propertiesMap[relation.propertyName] = prefix + relation.propertyName;
			relations.add(prefix + relation.propertyName);
		}

		return { propertiesMap, columns, relations };
	}

	/**
	 * The columns TypeORM adds to an entity without a decorator declaring them (`computeEntityMetadataStep1`): the
	 * discriminator of a single-table hierarchy, and the path columns of a materialized-path or nested-set tree —
	 * named here by TypeORM's default naming strategy. A child entity of a single-table hierarchy takes its
	 * parent's.
	 */
	private generatedColumnsOf(entity: EntityClass): string[] {
		const parent = this.storage.tables.some((table) => table.target === entity && table.type === 'entity-child')
			? this.entities.find(
					(candidate) =>
						this.storage.findInheritanceType(candidate)?.pattern === 'STI' &&
						this.inheritanceTreeOf(candidate).includes(entity)
				)
			: undefined;
		const owner = parent ?? entity;
		const generated: string[] = [];

		const inheritance = this.storage.findInheritanceType(owner);
		if (inheritance?.column) {
			generated.push(inheritance.column.name ?? 'type');
		}

		const treeType =
			this.storage.findTree(entity)?.type ?? (parent ? this.storage.findTree(parent)?.type : undefined);
		if (treeType === 'materialized-path') {
			generated.push('mpath');
		} else if (treeType === 'nested-set') {
			const { left, right } = new DefaultNamingStrategy().nestedSetColumnNames;
			generated.push(left, right);
		}

		return generated;
	}
}

/** Whether a metadata target is a class — a decorator's target — rather than an entity schema's name. */
function isClass(target: unknown): target is EntityClass {
	return typeof target === 'function';
}
