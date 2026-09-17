/**
 * Two module boundaries are doubled here, for the same reason.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which an assignment service needs and none of which is
 * available outside a running application; its nested `uuid` is ESM-only, so reading one entity would
 * fail under jest. `@gauzy/config` reads the process environment at import time. Both are therefore
 * doubled at the module boundary, and **the service under test is the real one**.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		async findOneByIdString(id: any): Promise<any> {
			if (!id) {
				throw new NotFoundException('The requested record was not found');
			}

			const record = await this.typeOrmRepository.findOne({ where: { id } });

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}
	}

	return {
		TenantAwareCrudService,
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
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		BaseEvent: class {},
		EventBus: class {},
		Product: class Product {},
		ProductVariant: class ProductVariant {},
		Warehouse: class Warehouse {},
		WarehouseProduct: class WarehouseProduct {},
		WarehouseProductVariant: class WarehouseProductVariant {},
		User: class User {},
		Sequence: class Sequence {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => '00000000-0000-4000-8000-000000000001',
			currentOrganizationId: () => '00000000-0000-4000-8000-000000000002',
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock(
	'@gauzy/config',
	() => ({
		DatabaseTypeEnum: {
			mongodb: 'mongodb',
			sqlite: 'sqlite',
			betterSqlite3: 'better-sqlite3',
			postgres: 'postgres',
			mysql: 'mysql'
		}
	}),
	{ virtual: true }
);

import { Warehouse } from '@gauzy/core';
import { ChannelWarehouse } from './channel-warehouse.entity';
import { ChannelWarehouseService } from './channel-warehouse.service';

/**
 * Which locations a sales context may draw on.
 *
 * The rule the domain states is open by default and restrictive only once somebody says otherwise
 * (doc 09 §6.2): a context with no assignment rows is **not** restricted, and the moment one row
 * exists the context is restricted to the locations it names. A caller that read "no rows" as "no
 * locations" would refuse to sell from a fully configured installation, so the two answers are
 * distinguished here.
 *
 * The other invariant the suite pins is the default: a context has at most one default location, and
 * marking a new one demotes the previous one **inside the same transaction**, so the rule is never
 * observably broken between two statements.
 *
 * The service is constructed directly with an in-memory double of its repository and the manager it
 * writes through. The double states the `where` and the `order` the service states, so a read that
 * stopped being scoped to its context is caught here.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000009';
const ORG = '00000000-0000-4000-8000-000000000002';
const CHANNEL = '00000000-0000-4000-8000-000000000040';
const OTHER_CHANNEL = '00000000-0000-4000-8000-000000000041';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const OTHER_WAREHOUSE = '00000000-0000-4000-8000-000000000011';
const FOREIGN_WAREHOUSE = '00000000-0000-4000-8000-000000000012';

type Row = Record<string, any>;

/**
 * An in-memory stand-in for the assignment repository and the manager it writes through.
 *
 * @param tables The whole datastore.
 */
