// Imported while `DB_ORM` is unset, so these classes carry the TypeORM mapping production runs.
import { coreEntities } from '../core/entities';

import { Logger } from '@nestjs/common';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import {
	ChildEntity,
	Column,
	DataSource,
	DataSourceOptions,
	Entity,
	EntityMetadata,
	Index,
	ManyToOne,
	PrimaryColumn,
	RelationId,
	TableInheritance,
	Tree,
	TreeChildren,
	TreeParent,
	Unique,
	getMetadataArgsStorage
} from 'typeorm';
import type { TableMetadataArgs } from 'typeorm/metadata-args/TableMetadataArgs';
import { DatabaseModule } from './database.module';
import {
	ITypeOrmSkeletonPruneReport,
	TYPEORM_SKELETON_PRUNED_KINDS,
	TypeOrmSkeletonPrunedKind,
	pruneTypeOrmSkeletonMetadata
} from './typeorm-skeleton-metadata';

/**
 * TypeORM's metadata under `DB_ORM=mikro-orm`, and the proof that nothing changes under `DB_ORM=typeorm`.
 *
 * Under MikroORM the `@MultiORM*` decorators register columns and relations with MikroORM alone, but the raw
 * TypeORM `@RelationId`, `@Index` and `@Unique` beside them still register — so TypeORM, which both ORMs'
 * boot initialises, failed its metadata build with "Cannot find relation undefined", and the API could not
 * start. The platform's own `dataSourceFactory` (`database.module.ts`) now prunes those entries first.
 *
 * Everything below goes through TypeORM itself: the real core entities are loaded under each ORM, the data
 * source is built by the exact factory `DatabaseModule` hands `TypeOrmModule`, and what the pruner removed is
 * checked against the metadata TypeORM then built — not against the pruner's own idea of it.
 *
 * The decorators register the active ORM's mapping at class-definition time, so the MikroORM half re-imports
 * the entities in a fresh module registry with `DB_ORM=mikro-orm`, as `product-category.entity.mikro-orm.spec.ts`
 * does. TypeORM's metadata storage is a global, so both sets of classes land in the one storage the pruner reads.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures: raw TypeORM decorators in the shapes the skeleton produces
// ─────────────────────────────────────────────────────────────────────────────

@Entity('skeleton_fixture_parent')
class SkeletonParent {
	@PrimaryColumn()
	id!: string;
}

/**
 * The shape of every platform entity under MikroORM: `parent` is a relation only MikroORM received (no TypeORM
 * decorator), yet the raw TypeORM `@RelationId` and `@Index` naming it — or a column MikroORM alone maps — are here.
 */
@Entity('skeleton_fixture_row')
@Index(['id', 'code'])
@Unique(['code'])
@Index(['id'])
@Index(['owner'])
class SkeletonRow {
	@PrimaryColumn()
	id!: string;

	/** A MikroORM-only column: no TypeORM decorator. */
	code?: string;

	/** A MikroORM-only relation: no TypeORM decorator. */
	parent?: SkeletonParent;

	@RelationId((it: SkeletonRow) => it.parent)
	parentId?: string;

	@RelationId('parent')
	parentIdByName?: string;

	@ManyToOne(() => SkeletonParent, { nullable: true })
	owner?: SkeletonParent;

	@RelationId((it: SkeletonRow) => it.owner)
	ownerId?: string;

	@RelationId('owner')
	ownerIdByName?: string;
}

/** An embeddable: its own index is resolved against its own columns. */
@Index(['views'])
@Index(['clicks'])
class SkeletonCounters {
	@Column({ type: 'int', default: 0 })
	views!: number;
}

/** Embedded paths, and the three forms an index's column function can answer in. */
@Entity('skeleton_fixture_embedded')
@Index((it: any) => [it.counters.views])
@Index((it: any) => ({ [it.counters.clicks]: 1 }))
@Index((it: any) => [it.stats.views])
class SkeletonEmbedded {
	@PrimaryColumn()
	id!: string;

	@Column(() => SkeletonCounters)
	counters!: SkeletonCounters;
}

