/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a declaration service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary and
 * **the service under test is the real one**, together with the real declaration registry it
 * synchronises from.
 *
 * `@gauzy/config` is read at import time by other packages of the workspace, so it is doubled too.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		CrudService: class {},
		TenantAwareCrudService: class {},
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		IsSecret: decorator,
		BaseEvent: class {},
		EventBus: class {},
		EventOutboxService: class {},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		isUniqueViolation: (error: any) => Boolean(error?.code === '23505'),
		SearchDocument: class {},
		SearchIndexDefinition: class {},
		SearchModule: class {},
		TypeOrmSearchDocumentRepository: class {},
		TypeOrmSearchIndexDefinitionRepository: class {},
		MikroOrmSearchIndexDefinitionRepository: class {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false,
			hasRoles: () => false
		},
		// The source connection asks which ORM is configured before it reads; the double answers
		// TypeORM, which is the arm these suites exercise through their in-memory connection.
		MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
		getORMType: () => 'typeorm'
	};
});

jest.mock('@gauzy/config', () => ({
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ISearchIndexRegistration, SearchFieldKind } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { SearchIndexRegistry } from '../registry/search-index.registry';
import { SearchIndexDefinitionService } from './search-index-definition.service';

/**
 * The persisted half of the index declarations (doc 05 §3.17, implementation W21).
 *
 * The specification's rule for this table is stated as a division of ownership, and the suite pins
 * both halves of it:
 *
 * - **the declaration in code owns the field set** — which fields exist, what kind each holds and
 *   where its value is read from — because a field that does not exist on the entity produces an
 *   index that silently never matches;
 * - **the persisted row owns what an operator tunes** — the weights, the flags, the templates, the
 *   promoted fields, the source timestamp column, the label and whether the entity is indexed at all
 *   — and **once an operator has tuned a row, a change to the corresponding value in code no longer
 *   lands**;
 * - **the version is bumped only when the effective shape changed**, which is the whole reason the
 *   version exists: a developer adding a field must invalidate the documents built without it, and a
 *   boot that re-reads an unchanged declaration must not;
 * - **an `isSystem` definition is deactivated, never deleted**, and a field list that could never
 *   produce a usable index is refused where it is written rather than at the first query that returns
 *   nothing.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';

type Row = Record<string, any>;

/** The subset of conditions the service states, matched the way the database would. */
function matches(row: Row, where: any = {}): boolean {
	return Object.entries(where).every(([field, expected]) => {
		if (expected === undefined) {
			return true;
		}

		if (expected === null) {
			return row[field] === null || row[field] === undefined;
		}

		if (expected && typeof expected === 'object' && '_type' in (expected as Row)) {
			if ((expected as Row)._type === 'isNull') {
				return row[field] === null || row[field] === undefined;
			}

			throw new Error(`the in-memory double does not implement the "${(expected as Row)._type}" operator`);
		}

		return String(row[field] ?? '') === String(expected);
	});
}

/** The declaration a package ships, as the registry receives it. */
const DECLARATION: ISearchIndexRegistration = {
	entity: 'product_variant',
	label: 'Product variants',
	permission: 'ORG_INVENTORY_VIEW' as never,
	titleTemplate: '{{sku}}',
	keywordFields: ['sku'],
	sourceUpdatedAtField: 'updatedAt',
	defaultWeight: 1,
	isSystem: true,
	fields: [
		{ name: 'sku', kind: SearchFieldKind.KEYWORD, weight: 3, searchable: true, filterable: true, facetable: false },
		{ name: 'name', kind: SearchFieldKind.TEXT, weight: 2, searchable: true, filterable: false, facetable: false }
	]
};

/** A declaration for a table this installation does not map. */
const ABSENT: ISearchIndexRegistration = {
	entity: 'package_that_is_not_installed',
	label: 'Absent',
	permission: 'ORG_INVENTORY_VIEW' as never,
	fields: [{ name: 'name', kind: SearchFieldKind.TEXT, weight: 1, searchable: true, filterable: false, facetable: false }]
};

/** One persisted definition row. */
const definitionRow = (id: string, overrides: Row = {}) => ({
	id,
	entity: 'product_variant',
	label: 'Product variants',
	engineKey: null,
	fields: DECLARATION.fields,
	defaultWeight: '1.000000',
	titleTemplate: '{{sku}}',
	bodyTemplate: null,
	keywordFields: ['sku'],
	sourceUpdatedAtField: 'updatedAt',
	isActive: true,
	isSystem: true,
	version: 1,
	organizationId: null,
	tenantId: null,
	deletedAt: null,
	...overrides
});

/**
 * Builds the declaration service over an in-memory table.
 *
 * @param seed What the fixture holds, and which declarations the registry ships.
 */
function definitionFixture(seed: { definitions?: Row[]; declarations?: ISearchIndexRegistration[] } = {}) {
	let sequence = 0;
	const tables = { search_index_definition: [...(seed.definitions ?? [])] };
	const saved: Row[] = [];

	const dataSource: any = {
		entityMetadatas: [{ tableName: 'product_variant' }]
	};
	const registry = new SearchIndexRegistry(dataSource);

	for (const declaration of seed.declarations ?? [DECLARATION]) {
		if (registry.isMapped(declaration.entity)) {
			registry.register(declaration);
		}
	}

	const repository: any = {
		create: () => ({}),
		save: async (row: Row) => {
			saved.push(row);

			const index = row.id ? tables.search_index_definition.findIndex((candidate) => candidate.id === row.id) : -1;

			if (index >= 0) {
				tables.search_index_definition[index] = { ...tables.search_index_definition[index], ...row };

				return tables.search_index_definition[index];
			}

			row.id = row.id ?? `generated-${++sequence}`;
			tables.search_index_definition.push(row);

			return row;
		},
		// `findOne` takes a list of alternatives the same way `find` does: a scoped read states one
		// condition per shape of row it admits — the caller's organization's, and the platform's.
		findOne: async ({ where }: any = {}) => {
			const conditions = Array.isArray(where) ? where : [where ?? {}];

			return (
				tables.search_index_definition.find((row) => conditions.some((condition) => matches(row, condition))) ?? null
			);
		},
		find: async ({ where, order }: any = {}) => {
			const conditions = Array.isArray(where) ? where : [where ?? {}];
			const found = tables.search_index_definition.filter((row) => conditions.some((condition) => matches(row, condition)));

			if (order?.entity === 'ASC') {
				return [...found].sort((left, right) => String(left.entity).localeCompare(String(right.entity)));
			}

			return found;
		},
		softDelete: async (criteria: any) => {
			const row = tables.search_index_definition.find((candidate) => matches(candidate, criteria));

			if (row) {
				row.deletedAt = new Date();
			}

			return { affected: row ? 1 : 0 };
		}
	};

	const service = new SearchIndexDefinitionService(repository, {} as never, registry);

	return {
		service,
		registry,
		tables,
		saved,
		store: (id: string) => tables.search_index_definition.find((row) => row.id === id)
	};
}

describe('SearchIndexDefinitionService — making the rows match the declarations (doc 05 §3.17)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates one platform row per registered declaration, at version one', async () => {
		const fixture = definitionFixture();

		const outcome = await fixture.service.syncFromRegistry();

		expect(outcome).toEqual({ created: 1, updated: 0 });
		expect(fixture.tables.search_index_definition[0]).toMatchObject({
			entity: 'product_variant',
			label: 'Product variants',
			isSystem: true,
			isActive: true,
			version: 1
		});
		// Which backend holds an entity's documents is an installation's choice rather than a fact about the
		// entity, so a declaration in code never states one: the column is left empty.
		expect(fixture.tables.search_index_definition[0].engineKey ?? null).toBeNull();
	});

	it('writes no row for a declaration this installation cannot serve', async () => {
		// A declaration for a package that is not installed describes a class of rows that does not exist,
		// and a row for it would put an entity in the search configuration screen that can never return
		// anything.
		const fixture = definitionFixture({ declarations: [DECLARATION, ABSENT] });

		expect(fixture.registry.isMapped(ABSENT.entity)).toBe(false);
		expect(fixture.registry.registeredEntities()).toEqual(['product_variant']);

		await fixture.service.syncFromRegistry();

		expect(fixture.tables.search_index_definition.map((row) => row.entity)).toEqual(['product_variant']);
	});

	it('does not bump the version when a boot re-reads an unchanged declaration', async () => {
		// The distinction is the whole reason the version exists: a developer adding a field must
		// invalidate the documents built without it, and a restart must not.
		const fixture = definitionFixture({ definitions: [definitionRow('d1', { version: 4 })] });

		const outcome = await fixture.service.syncFromRegistry();

		expect(outcome).toEqual({ created: 0, updated: 1 });
		expect(fixture.store('d1')?.version).toBe(4);
	});

	it('keeps the weight an operator tuned, and does not report a change because code still says otherwise', async () => {
		// "once an operator has tuned a row, a change to the corresponding value in code no longer lands —
		// the override wins until it is cleared".
		const fixture = definitionFixture({
			definitions: [
				definitionRow('d1', {
					version: 2,
					fields: [
						{ name: 'sku', kind: SearchFieldKind.KEYWORD, weight: 9, searchable: true, filterable: true, facetable: false },
						{ name: 'name', kind: SearchFieldKind.TEXT, weight: 2, searchable: true, filterable: false, facetable: false }
					]
				})
			]
		});

		await fixture.service.syncFromRegistry();

		expect(fixture.store('d1')?.fields[0].weight).toBe(9);
		expect(fixture.store('d1')?.version).toBe(2);
	});

	it('lands a field the declaration added, and bumps the version because the shape changed', async () => {
		// The field set is not an operator's to state, so a change to it always lands.
		const fixture = definitionFixture({ definitions: [definitionRow('d1', { version: 2 })] });
		const extended: ISearchIndexRegistration = {
			...DECLARATION,
			fields: [
				...DECLARATION.fields,
				{ name: 'internalReference', kind: SearchFieldKind.KEYWORD, weight: 1, searchable: true, filterable: true, facetable: false }
			]
		};

		fixture.registry.clear();
		fixture.registry.register(extended);

		await fixture.service.syncFromRegistry();

		expect(fixture.store('d1')?.fields.map((field: Row) => field.name)).toEqual(['sku', 'name', 'internalReference']);
		expect(fixture.store('d1')?.version).toBe(3);
	});

	it('reactivates a row whose declaration came back', async () => {
		const fixture = definitionFixture({ definitions: [definitionRow('d1', { deletedAt: new Date(), isActive: false })] });

		await fixture.service.syncFromRegistry();

		expect(fixture.store('d1')?.deletedAt).toBeNull();
	});
});