function repository(tables: Record<string, Row[]>) {
	const entityToTable = new Map<unknown, string>([
		[Warehouse, 'warehouse'],
		[ChannelWarehouse, 'channel_warehouse']
	]);
	let sequence = 0;

	const rows = (entity: unknown): Row[] => {
		const table = entityToTable.get(entity);

		if (!table) {
			throw new Error('the in-memory double was handed an entity it does not know');
		}

		return tables[table];
	};
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	const matches = (row: Row, where: Row = {}) =>
		Object.entries(where).every(([field, expected]) => {
			if (expected && typeof expected === 'object' && 'type' in (expected as Row)) {
				throw new Error(`the in-memory double does not implement the "${(expected as Row).type}" operator`);
			}

			return expected === undefined ? true : same(row[field], expected);
		});
	const snapshot = (): Record<string, Row[]> =>
		Object.fromEntries(
			Object.entries(tables).map(([table, tableRows]) => [table, tableRows.map((row) => ({ ...row }))])
		);
	const restore = (copy: Record<string, Row[]>) => {
		for (const [table, tableRows] of Object.entries(copy)) {
			tables[table] = tableRows;
		}
	};

	const manager: any = {
		create: (entity: unknown, partial: Row) => ({ ...partial }),
		save: async (entity: unknown, rowOrRows: any) => {
			const list = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];

			for (const row of list) {
				const table = rows(entity);
				const index = row.id ? table.findIndex((candidate) => same(candidate.id, row.id)) : -1;

				if (index >= 0) {
					Object.assign(table[index], row);
					continue;
				}

				if (!row.id) {
					row.id = `${String(entityToTable.get(entity))}-${++sequence}`;
				}

				table.push(row);
			}

			return Array.isArray(rowOrRows) ? list : list[0];
		},
		findOne: async (entity: unknown, options: any = {}) =>
			rows(entity).find((row) => matches(row, options.where)) ?? null,
		find: async (entity: unknown, options: any = {}) => {
			const found = rows(entity).filter((row) => matches(row, options.where));
			const columns = Object.keys(options.order ?? {});

			if (!columns.length) {
				return found;
			}

			return [...found].sort((left, right) => {
				for (const column of columns) {
					if (left[column] === right[column]) {
						continue;
					}

					const direction = options.order[column] === 'DESC' ? -1 : 1;

					return (left[column] > right[column] ? 1 : -1) * direction;
				}

				return 0;
			});
		},
		count: async (entity: unknown, options: any = {}) =>
			rows(entity).filter((row) => matches(row, options.where)).length,
		delete: async (entity: unknown, criteria: unknown) => {
			const table = rows(entity);
			const doomed = Array.isArray(criteria) ? criteria : [criteria];
			let affected = 0;

			for (const one of doomed) {
				const index = table.findIndex((row) =>
					typeof one === 'object' && one !== null && (one as Row).id === undefined
						? matches(row, one as Row)
						: same(row.id, typeof one === 'object' ? (one as Row).id : one)
				);

				if (index >= 0) {
					table.splice(index, 1);
					affected += 1;
				}
			}

			return { affected };
		}
	};
	manager.transaction = async (run: (transactional: any) => Promise<any>) => {
		const copy = snapshot();

		try {
			return await run(manager);
		} catch (error) {
			restore(copy);
			throw error;
		}
	};

	const typeOrmChannelWarehouseRepository: any = {
		manager,
		metadata: { tableName: 'channel_warehouse', hasColumnWithPropertyPath: () => false },
		create: (partial: Row) => ({ ...partial }),
		save: async (rowOrRows: any) => manager.save(ChannelWarehouse, rowOrRows),
		find: async (options: any = {}) => manager.find(ChannelWarehouse, options),
		findOne: async (options: any = {}) => manager.findOne(ChannelWarehouse, options),
		findAndCount: async (options: any = {}) => {
			const items = await manager.find(ChannelWarehouse, options);

			return [items, items.length];
		},
		count: async () => tables.channel_warehouse.length,
		delete: async (criteria: any) => manager.delete(ChannelWarehouse, criteria)
	};

	return { manager, typeOrmChannelWarehouseRepository, tables };
}

/**
 * Builds the assignment service over one in-memory datastore.
 *
 * @param assignments The assignment rows the fixture starts with.
 */
function assignmentFixture(assignments: Row[] = []) {
	const tables: Record<string, Row[]> = {
		warehouse: [
			{ id: WAREHOUSE, tenantId: TENANT, organizationId: ORG, name: 'North' },
			{ id: OTHER_WAREHOUSE, tenantId: TENANT, organizationId: ORG, name: 'South' },
			{ id: FOREIGN_WAREHOUSE, tenantId: OTHER_TENANT, organizationId: ORG, name: 'Theirs' }
		],
		channel_warehouse: [...assignments]
	};
	const store = repository(tables);
	const service = new ChannelWarehouseService(
		store.typeOrmChannelWarehouseRepository as never,
		{} as never
	);

	return {
		service,
		tables,
		rows: () => tables.channel_warehouse,
		defaults: (channelId: string = CHANNEL) =>
			tables.channel_warehouse.filter((row) => row.channelId === channelId && row.isDefault)
	};
}

/** One assignment row. */
const assignmentRow = (id: string, warehouseId: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	channelId: CHANNEL,
	warehouseId,
	isDefault: false,
	priority: 0,
	...overrides
});