/**
 * An entry declared on a base class is built into every entity extending it: `label` is a column of both children
 * and resolves, `code` only of one and does not.
 */
@Index(['label'])
@Index(['code'])
abstract class SkeletonLabelled {
	@PrimaryColumn()
	id!: string;
}

@Entity('skeleton_fixture_labelled_a')
class SkeletonLabelledA extends SkeletonLabelled {
	@Column()
	label!: string;

	@Column()
	code!: string;
}

@Entity('skeleton_fixture_labelled_b')
class SkeletonLabelledB extends SkeletonLabelled {
	@Column()
	label!: string;
}

/** `mpath` is a column TypeORM generates for a materialized-path tree — no decorator declares it. */
@Entity('skeleton_fixture_path_node')
@Tree('materialized-path')
@Index(['mpath'])
class SkeletonPathNode {
	@PrimaryColumn()
	id!: string;

	@TreeParent()
	parent?: SkeletonPathNode;

	@TreeChildren()
	children?: SkeletonPathNode[];
}

/** Single-table inheritance: the discriminator is generated, and the parent's table holds the child's columns. */
@Entity('skeleton_fixture_content')
@TableInheritance({ column: { type: 'varchar', name: 'kind' } })
@Index(['kind'])
class SkeletonContent {
	@PrimaryColumn()
	id!: string;
}

@ChildEntity()
@Index(['title'])
@Index(['subtitle'])
class SkeletonArticle extends SkeletonContent {
	@Column()
	title!: string;
}