describe('SearchIndexDefinitionService — which definition is in force (doc 05 §3.17)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('lets an organization’s own row win over the platform row, so one tenant cannot re-weight another’s', async () => {
		const fixture = definitionFixture({
			definitions: [definitionRow('platform', { version: 1 }), definitionRow('scoped', { organizationId: ORG, version: 7 })]
		});

		expect((await fixture.service.findFor('product_variant'))?.id).toBe('scoped');
		expect((await fixture.service.findFor('product_variant', OTHER_ORG))?.id).toBe('platform');
		expect(await fixture.service.versionOf('product_variant')).toBe(7);
	});

	it('answers version one for an entity with no persisted definition', async () => {
		const fixture = definitionFixture();

		expect(await fixture.service.findFor('product_variant')).toBeNull();
		expect(await fixture.service.versionOf('product_variant')).toBe(1);
	});

	it('lists the platform rows and the caller’s own rows, and refuses another organization’s row by id', async () => {
		const fixture = definitionFixture({
			definitions: [definitionRow('platform', { entity: 'product' }), definitionRow('scoped', { organizationId: OTHER_ORG })]
		});

		expect((await fixture.service.list()).map((row) => row.id)).toEqual(['platform']);
		await expect(fixture.service.findOneScoped('scoped')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneScoped('nope')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('SearchIndexDefinitionService — what an operator may change (doc 05 §3.17)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('bumps the version when a weight changes, because the documents built at the old one are stale', async () => {
		const fixture = definitionFixture({ definitions: [definitionRow('d1', { version: 1 })] });

		const updated = await fixture.service.updateDefinition('d1', {
			fields: [
				{ name: 'sku', kind: SearchFieldKind.KEYWORD, weight: 9, searchable: true, filterable: true, facetable: false },
				{ name: 'name', kind: SearchFieldKind.TEXT, weight: 2, searchable: true, filterable: false, facetable: false }
			]
		});

		expect(updated.version).toBe(2);
		expect(updated.fields[0].weight).toBe(9);
	});

	it('does not bump the version for a change the index is not built from', async () => {
		const fixture = definitionFixture({ definitions: [definitionRow('d1', { version: 1 })] });

		const updated = await fixture.service.updateDefinition('d1', { label: 'Product variants (renamed)' });

		expect(updated).toMatchObject({ version: 1, label: 'Product variants (renamed)' });
	});

	it('turns a definition off without touching its documents, and refuses to delete a shipped one', async () => {
		// "an `isSystem` definition is deactivated, never deleted" — and deactivating retains the documents,
		// so re-activating it does not need a rebuild. The switch is not part of the shape the index is
		// built from, so it does not invalidate a single document.
		const fixture = definitionFixture({ definitions: [definitionRow('d1')] });

		const deactivated = await fixture.service.deactivate('d1');

		expect(deactivated.isActive).toBe(false);
		expect(deactivated.version).toBe(1);
		await expect(fixture.service.removeDefinition('d1')).rejects.toThrow(/cannot be deleted/);
		expect(fixture.store('d1')?.deletedAt).toBeNull();
	});

	it('deletes a definition an operator authored', async () => {
		const fixture = definitionFixture({ definitions: [definitionRow('d1', { isSystem: false })] });

		expect(await fixture.service.removeDefinition('d1')).toEqual({ id: 'd1', deleted: true });
		expect(fixture.store('d1')?.deletedAt).toBeInstanceOf(Date);
	});

	it('refuses an empty field list, a duplicate field name and a promoted field that is not declared', async () => {
		// "a field that does not exist on the entity produces an index that silently never matches", so the
		// rules are checked where the operator writes rather than at the first query that returns nothing.
		const fixture = definitionFixture({ definitions: [definitionRow('d1')] });

		await expect(fixture.service.updateDefinition('d1', { fields: [] })).rejects.toThrow(/at least one field/);
		await expect(
			fixture.service.updateDefinition('d1', {
				fields: [
					{ name: 'sku', kind: SearchFieldKind.KEYWORD, weight: 1, searchable: true, filterable: true, facetable: false },
					{ name: 'sku', kind: SearchFieldKind.KEYWORD, weight: 1, searchable: true, filterable: true, facetable: false }
				]
			})
		).rejects.toThrow(/declares the field "sku" twice/);
		await expect(fixture.service.updateDefinition('d1', { keywordFields: ['nothing'] })).rejects.toThrow(
			/promotes "nothing" into its keywords/
		);
		expect(fixture.store('d1')?.fields).toHaveLength(2);
	});

	it('clamps a default weight rather than storing a negative one, and clears a template that was emptied', async () => {
		const fixture = definitionFixture({ definitions: [definitionRow('d1')] });

		const updated = await fixture.service.updateDefinition('d1', { defaultWeight: -5, titleTemplate: '' });

		expect(updated.defaultWeight).toBe('0');
		expect(updated.titleTemplate).toBeUndefined();
	});

	it('refuses a definition that does not exist', async () => {
		const fixture = definitionFixture();

		await expect(fixture.service.updateDefinition('nope', { label: 'x' })).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.deactivate('nope')).rejects.toBeInstanceOf(NotFoundException);
	});
});