describe('ChannelWarehouseService — assigning locations to a sales context (doc 09 §6.2)', () => {
	it('assigns a location to a context, unremarkable until it is made the default', async () => {
		const fixture = assignmentFixture();

		const assignment = await fixture.service.assign({ channelId: CHANNEL, warehouseId: WAREHOUSE });

		expect(assignment).toMatchObject({
			channelId: CHANNEL,
			warehouseId: WAREHOUSE,
			isDefault: false,
			priority: 0,
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(fixture.rows()).toHaveLength(1);
	});

	it('refuses to assign a location that does not exist in the caller’s tenant', async () => {
		const fixture = assignmentFixture();

		await expect(
			fixture.service.assign({ channelId: CHANNEL, warehouseId: 'no-such-warehouse' })
		).rejects.toMatchObject({
			response: { code: 'STOCK_LEVEL_NOT_FOUND', details: { warehouseId: 'no-such-warehouse' } }
		});
		// A location of another tenant is not this tenant's to assign, and reads as missing rather than as
		// forbidden, so a caller cannot probe for it.
		await expect(
			fixture.service.assign({ channelId: CHANNEL, warehouseId: FOREIGN_WAREHOUSE })
		).rejects.toMatchObject({ response: { code: 'STOCK_LEVEL_NOT_FOUND' } });
		expect(fixture.rows()).toEqual([]);
	});

	it('keeps at most one default location per context', async () => {
		const fixture = assignmentFixture();

		await fixture.service.assign({ channelId: CHANNEL, warehouseId: WAREHOUSE, isDefault: true });
		await fixture.service.assign({ channelId: CHANNEL, warehouseId: OTHER_WAREHOUSE, isDefault: true });

		// The promotion demotes the previous default in the same transaction, so the rule is never
		// observably broken — not even between two statements.
		expect(fixture.defaults()).toHaveLength(1);
		expect(fixture.defaults()[0]).toMatchObject({ warehouseId: OTHER_WAREHOUSE });
		expect(fixture.rows().find((row) => row.warehouseId === WAREHOUSE)).toMatchObject({ isDefault: false });
	});

	it('leaves a context’s own default where it is when it is re-assigned as the default', async () => {
		const fixture = assignmentFixture();

		await fixture.service.assign({ channelId: CHANNEL, warehouseId: WAREHOUSE, isDefault: true });
		await fixture.service.assign({
			channelId: CHANNEL,
			warehouseId: WAREHOUSE,
			isDefault: true,
			priority: 5
		});

		expect(fixture.rows()).toHaveLength(1);
		expect(fixture.defaults()).toHaveLength(1);
		expect(fixture.rows()[0]).toMatchObject({ warehouseId: WAREHOUSE, isDefault: true, priority: 5 });
	});

	it('answers an empty assignment set as unrestricted and a non-empty one as the locations it names', async () => {
		// The open-by-default rule: "no rows" means every fulfilment location is eligible, never that none
		// is. A caller that read it the other way would refuse to sell from a fresh installation.
		const fixture = assignmentFixture();

		expect(await fixture.service.eligibleWarehouseIds(CHANNEL)).toEqual({
			restricted: false,
			warehouseIds: []
		});

		await fixture.service.assign({ channelId: CHANNEL, warehouseId: WAREHOUSE, priority: 1 });
		await fixture.service.assign({ channelId: CHANNEL, warehouseId: OTHER_WAREHOUSE, priority: 9 });

		expect(await fixture.service.eligibleWarehouseIds(CHANNEL)).toEqual({
			restricted: true,
			warehouseIds: [OTHER_WAREHOUSE, WAREHOUSE]
		});
	});

	it('scopes the assignments to the context they belong to', async () => {
		// Control: another context's rows are not this context's eligible locations, and a context with no
		// rows of its own is still unrestricted while another context is restricted.
		const fixture = assignmentFixture([
			assignmentRow('mine', WAREHOUSE),
			assignmentRow('theirs', OTHER_WAREHOUSE, { channelId: OTHER_CHANNEL }),
			assignmentRow('another-tenant', OTHER_WAREHOUSE, { tenantId: OTHER_TENANT })
		]);

		expect(await fixture.service.eligibleWarehouseIds(CHANNEL)).toEqual({
			restricted: true,
			warehouseIds: [WAREHOUSE]
		});
		expect(await fixture.service.eligibleWarehouseIds(OTHER_CHANNEL)).toEqual({
			restricted: true,
			warehouseIds: [OTHER_WAREHOUSE]
		});
		expect(await fixture.service.eligibleWarehouseIds('a-context-with-nothing')).toEqual({
			restricted: false,
			warehouseIds: []
		});
	});

	it('removes one assignment and leaves the others where they are', async () => {
		const fixture = assignmentFixture();

		await fixture.service.assign({ channelId: CHANNEL, warehouseId: WAREHOUSE, isDefault: true });
		await fixture.service.assign({ channelId: CHANNEL, warehouseId: OTHER_WAREHOUSE });

		await fixture.service.unassign(CHANNEL, OTHER_WAREHOUSE);

		expect(fixture.rows()).toHaveLength(1);
		expect(fixture.rows()[0]).toMatchObject({ warehouseId: WAREHOUSE, isDefault: true });
		// Unassigning what is not there is the state the caller asked for, and takes nothing else with it.
		await fixture.service.unassign(CHANNEL, OTHER_WAREHOUSE);
		expect(fixture.rows()).toHaveLength(1);
	});

	it('lists the assignments it holds', async () => {
		const fixture = assignmentFixture([assignmentRow('one', WAREHOUSE), assignmentRow('two', OTHER_WAREHOUSE)]);

		const listed = await fixture.service.findAssignments();

		expect(listed.total).toBe(2);
		expect(listed.items).toHaveLength(2);
	});
});