const FIXTURES = [
	SkeletonParent,
	SkeletonRow,
	SkeletonEmbedded,
	SkeletonLabelledA,
	SkeletonLabelledB,
	SkeletonPathNode,
	SkeletonContent,
	SkeletonArticle
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** A decorated class, as TypeORM's metadata args name their `target`. */
type EntityClass = Exclude<TableMetadataArgs['target'], string>;

type StorageEntry = { target: EntityClass | string; [key: string]: any };

/** The storage's pruned arrays, by kind. */
function entriesOf(kind: TypeOrmSkeletonPrunedKind): StorageEntry[] {
	return getMetadataArgsStorage()[kind] as unknown as StorageEntry[];
}

/** A copy of every array the storage holds — not only the pruned kinds — with the array itself kept too. */
function snapshotStorage(): Map<string, { array: unknown[]; entries: unknown[] }> {
	const storage = getMetadataArgsStorage() as unknown as Record<string, unknown>;
	const snapshot = new Map<string, { array: unknown[]; entries: unknown[] }>();
	for (const [key, value] of Object.entries(storage)) {
		if (Array.isArray(value)) {
			snapshot.set(key, { array: value, entries: [...value] });
		}
	}
	return snapshot;
}

/** Asserts every array of the storage is the same array, holding the same entries in the same order. */
function expectStorageUnchanged(snapshot: Map<string, { array: unknown[]; entries: unknown[] }>): void {
	const storage = getMetadataArgsStorage() as unknown as Record<string, unknown[]>;
	expect(
		Object.keys(storage)
			.filter((key) => Array.isArray(storage[key]))
			.sort()
	).toEqual([...snapshot.keys()].sort());
	for (const [key, { array, entries }] of snapshot) {
		expect(storage[key]).toBe(array);
		expect(storage[key].length).toBe(entries.length);
		storage[key].forEach((entry, index) => expect(entry).toBe(entries[index]));
	}
}

/** The names an index-like entry's `columns` resolve to against a built entity, or `null` if resolving throws. */
function columnNames(columns: any, propertiesMap: Record<string, unknown>): string[] | null {
	if (!columns) {
		return [];
	}
	if (Array.isArray(columns)) {
		return columns.map((name) => String(name).trim());
	}
	try {
		const resolved = columns(propertiesMap);
		return Array.isArray(resolved) ? resolved.map(String) : Object.keys(resolved ?? {});
	} catch {
		return null;
	}
}

/**
 * Whether an entry resolves on an entity TypeORM BUILT — its own `propertiesMap`, columns and relations, which is
 * the truth the pruner's resolution is checked against.
 */
function resolvesOn(kind: TypeOrmSkeletonPrunedKind, entry: StorageEntry, metadata: EntityMetadata): boolean {
	if (kind === 'relationIds') {
		let path: unknown;
		try {
			path = typeof entry.relation === 'function' ? entry.relation(metadata.propertiesMap) : entry.relation;
		} catch {
			return false;
		}
		return typeof path === 'string' && !!metadata.findRelationWithPropertyPath(path);
	}

	const names = columnNames(entry.columns, metadata.propertiesMap);
	return (
		names !== null &&
		names.every(
			(name) =>
				metadata.columns.some((column) => column.propertyPath === name) ||
				metadata.relations.some((relation) => relation.propertyPath === name)
		)
	);
}

/** The built entities an entry declared on `target` is built into. */
function consumersIn(metadatas: EntityMetadata[], entry: StorageEntry): EntityMetadata[] {
	return metadatas.filter((metadata) => metadata.inheritanceTree.includes(entry.target as EntityClass));
}

/** A comparable description of built metadata: every table, column, relation, relation id, index and constraint. */
function fingerprint(metadatas: EntityMetadata[]): unknown[] {
	return metadatas
		.map((metadata) => ({
			name: metadata.name,
			table: metadata.tablePath,
			type: metadata.tableType,
			columns: metadata.columns.map((column) => [
				column.propertyPath,
				column.databaseName,
				String(column.type),
				column.isNullable,
				column.isPrimary,
				column.default === undefined ? null : String(column.default)
			]),
			relations: metadata.relations.map((relation) => [
				relation.propertyPath,
				relation.relationType,
				relation.inverseEntityMetadata?.name,
				relation.joinColumns.map((column) => column.databaseName)
			]),
			relationIds: metadata.relationIds.map((relationId) => [
				relationId.propertyName,
				relationId.relation.propertyPath
			]),
			indices: metadata.indices.map((index) => [
				index.name,
				index.columns.map((column) => column.databaseName),
				index.isUnique,
				index.where ?? null
			]),
			uniques: metadata.uniques.map((unique) => [
				unique.name,
				unique.columns.map((column) => column.databaseName)
			]),
			checks: metadata.checks.map((check) => [check.name, check.expression]),
			foreignKeys: metadata.foreignKeys.map((foreignKey) => [
				foreignKey.name,
				foreignKey.columnNames,
				foreignKey.referencedTablePath,
				foreignKey.onDelete
			])
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The data source factory `DatabaseModule` hands `TypeOrmModule.forRootAsync` — the one the application's
 * TypeORM connection is built by — reached through the provider `@nestjs/typeorm` wraps it in, so the call is
 * exactly the one Nest makes at boot. A failure is not retried.
 */
function platformDataSource(options: DataSourceOptions): Promise<DataSource> {
	const imports: any[] = Reflect.getMetadata('imports', DatabaseModule);
	const typeOrmModule = imports.find((entry) => entry?.module === TypeOrmModule);
	const provider = typeOrmModule.imports[0].providers.find((entry: any) => entry.provide === getDataSourceToken());

	return provider.useFactory({ ...options, toRetry: () => false });
}

/**
 * Builds a data source's entity metadata without connecting — the step `initialize()` fails in. Protected on
 * `DataSource`, so reached through a cast.
 */
function buildMetadatas(dataSource: DataSource): Promise<void> {
	return (dataSource as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
}

/** An in-memory SQLite data source over `entities`, with nothing synchronised or migrated. */
function inMemory(entities: EntityClass[]): DataSourceOptions {
	return {
		type: 'better-sqlite3',
		database: ':memory:',
		entities,
		synchronize: false,
		migrationsRun: false,
		logging: false
	};
}

/** A logger that records what it is told. */
function recordingLogger(): { log: jest.Mock } {
	return { log: jest.fn() };
}

const ENTITY_GRAPH_TIMEOUT = 15 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Specs
// ─────────────────────────────────────────────────────────────────────────────

describe('pruneTypeOrmSkeletonMetadata', () => {
	const originalOrm = process.env.DB_ORM;

	afterEach(() => jest.restoreAllMocks());

	afterAll(() => {
		if (originalOrm === undefined) {
			delete process.env.DB_ORM;
		} else {
			process.env.DB_ORM = originalOrm;
		}
	});

	describe('under TypeORM (production) it is a strict no-op', () => {
		beforeEach(() => {
			delete process.env.DB_ORM;
		});

		it.each([
			['unset', undefined],
			['typeorm', 'typeorm'],
			['an unrecognised value', 'mongoose']
		])(
			'with DB_ORM %s: returns null and leaves every array of the storage untouched, unresolvable entries included',
			(_label, orm) => {
				if (orm !== undefined) {
					process.env.DB_ORM = orm;
				}

				// The storage does hold entries a MikroORM pass would remove, so "nothing removed" is not vacuous.
				expect(
					entriesOf('relationIds').some(
						(entry) => entry.target === SkeletonRow && entry.propertyName === 'parentId'
					)
				).toBe(true);
				expect(entriesOf('indices').some((entry) => entry.target === SkeletonRow)).toBe(true);
				expect(entriesOf('uniques').some((entry) => entry.target === SkeletonRow)).toBe(true);

				const snapshot = snapshotStorage();
				const logger = recordingLogger();

				expect(pruneTypeOrmSkeletonMetadata(undefined, logger)).toBeNull();

				expectStorageUnchanged(snapshot);
				expect(logger.log).not.toHaveBeenCalled();
			}
		);

		it('never so much as reads the storage it is handed', () => {
			const untouchable = new Proxy(
				{},
				{
					get: () => {
						throw new Error('the storage was read under TypeORM');
					}
				}
			);

			expect(pruneTypeOrmSkeletonMetadata(untouchable as any, recordingLogger())).toBeNull();
		});

		it(
			'builds, through the platform factory, exactly the metadata TypeORM builds on its own for the core entities',
			async () => {
				const snapshot = snapshotStorage();

				const plain = new DataSource(inMemory(coreEntities as unknown as EntityClass[]));
				await buildMetadatas(plain);

				const platform = await platformDataSource(inMemory(coreEntities as unknown as EntityClass[]));
				try {
					expect(platform.isInitialized).toBe(true);
					expect(platform.entityMetadatas.length).toBe(plain.entityMetadatas.length);
					expect(fingerprint(platform.entityMetadatas)).toEqual(fingerprint(plain.entityMetadatas));
				} finally {
					await platform.destroy();
				}

				expectStorageUnchanged(snapshot);
			},
			ENTITY_GRAPH_TIMEOUT
		);
	});

	describe('under MikroORM', () => {
		/** The core entities as `DB_ORM=mikro-orm` defines them: TypeORM sees their skeleton. */
		let mikroEntities: EntityClass[];
		/** Every pruned kind's entries before any pass — what "removed" is measured against. */
		const before = new Map<TypeOrmSkeletonPrunedKind, StorageEntry[]>();

		const removed = (kind: TypeOrmSkeletonPrunedKind): StorageEntry[] =>
			before.get(kind)!.filter((entry) => !entriesOf(kind).includes(entry));
		const wasRemoved = (kind: TypeOrmSkeletonPrunedKind, entry: StorageEntry | undefined): boolean => {
			expect(entry).toBeDefined();
			return !entriesOf(kind).includes(entry!);
		};

		beforeAll(() => {
			process.env.DB_ORM = 'mikro-orm';
			jest.isolateModules(() => {
				mikroEntities = require('../core/entities').coreEntities;
			});
			for (const kind of TYPEORM_SKELETON_PRUNED_KINDS) {
				before.set(kind, [...entriesOf(kind)]);
			}
		}, ENTITY_GRAPH_TIMEOUT);

		beforeEach(() => {
			process.env.DB_ORM = 'mikro-orm';
		});

		it(
			'reproduces the defect: as registered, TypeORM cannot build the skeleton metadata',
			async () => {
				expect(entriesOf('relationIds')).toHaveLength(before.get('relationIds')!.length);

				await expect(buildMetadatas(new DataSource(inMemory(mikroEntities)))).rejects.toThrow(
					/Cannot find relation undefined\. Wrong relation specified for @RelationId decorator/
				);
			},
			ENTITY_GRAPH_TIMEOUT
		);

		it(
			'lets the platform data source initialise, removing only entries TypeORM itself cannot resolve',
			async () => {
				const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

				const dataSource = await platformDataSource(inMemory(mikroEntities));
				try {
					expect(dataSource.isInitialized).toBe(true);
					const metadatas = dataSource.entityMetadatas;
					expect(metadatas.length).toBeGreaterThanOrEqual(mikroEntities.length);

					const counts = Object.fromEntries(
						TYPEORM_SKELETON_PRUNED_KINDS.map((kind) => [kind, removed(kind).length])
					) as ITypeOrmSkeletonPruneReport;
					expect(counts.relationIds).toBeGreaterThan(0);
					expect(counts.indices).toBeGreaterThan(0);

					for (const kind of TYPEORM_SKELETON_PRUNED_KINDS) {
						// Every removed entry that names a core entity's property really is one TypeORM does not know:
						// at least one entity it is built into fails to resolve it against TypeORM's own metadata.
						for (const entry of removed(kind)) {
							const consumers = consumersIn(metadatas, entry);
							if (consumers.length > 0) {
								expect({
									kind,
									entry,
									resolvesEverywhere: consumers.every((metadata) => resolvesOn(kind, entry, metadata))
								}).toEqual(expect.objectContaining({ resolvesEverywhere: false }));
							}
						}

						// Every kept entry resolves on every core entity it is built into.
						for (const entry of entriesOf(kind)) {
							for (const metadata of consumersIn(metadatas, entry)) {
								expect({
									kind,
									entity: metadata.name,
									resolves: resolvesOn(kind, entry, metadata)
								}).toEqual(expect.objectContaining({ resolves: true }));
							}
						}

						// The TypeORM-mapped classes (and their bases) share the storage, and every entry they declare
						// resolves: none was removed.
						const typeOrmClasses = new Set<EntityClass>(
							(coreEntities as unknown as EntityClass[]).flatMap((entity) => {
								const tree: EntityClass[] = [];
								for (
									let current: any = entity;
									current?.name;
									current = Object.getPrototypeOf(current)
								) {
									tree.push(current);
								}
								return tree;
							})
						);
						expect(
							removed(kind).filter((entry) => typeOrmClasses.has(entry.target as EntityClass))
						).toEqual([]);
					}

					// Said once, with the per-kind counts.
					const calls = log.mock.calls.filter(
						(_call, index) => (log.mock.contexts[index] as any)?.context === 'TypeOrmSkeletonMetadata'
					);
					expect(calls).toHaveLength(1);
					for (const kind of TYPEORM_SKELETON_PRUNED_KINDS) {
						expect(String(calls[0][0])).toContain(`${kind}: ${counts[kind]}`);
					}

					// A second pass finds nothing left and says nothing.
					const logger = recordingLogger();
					expect(pruneTypeOrmSkeletonMetadata(undefined, logger)).toEqual({
						relationIds: 0,
						indices: 0,
						uniques: 0,
						checks: 0,
						exclusions: 0
					});
					expect(logger.log).not.toHaveBeenCalled();
				} finally {
					await dataSource.destroy();
				}
			},
			ENTITY_GRAPH_TIMEOUT
		);

		it('resolves relation ids, embedded paths, column functions, inheritance, trees and single-table columns as TypeORM does', async () => {
			pruneTypeOrmSkeletonMetadata(undefined, recordingLogger());

			const relationId = (target: EntityClass, propertyName: string) =>
				before
					.get('relationIds')!
					.find((entry) => entry.target === target && entry.propertyName === propertyName);
			const indexOn = (target: EntityClass, match: (columns: any) => boolean) =>
				before.get('indices')!.find((entry) => entry.target === target && match(entry.columns));
			const named =
				(...names: string[]) =>
				(columns: any) =>
					Array.isArray(columns) &&
					columns.length === names.length &&
					names.every((name, i) => columns[i] === name);
			const functionIndices = before.get('indices')!.filter((entry) => entry.target === SkeletonEmbedded);

			// A relation TypeORM never received — by function or by name — is removed; a TypeORM relation is kept.
			expect(wasRemoved('relationIds', relationId(SkeletonRow, 'parentId'))).toBe(true);
			expect(wasRemoved('relationIds', relationId(SkeletonRow, 'parentIdByName'))).toBe(true);
			expect(wasRemoved('relationIds', relationId(SkeletonRow, 'ownerId'))).toBe(false);
			expect(wasRemoved('relationIds', relationId(SkeletonRow, 'ownerIdByName'))).toBe(false);

			// An index or unique naming a MikroORM-only column is removed; a column or a TypeORM relation is kept.
			expect(wasRemoved('indices', indexOn(SkeletonRow, named('id', 'code')))).toBe(true);
			expect(
				wasRemoved(
					'uniques',
					before.get('uniques')!.find((entry) => entry.target === SkeletonRow)
				)
			).toBe(true);
			expect(wasRemoved('indices', indexOn(SkeletonRow, named('id')))).toBe(false);
			expect(wasRemoved('indices', indexOn(SkeletonRow, named('owner')))).toBe(false);

			// Embedded paths through the `propertiesMap`: a known path (list form) is kept, an unknown one (object
			// form) is removed, and a function that throws reading an unknown embedded is removed.
			expect(functionIndices).toHaveLength(3);
			const byBody = (fragment: string) =>
				functionIndices.find((entry) => String(entry.columns).includes(fragment));
			const listForm = byBody('it.counters.views');
			const objectForm = byBody('it.counters.clicks');
			const throwing = byBody('it.stats.views');
			expect(wasRemoved('indices', listForm)).toBe(false);
			expect(wasRemoved('indices', objectForm)).toBe(true);
			expect(wasRemoved('indices', throwing)).toBe(true);

			// An embeddable's own index is resolved against the embeddable.
			expect(wasRemoved('indices', indexOn(SkeletonCounters, named('views')))).toBe(false);
			expect(wasRemoved('indices', indexOn(SkeletonCounters, named('clicks')))).toBe(true);

			// A base class's index is built into every child: kept only when every child knows the column.
			expect(wasRemoved('indices', indexOn(SkeletonLabelled, named('label')))).toBe(false);
			expect(wasRemoved('indices', indexOn(SkeletonLabelled, named('code')))).toBe(true);

			// Columns TypeORM generates: the materialized path and the single-table discriminator.
			expect(wasRemoved('indices', indexOn(SkeletonPathNode, named('mpath')))).toBe(false);
			expect(wasRemoved('indices', indexOn(SkeletonContent, named('kind')))).toBe(false);
			expect(wasRemoved('indices', indexOn(SkeletonArticle, named('title')))).toBe(false);
			expect(wasRemoved('indices', indexOn(SkeletonArticle, named('subtitle')))).toBe(true);

			// And TypeORM agrees: the fixtures build, and every removed fixture entry fails against what it built.
			const dataSource = new DataSource(inMemory(FIXTURES));
			await buildMetadatas(dataSource);
			const fixtureTargets = new Set<EntityClass>([...FIXTURES, SkeletonLabelled, SkeletonCounters]);
			for (const kind of TYPEORM_SKELETON_PRUNED_KINDS) {
				for (const entry of removed(kind).filter((candidate) =>
					fixtureTargets.has(candidate.target as EntityClass)
				)) {
					const consumers = consumersIn(dataSource.entityMetadatas, entry);
					if (consumers.length > 0) {
						expect(consumers.every((metadata) => resolvesOn(kind, entry, metadata))).toBe(false);
					}
				}
			}
		});
	});
});
