import type { EntityMetadata as MikroOrmEntityMetadata, EntityProperty } from '@mikro-orm/core';
import type { EntityMetadata as TypeOrmEntityMetadata } from 'typeorm';

/**
 * Both ORMs map every core entity onto the same tables and columns.
 *
 * Under `DB_ORM=mikro-orm` both ORMs run on one database — the migrations, the seeder and the services still on
 * TypeORM write through TypeORM's mapping, everything else through MikroORM's — and the tables are the ones
 * TypeORM's mapping created. A MikroORM mapping that names another table or column is not a style difference:
 * the statement fails (`no such table: product_variant_options`: every product-variant read), or reads and writes
 * a column TypeORM never does. This compares the two mappings the platform actually builds, entity by entity:
 *
 * - the table each ORM names for the entity;
 * - every column MikroORM reads or writes (a persisted scalar, or the join column of an owning relation) is a
 *   column of TypeORM's table;
 * - every owning many-to-many uses TypeORM's junction table and its two join columns.
 *
 * The entities are imported under `DB_ORM=mikro-orm` in a registry kept open while both ORMs build their metadata:
 * the decorators register at class definition, and `BaseEntity` requires `User` lazily from relation callbacks.
 */

const TIMEOUT = 15 * 60 * 1000;

interface IParity {
	tables: string[];
	columns: string[];
	unmapped: string[];
	pivots: string[];
}

/** The columns an owning relation or a persisted scalar reads and writes under MikroORM. */
function mikroOrmColumns(property: EntityProperty): string[] {
	return property.fieldNames ?? [];
}

async function measureParity(): Promise<IParity> {
	const previous = process.env.DB_ORM;
	process.env.DB_ORM = 'mikro-orm';

	const parity: IParity = { tables: [], columns: [], unmapped: [], pivots: [] };

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../core/entities');
			const { DataSource } = require('typeorm');
			const { MikroORM, EntityCaseNamingStrategy, ReferenceKind } = require('@mikro-orm/core');
			const { BetterSqliteDriver } = require('@mikro-orm/better-sqlite');

			const dataSource = new DataSource({
				type: 'better-sqlite3',
				database: ':memory:',
				entities: coreEntities,
				synchronize: false,
				migrationsRun: false,
				logging: false
			});
			await (dataSource as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();

			const orm = await MikroORM.init({
				driver: BetterSqliteDriver,
				dbName: ':memory:',
				entities: coreEntities,
				namingStrategy: EntityCaseNamingStrategy,
				connect: false,
				allowGlobalContext: true,
				discovery: { warnWhenNoEntities: false }
			});

			try {
				const mikroOrmMetadata = orm.getMetadata();

				for (const typeOrm of dataSource.entityMetadatas as TypeOrmEntityMetadata[]) {
					if (typeOrm.tableType === 'junction' || typeof typeOrm.target !== 'function') continue;

					const mikroOrm: MikroOrmEntityMetadata | undefined = mikroOrmMetadata.find(typeOrm.target.name);
					if (!mikroOrm || mikroOrm.class !== typeOrm.target) continue;

					if (mikroOrm.tableName !== typeOrm.tableName) {
						parity.tables.push(
							`${typeOrm.name}: TypeORM ${typeOrm.tableName}, MikroORM ${mikroOrm.tableName}`
						);
					}

					const typeOrmColumns = new Set(typeOrm.columns.map((column) => column.databaseName));

					for (const property of Object.values(mikroOrm.properties) as EntityProperty[]) {
						const writesColumns =
							(property.kind === ReferenceKind.SCALAR && property.persist !== false) ||
							property.kind === ReferenceKind.MANY_TO_ONE ||
							(property.kind === ReferenceKind.ONE_TO_ONE && property.owner);
						if (!writesColumns || property.embedded || property.kind === ReferenceKind.EMBEDDED) continue;

						for (const column of mikroOrmColumns(property)) {
							if (!typeOrmColumns.has(column)) {
								parity.columns.push(
									`${typeOrm.name}.${property.name}: MikroORM column ${column} is not in ${typeOrm.tableName}`
								);
							}
						}
					}

					// The other direction: every column of TypeORM's table is one MikroORM maps — as a persisted scalar, a
					// relation-id mirror, or an owning relation's join column — or MikroORM can neither read it, write it,
					// nor filter on it (`Trying to query by not existing property OrganizationProject.repositoryId`).
					const mikroOrmColumnSet = new Set(
						(Object.values(mikroOrm.properties) as EntityProperty[]).flatMap((property) =>
							property.kind === ReferenceKind.SCALAR ||
							property.kind === ReferenceKind.MANY_TO_ONE ||
							(property.kind === ReferenceKind.ONE_TO_ONE && property.owner) ||
							property.kind === ReferenceKind.EMBEDDED
								? mikroOrmColumns(property)
								: []
						)
					);
					for (const column of typeOrm.columns) {
						if (column.isVirtual || column.embeddedMetadata || mikroOrmColumnSet.has(column.databaseName))
							continue;
						parity.unmapped.push(
							`${typeOrm.name}.${column.propertyPath}: TypeORM column ${column.databaseName} has no MikroORM mapping`
						);
					}

					for (const relation of typeOrm.manyToManyRelations) {
						if (!relation.isOwning || !relation.junctionEntityMetadata) continue;

						const property = mikroOrm.properties[relation.propertyName as never] as
							| EntityProperty
							| undefined;
						const junction = relation.junctionEntityMetadata;
						const expected = {
							table: junction.tableName,
							join: relation.joinColumns.map((column) => column.databaseName),
							inverse: relation.inverseJoinColumns.map((column) => column.databaseName)
						};

						if (!property || property.kind !== ReferenceKind.MANY_TO_MANY) {
							parity.pivots.push(`${typeOrm.name}.${relation.propertyName}: no MikroORM many-to-many`);
							continue;
						}

						// The owning side on MikroORM may be the other entity; read its pivot either way.
						const owning: EntityProperty = property.owner
							? property
							: ((mikroOrmMetadata.find(property.type)?.properties[
									property.mappedBy as never
								] as EntityProperty) ?? property);
						const flip = !property.owner;
						const actual = {
							table: owning.pivotTable,
							join: flip ? owning.inverseJoinColumns : owning.joinColumns,
							inverse: flip ? owning.joinColumns : owning.inverseJoinColumns
						};

						if (
							actual.table !== expected.table ||
							String(actual.join) !== String(expected.join) ||
							String(actual.inverse) !== String(expected.inverse)
						) {
							parity.pivots.push(
								`${typeOrm.name}.${relation.propertyName}: TypeORM ${expected.table}(${expected.join} | ${expected.inverse}), ` +
									`MikroORM ${actual.table}(${actual.join} | ${actual.inverse})`
							);
						}
					}
				}
			} finally {
				await orm.close(true);
			}
		});
	} finally {
		if (previous === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = previous;
	}

	return parity;
}

describe('dual-ORM mapping parity of the core entities', () => {
	let parity: IParity;

	beforeAll(async () => {
		parity = await measureParity();
	}, TIMEOUT);

	it('names the same table for every entity on both ORMs', () => {
		expect(parity.tables).toEqual([]);
	});

	it('reads and writes, on MikroORM, only columns of the table TypeORM created', () => {
		expect(parity.columns).toEqual([]);
	});

	it('maps, on MikroORM, every column of the table TypeORM created', () => {
		expect(parity.unmapped).toEqual([]);
	});

	it('uses, on MikroORM, the junction table and join columns TypeORM created for every many-to-many', () => {
		expect(parity.pivots).toEqual([]);
	});
});
