/**
 * Three module boundaries are doubled here, and the reason is the same for all three.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a transfer service needs and none of which is
 * available outside a running application; its nested `uuid` is ESM-only, so reading one entity would
 * fail under jest. `@gauzy/config` reads the process environment at import time. Both are therefore
 * doubled at the module boundary, and **the services under test are the real ones**: the transfer
 * service, the transfer-line service and the real ledger engine everything moves through.
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

import { Product, WarehouseProduct, WarehouseProductVariant } from '@gauzy/core';
import {
	StockMovementType,
	StockMovementReferenceType,
	StockTransferStatus
} from '../inventory.enums';
import { StockLevelService } from '../stock-level/stock-level.service';
import { StockMovement } from '../stock-movement/stock-movement.entity';
import { StockTransferLine } from '../stock-transfer-line/stock-transfer-line.entity';
import { StockTransferLineService } from '../stock-transfer-line/stock-transfer-line.service';
import { StockTransfer } from './stock-transfer.entity';
import { StockTransferService } from './stock-transfer.service';

/**
 * Moving stock between locations.
 *
 * Dispatch writes the outbound movement at the source, receipt writes the inbound movement at the
 * destination, and the two never happen at once (doc 09 §8). The suite pins the properties that
 * follow from that:
 *
 * - a transfer is numbered from the platform's sequence and starts as a draft with its lines at zero
 *   shipped, received and damaged (doc 09 §8.1);
 * - the state machine of §8.2 is the mechanism this service actually uses to serialise competing
 *   callers: a transition out of a state the document is no longer in is **refused**, so the loser of
 *   a race gets a stated refusal rather than a second shipment;
 * - **shipping and receiving leave the total across the two locations unchanged**: the source drops by
 *   exactly what was dispatched, the destination rises by exactly what arrived, and nothing is created
 *   or destroyed in between (§8.3, INV-19);
 * - what did not arrive is never silently dropped: a short or damaged receipt is recorded on the line,
 *   and the units that never arrived are exactly the difference in the total (INV-13);
 * - a shipment is **one transaction**: a line that would over-ship refuses the whole dispatch, so a
 *   half-shipped document cannot exist;
 * - a cancellation is not an un-shipment: the units that left remain recorded as having left, and the
 *   document says it was cancelled instead (§8.2 — dispatched stock returns through a compensating
 *   transfer, never by rewriting the row).
 *
 * The service is constructed directly over an in-memory double of the connection, with the real
 * ledger engine behind it. The double keeps a real snapshot, so "no half-state" is asserted against
 * the store and not against a mock's call log. The sequence service is the one collaborator that is a
 * double: numbering is a kernel capability with its own suite.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const SOURCE = '00000000-0000-4000-8000-000000000010';
const DESTINATION = '00000000-0000-4000-8000-000000000011';
const PRODUCT = '00000000-0000-4000-8000-000000000020';
const VARIANT = '00000000-0000-4000-8000-000000000030';
const OTHER_VARIANT = '00000000-0000-4000-8000-000000000031';

type Row = Record<string, any>;

/**
 * The in-memory stand-in for the connection the transfer service and the ledger engine write through.
 *
 * @param tables The whole datastore.
 */
function datastore(tables: Record<string, Row[]>) {
	const entityToTable = new Map<unknown, string>([
		[Product, 'product'],
		[WarehouseProduct, 'warehouse_product'],
		[WarehouseProductVariant, 'warehouse_product_variant'],
		[StockMovement, 'stock_movement'],
		[StockTransfer, 'stock_transfer'],
		[StockTransferLine, 'stock_transfer_line']
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
	const snapshot = (): Record<string, Row[]> =>
		Object.fromEntries(
			Object.entries(tables).map(([table, tableRows]) => [table, tableRows.map((row) => ({ ...row }))])
		);
	const restore = (copy: Record<string, Row[]>) => {
		for (const [table, tableRows] of Object.entries(copy)) {
			tables[table] = tableRows;
		}
	};
	const matches = (row: Row, where: Row = {}) =>
		Object.entries(where).every(([field, expected]) => {
			if (expected && typeof expected === 'object' && 'type' in (expected as Row)) {
				throw new Error(`the in-memory double does not implement the "${(expected as Row).type}" operator`);
			}

			if (expected === undefined) {
				return true;
			}

			return same(row[field], expected);
		});
	const levels = (conditions: Array<{ sql: string; params: Row }>): Row[] =>
		tables.warehouse_product_variant.filter((level) => {
			for (const condition of conditions) {
				if (/aggregate\.warehouseId/.test(condition.sql)) {
					const aggregate = tables.warehouse_product.find((row) => same(row.id, level.warehouseProductId));

					if (!same(aggregate?.warehouseId, condition.params.warehouseId)) {
						return false;
					}
				}
				if (/level\.variantId/.test(condition.sql) && !same(level.variantId, condition.params.variantId)) {
					return false;
				}
			}

			return true;
		});
	/** Reads the delta out of the SQL the engine builds for its aggregate update. */
	const deltaFrom = (value: unknown): number => {
		const sql = typeof value === 'function' ? String((value as () => string)()) : String(value);
		const match = /"\s*\+\s*(-?\d+(?:\.\d+)?)/.exec(sql);

		if (!match) {
			throw new Error(`the in-memory double cannot read a delta out of "${sql}"`);
		}

		return Number(match[1]);
	};

	let manager: any;
	const createQueryBuilder = (entity?: unknown): any => {
		let target = entity;
		let rawSelect: string | null = null;
		let updateSpec: Row | null = null;
		const conditions: Array<{ sql: string; params: Row }> = [];
		const query: any = {
			innerJoin: () => query,
			leftJoin: () => query,
			select: (first: unknown, second?: string) => {
				if (!Array.isArray(first) && typeof second === 'string') {
					rawSelect = String(first);
				}

				return query;
			},
			addSelect: () => query,
			limit: () => query,
			orderBy: () => query,
			where: (sql: string, params: Row = {}) => {
				conditions.push({ sql, params });

				return query;
			},
			andWhere: (sql: string, params: Row = {}) => {
				conditions.push({ sql, params });

				return query;
			},
			update: (entityToUpdate: unknown) => {
				target = entityToUpdate;

				return query;
			},
			set: (spec: Row) => {
				updateSpec = spec;

				return query;
			},
			getMany: async () => (target === WarehouseProductVariant ? levels(conditions) : rows(target)),
			getOne: async () => {
				const found = target === WarehouseProductVariant ? levels(conditions) : rows(target);

				return found[0] ?? null;
			},
			getRawOne: async () => {
				if (/SUM\(movement\.quantity\)/.test(rawSelect ?? '')) {
					const params = conditions.reduce<Row>((all, one) => ({ ...all, ...one.params }), {});
					const total = tables.stock_movement
						.filter(
							(movement) =>
								same(movement.variantId, params.variantId) &&
								same(movement.warehouseId, params.warehouseId)
						)
						.reduce((sum, movement) => sum + Number(movement.quantity ?? 0), 0);

					return { total };
				}

				throw new Error(`the in-memory double does not implement the raw read "${rawSelect}"`);
			},
			execute: async () => {
				if (!updateSpec) {
					throw new Error('the in-memory double only implements an UPDATE');
				}

				const id = conditions.find((condition) => condition.params.id)?.params.id;
				const version = conditions.find((condition) => condition.params.version)?.params.version;
				const row = rows(target).find((candidate) => same(candidate.id, id));

				if (!row) {
					return { affected: 0 };
				}

				if (version !== undefined && !same(row.version, version)) {
					return { affected: 0 };
				}

				for (const [column, value] of Object.entries(updateSpec)) {
					row[column] = typeof value === 'function' ? Number(row[column] ?? 0) + deltaFrom(value) : value;
				}

				return { affected: 1 };
			}
		};

		return query;
	};

	manager = {
		connection: { options: { type: 'better-sqlite3' } },
		createQueryBuilder,
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
		find: async (entity: unknown, options: any = {}) =>
			rows(entity).filter((row) => matches(row, options.where)),
		count: async (entity: unknown, options: any = {}) =>
			rows(entity).filter((row) => matches(row, options.where)).length,
		update: async (entity: unknown, id: unknown, patch: Row) => {
			const row = rows(entity).find((candidate) => same(candidate.id, id));

			if (row) {
				Object.assign(row, patch);
			}

			return { affected: row ? 1 : 0 };
		},
		delete: async (entity: unknown, criteria: unknown) => {
			const ids = Array.isArray(criteria) ? criteria : [criteria];
			const table = rows(entity);
			let affected = 0;

			for (const id of ids) {
				const index = table.findIndex((candidate) => same(candidate.id, id));

				if (index >= 0) {
					table.splice(index, 1);
					affected += 1;
				}
			}

			return { affected };
		},
		query: async (sql: string) => {
			if (/SET LOCAL lock_timeout|SET SESSION innodb_lock_wait_timeout|FOR UPDATE/.test(sql)) {
				return [];
			}

			throw new Error(`the in-memory double does not implement the statement "${sql}"`);
		}
	};

	/**
	 * The transaction the service and the engine both ask for: the callback sees the same datastore,
	 * and a throw from anywhere inside it puts the datastore back exactly as it was, which is what makes
	 * "no half-state" a claim about the store rather than about the call log.
	 */
	manager.transaction = async (run: (transactional: any) => Promise<any>) => {
		const copy = snapshot();

		try {
			return await run(manager);
		} catch (error) {
			restore(copy);
			throw error;
		}
	};

	const dataSource: any = { manager, createQueryBuilder, transaction: manager.transaction };
	const repository = (table: string, entity: unknown): any => ({
		manager,
		metadata: { tableName: table, hasColumnWithPropertyPath: () => false },
		create: (partial: Row) => ({ ...partial }),
		save: async (rowOrRows: any) => manager.save(entity, rowOrRows),
		find: async (options: any = {}) => rows(entity).filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) => rows(entity).find((row) => matches(row, options.where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows(entity).filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => rows(entity).length,
		createQueryBuilder: () => createQueryBuilder(entity),
		update: async (criteria: any, patch: Row) => manager.update(entity, criteria?.id ?? criteria, patch),
		delete: async (criteria: any) => manager.delete(entity, criteria?.id ?? criteria)
	});

	return {
		dataSource,
		manager,
		tables,
		transferRepository: repository('stock_transfer', StockTransfer),
		lineRepository: repository('stock_transfer_line', StockTransferLine),
		ledgerOf: (warehouseId: string) =>
			tables.stock_movement.filter((movement) => same(movement.warehouseId, warehouseId)),
		totalOnHand: () =>
			tables.warehouse_product_variant.reduce((sum, level) => sum + Number(level.quantity ?? 0), 0)
	};
}

/**
 * Builds the transfer services over the real ledger engine and one in-memory datastore where the
 * fixture variant is stocked at two locations.
 *
 * @param options.source What the source location holds.
 * @param options.destination What the destination location holds.
 */
function transferFixture(options: { source?: number; destination?: number } = {}) {
	const tables: Record<string, Row[]> = {
		product: [{ id: PRODUCT, tenantId: TENANT, organizationId: ORG }],
		warehouse_product: [],
		warehouse_product_variant: [],
		stock_movement: [],
		stock_transfer: [],
		stock_transfer_line: []
	};

	for (const [index, warehouseId] of [SOURCE, DESTINATION].entries()) {
		const quantity = index === 0 ? options.source ?? 100 : options.destination ?? 40;

		tables.warehouse_product.push({
			id: `aggregate-${index + 1}`,
			tenantId: TENANT,
			organizationId: ORG,
			warehouseId,
			productId: PRODUCT,
			quantity,
			reservedQuantity: 0,
			version: 1
		});
		tables.warehouse_product_variant.push({
			id: `level-${index + 1}`,
			tenantId: TENANT,
			organizationId: ORG,
			warehouseProductId: `aggregate-${index + 1}`,
			variantId: VARIANT,
			quantity,
			reservedQuantity: 0,
			incomingQuantity: 0,
			safetyStock: 0,
			allowBackorder: false,
			backorderLimit: null,
			version: 1
		});
	}

	const store = datastore(tables);
	const stockLevelService = new StockLevelService(store.dataSource as never);
	const allocated: string[] = [];
	const sequenceService = {
		allocate: async (key: string) => {
			allocated.push(key);

			return { key, value: allocated.length, formatted: `TRF-${String(allocated.length).padStart(6, '0')}` };
		}
	};
	const service = new StockTransferService(
		store.transferRepository as never,
		{} as never,
		sequenceService as never,
		stockLevelService
	);

	return {
		service,
		store,
		tables,
		allocated,
		transfer: (id: string = 'stock_transfer-1') => tables.stock_transfer.find((row) => row.id === id),
		lines: () => tables.stock_transfer_line,
		onHand: (warehouseId: string) => {
			const aggregate = tables.warehouse_product.find((row) => row.warehouseId === warehouseId);

			return Number(
				tables.warehouse_product_variant.find((row) => row.warehouseProductId === aggregate?.id)?.quantity
			);
		}
	};
}

/** A draft transfer with one line, approved and ready to ship: the fixture for the later steps. */
async function approvedTransfer(quantity = 10) {
	const fixture = transferFixture();
	const transfer = await fixture.service.createTransfer({
		fromWarehouseId: SOURCE,
		toWarehouseId: DESTINATION,
		lines: [{ variantId: VARIANT, requestedQuantity: quantity }]
	});

	await fixture.service.request(transfer.id);
	await fixture.service.approve(transfer.id);

	return { fixture, transfer, lineId: fixture.lines()[0].id };
}

/**
 * A transfer as it stands *after* a dispatch, written straight into the store.
 *
 * The dispatch path is itself the subject of the failing case below, so the cases that are about a
 * guard or about a cancellation seed the state those cases are about instead of reaching it through
 * a path that cannot currently produce it. Everything else about the document — its status, its
 * version, its shipped line — is exactly what a dispatch would have left.
 */
function dispatchedFixture(options: { requested?: number; shipped?: number } = {}) {
	const fixture = transferFixture();
	const requested = options.requested ?? 10;
	const shipped = options.shipped ?? 10;

	fixture.tables.stock_transfer.push({
		id: 'transfer-seeded',
		number: 'TRF-000009',
		tenantId: TENANT,
		organizationId: ORG,
		fromWarehouseId: SOURCE,
		toWarehouseId: DESTINATION,
		status: StockTransferStatus.IN_TRANSIT,
		version: 4,
		shippedAt: new Date('2026-01-15T10:00:00.000Z')
	});
	fixture.tables.stock_transfer_line.push({
		id: 'line-seeded',
		tenantId: TENANT,
		organizationId: ORG,
		transferId: 'transfer-seeded',
		variantId: VARIANT,
		requestedQuantity: requested,
		shippedQuantity: shipped,
		receivedQuantity: 0,
		damagedQuantity: 0
	});

	return { ...fixture, transferId: 'transfer-seeded', lineId: 'line-seeded' };
}

/** The in-transit remainder of every line: what has left a source and not yet arrived. */
const stillInTransit = (fixture: ReturnType<typeof dispatchedFixture>) =>
	fixture
		.lines()
		.reduce(
			(sum, line) =>
				sum + Number(line.shippedQuantity) - Number(line.receivedQuantity) - Number(line.damagedQuantity),
			0
		);

describe('StockTransferService — creating, numbering and the state machine (doc 09 §8.1, §8.2)', () => {
	it('numbers a draft transfer from the platform sequence and starts its lines at nothing moved', async () => {
		const fixture = transferFixture();

		const transfer = await fixture.service.createTransfer({
			fromWarehouseId: SOURCE,
			toWarehouseId: DESTINATION,
			note: 'Rebalance the north shelf',
			lines: [{ variantId: VARIANT, requestedQuantity: 10, unitCost: 4 }]
		});

		expect(fixture.allocated).toEqual(['TRANSFER']);
		expect(transfer).toMatchObject({
			number: 'TRF-000001',
			status: StockTransferStatus.DRAFT,
			fromWarehouseId: SOURCE,
			toWarehouseId: DESTINATION,
			version: 1,
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(fixture.lines()).toHaveLength(1);
		expect(fixture.lines()[0]).toMatchObject({
			transferId: transfer.id,
			variantId: VARIANT,
			requestedQuantity: 10,
			shippedQuantity: 0,
			receivedQuantity: 0,
			damagedQuantity: 0,
			unitCost: 4
		});
		// Nothing has moved yet: a draft transfer writes no ledger row.
		expect(fixture.store.ledgerOf(SOURCE)).toEqual([]);
	});

	it('refuses a transfer from a location to itself', async () => {
		const fixture = transferFixture();

		await expect(
			fixture.service.createTransfer({ fromWarehouseId: SOURCE, toWarehouseId: SOURCE })
		).rejects.toMatchObject({ response: { code: 'STOCK_TRANSFER_SAME_LOCATION' } });
		expect(fixture.tables.stock_transfer).toEqual([]);
		expect(fixture.allocated).toEqual([]);
	});

	it('walks the transitions that move stock no distance and bumps the version each time', async () => {
		const { fixture, transfer } = await approvedTransfer(10);

		// DRAFT → REQUESTED → APPROVED: a document being prepared moves no stock at all.
		expect(fixture.transfer()).toMatchObject({ status: StockTransferStatus.APPROVED, version: 3 });
		expect(fixture.store.ledgerOf(SOURCE)).toEqual([]);
		expect(fixture.store.totalOnHand()).toBe(140);
	});

	it('refuses the transitions the state machine does not contain', async () => {
		// The mechanism this service uses to serialise competing callers is the state guard: a transition
		// out of a state the document is no longer in is refused, so the loser of a race gets a stated
		// refusal instead of a second shipment.
		const fixture = transferFixture();
		const draft = await fixture.service.createTransfer({
			fromWarehouseId: SOURCE,
			toWarehouseId: DESTINATION,
			lines: [{ variantId: VARIANT, requestedQuantity: 10 }]
		});

		await expect(fixture.service.approve(draft.id)).rejects.toMatchObject({
			response: {
				code: 'STOCK_TRANSFER_ILLEGAL_TRANSITION',
				details: { status: StockTransferStatus.DRAFT, requestedStatus: StockTransferStatus.APPROVED }
			}
		});
		await expect(
			fixture.service.ship(draft.id, [{ lineId: fixture.lines()[0].id, shippedQuantity: 1 }])
		).rejects.toMatchObject({
			response: {
				code: 'STOCK_TRANSFER_ILLEGAL_TRANSITION',
				details: { status: StockTransferStatus.DRAFT, expected: [StockTransferStatus.APPROVED] }
			}
		});
		await expect(
			fixture.service.receive(draft.id, [{ lineId: fixture.lines()[0].id, receivedQuantity: 1 }])
		).rejects.toMatchObject({ response: { code: 'STOCK_TRANSFER_ILLEGAL_TRANSITION' } });
		// Nothing moved and the document is where it was.
		expect(fixture.transfer(draft.id)).toMatchObject({ status: StockTransferStatus.DRAFT, version: 1 });
		expect(fixture.store.ledgerOf(SOURCE)).toEqual([]);
	});

	it('refuses to request a transfer that was already requested', async () => {
		const { fixture, transfer } = await approvedTransfer();

		await expect(fixture.service.request(transfer.id)).rejects.toMatchObject({
			response: { code: 'STOCK_TRANSFER_ILLEGAL_TRANSITION' }
		});
		expect(fixture.transfer()).toMatchObject({ status: StockTransferStatus.APPROVED, version: 3 });
	});

	it('reports a transition of a transfer that does not exist as missing', async () => {
		const fixture = transferFixture();

		await expect(fixture.service.request('no-such-transfer')).rejects.toMatchObject({
			response: { code: 'STOCK_LEVEL_NOT_FOUND', details: { transferId: 'no-such-transfer' } }
		});
	});

	it('refuses to cancel a transfer that has been received', async () => {
		// A fully received transfer is terminal: the stock is at the destination, and there is nothing left
		// for a cancellation to stop (§8.2).
		const fixture = dispatchedFixture();

		await fixture.service.receive(fixture.transferId, [
			{ lineId: fixture.lineId, receivedQuantity: 0 }
		]).catch(() => undefined);
		fixture.tables.stock_transfer[0].status = StockTransferStatus.RECEIVED;

		await expect(fixture.service.cancel(fixture.transferId, 'Too late')).rejects.toMatchObject({
			response: {
				code: 'STOCK_TRANSFER_ILLEGAL_TRANSITION',
				details: { status: StockTransferStatus.RECEIVED, requestedStatus: StockTransferStatus.CANCELED }
			}
		});
		expect(fixture.transfer(fixture.transferId)).toMatchObject({ status: StockTransferStatus.RECEIVED });
	});

	// Doc 09 §8.2 states that *every* transition takes `If-Match: "<version>"` and bumps `version`, and
	// §15.3 names the `If-Match` conflict among the unit cases this service owes. The service bumps the
	// counter on every transition but never compares an expected one — `transition` reads the row and
	// branches on its `status` alone (`stock-transfer.service.ts`, lines 287–313) — so a caller working
	// from a stale copy of the document is accepted rather than refused.
	it.failing('refuses a transition that states a version the document has moved past', async () => {
		const { fixture, transfer } = await approvedTransfer();

		await expect(
			(
				fixture.service as unknown as {
					cancel: (id: string, reason: string, version: number) => Promise<unknown>;
				}
			).cancel(transfer.id, 'Stale copy of the document', transfer.version - 1)
		).rejects.toMatchObject({ response: { code: expect.stringContaining('VERSION_CONFLICT') } });
	});
});

/**
 * The ledger effect of a dispatch and a receipt.
 *
 * Every case in this block fails against the service as it stands, for one reason, and the reason is
 * the same in all of them: `StockLevelService.resolveLevel` resolves the product-level aggregate row
 * *before* it looks for the level row — and `resolveAggregate` refuses to run without a `productId`
 * (`stock-level.service.ts`, line 225: "A level row is addressed by its product, so the movement must
 * carry the product id") — while `StockTransferService.ship` and `.receive` pass no `productId` in
 * their `applyMovement` calls (`stock-transfer.service.ts`, lines 155, 215 and 227). Every dispatch
 * and every receipt therefore fails with `STOCK_INVARIANT_VIOLATION` / `INV-01` **even when the level
 * row already exists and could be resolved from `(warehouseId, variantId)`**, which is the first of
 * the two ways doc 09 §4.1 step 1 states a level row is addressed. No transfer can move stock today.
 */
describe('StockTransferService — shipping and receiving (doc 09 §8.3, INV-13, INV-19)', () => {
	it.failing('moves the dispatched quantity out of the source, and leaves the total across locations unchanged', async () => {
		const { fixture, transfer, lineId } = await approvedTransfer(10);

		expect(fixture.store.totalOnHand()).toBe(140);

		await fixture.service.ship(transfer.id, [{ lineId, shippedQuantity: 10 }]);

		// The source drops by exactly what was dispatched, and the destination is not touched: the stock
		// has left and has not arrived, and pretending otherwise would make one of the two locations wrong.
		expect(fixture.onHand(SOURCE)).toBe(90);
		expect(fixture.onHand(DESTINATION)).toBe(40);
		expect(fixture.lines()[0].shippedQuantity).toBe(10);
		expect(fixture.store.ledgerOf(SOURCE)).toHaveLength(1);
		expect(fixture.store.ledgerOf(SOURCE)[0]).toMatchObject({
			type: StockMovementType.TRANSFER_OUT,
			quantity: -10,
			quantityBefore: 100,
			quantityAfter: 90,
			referenceType: StockMovementReferenceType.TRANSFER,
			// The line is what the movement cites, so the in-transit balance is derivable per line.
			referenceId: lineId
		});
		expect(fixture.store.ledgerOf(DESTINATION)).toEqual([]);

		await fixture.service.receive(transfer.id, [{ lineId, receivedQuantity: 10 }]);

		expect(fixture.onHand(DESTINATION)).toBe(50);
		expect(fixture.store.totalOnHand()).toBe(140);
		expect(fixture.lines()[0]).toMatchObject({ receivedQuantity: 10, damagedQuantity: 0 });
		expect(fixture.store.ledgerOf(DESTINATION)[0]).toMatchObject({
			type: StockMovementType.TRANSFER_IN,
			quantity: 10,
			quantityBefore: 40,
			quantityAfter: 50,
			referenceId: lineId
		});
		expect(fixture.transfer()).toMatchObject({ status: StockTransferStatus.RECEIVED });
	});

	it.failing('records a partial receipt on the line and completes it on the next one', async () => {
		const { fixture, transfer, lineId } = await approvedTransfer(10);

		await fixture.service.ship(transfer.id, [{ lineId, shippedQuantity: 10 }]);
		await fixture.service.receive(transfer.id, [{ lineId, receivedQuantity: 4 }]);

		expect(fixture.transfer()).toMatchObject({ status: StockTransferStatus.PARTIALLY_RECEIVED });
		expect(fixture.lines()[0]).toMatchObject({ shippedQuantity: 10, receivedQuantity: 4 });
		expect(fixture.onHand(DESTINATION)).toBe(44);

		await fixture.service.receive(transfer.id, [{ lineId, receivedQuantity: 6 }]);

		expect(fixture.transfer()).toMatchObject({ status: StockTransferStatus.RECEIVED });
		expect(fixture.transfer().receivedAt).toBeInstanceOf(Date);
		expect(fixture.lines()[0].receivedQuantity).toBe(10);
		expect(fixture.onHand(DESTINATION)).toBe(50);
		expect(fixture.store.totalOnHand()).toBe(140);
	});

	it.failing('records the units that arrived damaged on the line, losing exactly those from the total', async () => {
		// What did not arrive is never silently dropped: nine arrived, one was damaged on the way, and the
		// difference in the total across the two locations is exactly that one unit (INV-13, §8.3).
		const { fixture, transfer, lineId } = await approvedTransfer(10);

		await fixture.service.ship(transfer.id, [{ lineId, shippedQuantity: 10 }]);
		await fixture.service.receive(transfer.id, [{ lineId, receivedQuantity: 9, damagedQuantity: 1 }]);

		expect(fixture.transfer()).toMatchObject({ status: StockTransferStatus.RECEIVED });
		expect(fixture.lines()[0]).toMatchObject({ shippedQuantity: 10, receivedQuantity: 9, damagedQuantity: 1 });
		expect(fixture.onHand(DESTINATION)).toBe(49);
		expect(fixture.store.totalOnHand()).toBe(139);
		// The damage is recorded as a row of its own, so the loss is visible in the ledger as well as on the
		// line — with no quantity change, because the unit never entered the destination's sellable stock.
		expect(
			fixture.store.ledgerOf(DESTINATION).find((row) => row.type === StockMovementType.DAMAGE)
		).toMatchObject({ quantity: 0, referenceId: lineId, reason: 'DAMAGE' });
	});

	it('refuses a receipt larger than what was shipped and leaves both locations alone', async () => {
		const fixture = dispatchedFixture({ requested: 10, shipped: 10 });

		await expect(
			fixture.service.receive(fixture.transferId, [{ lineId: fixture.lineId, receivedQuantity: 11 }])
		).rejects.toMatchObject({
			response: {
				code: 'STOCK_TRANSFER_OVER_RECEIPT',
				details: { lineId: fixture.lineId, shipped: 10, received: 11, damaged: 0 }
			}
		});
		// The refusal is a receipt that did not happen: the line and both levels are exactly as they were.
		expect(fixture.lines()[0]).toMatchObject({ receivedQuantity: 0, damagedQuantity: 0 });
		expect(fixture.onHand(DESTINATION)).toBe(40);
		expect(fixture.store.ledgerOf(DESTINATION)).toEqual([]);
		expect(fixture.transfer(fixture.transferId)).toMatchObject({ status: StockTransferStatus.IN_TRANSIT });
	});

	it('refuses a receipt that would take a line past what it shipped across two calls', async () => {
		// The guard measures the sum of the readings, not the last one: 6 + 6 is past the 10 that shipped
		// even though neither call is.
		const fixture = dispatchedFixture({ requested: 10, shipped: 10 });
		fixture.tables.stock_transfer_line[0].receivedQuantity = 6;

		await expect(
			fixture.service.receive(fixture.transferId, [{ lineId: fixture.lineId, receivedQuantity: 6 }])
		).rejects.toMatchObject({
			response: { code: 'STOCK_TRANSFER_OVER_RECEIPT', details: { received: 12, shipped: 10 } }
		});
		expect(fixture.lines()[0].receivedQuantity).toBe(6);
	});

	it('refuses to ship more than a line requested', async () => {
		const { fixture, transfer, lineId } = await approvedTransfer(10);

		await expect(
			fixture.service.ship(transfer.id, [{ lineId, shippedQuantity: 11 }])
		).rejects.toMatchObject({
			response: {
				code: 'STOCK_TRANSFER_OVER_RECEIPT',
				details: { lineId, requested: 10, shipped: 11 }
			}
		});
		expect(fixture.lines()[0].shippedQuantity).toBe(0);
		expect(fixture.store.ledgerOf(SOURCE)).toEqual([]);
		expect(fixture.transfer()).toMatchObject({ status: StockTransferStatus.APPROVED });
	});

	it('leaves no half-state when a later line of one dispatch is refused', async () => {
		// A dispatch is one transaction. The first line would ship cleanly; the second would over-ship, so
		// the whole dispatch is refused — including the line that had already been written — and the source
		// keeps every unit.
		const fixture = transferFixture();
		const transfer = await fixture.service.createTransfer({
			fromWarehouseId: SOURCE,
			toWarehouseId: DESTINATION,
			lines: [
				{ variantId: VARIANT, requestedQuantity: 4 },
				{ variantId: OTHER_VARIANT, requestedQuantity: 3 }
			]
		});
		await fixture.service.request(transfer.id);
		await fixture.service.approve(transfer.id);
		const [first, second] = fixture.lines();

		await expect(
			fixture.service.ship(transfer.id, [
				{ lineId: first.id, shippedQuantity: 4 },
				{ lineId: second.id, shippedQuantity: 9 }
			])
		).rejects.toThrow();

		expect(fixture.lines().map((line) => line.shippedQuantity)).toEqual([0, 0]);
		expect(fixture.store.ledgerOf(SOURCE)).toEqual([]);
		expect(fixture.onHand(SOURCE)).toBe(100);
		expect(fixture.transfer()).toMatchObject({ status: StockTransferStatus.APPROVED });
	});

	it('refuses a dispatch that names a line of another transfer', async () => {
		const fixture = transferFixture();
		const transfers = [];

		for (let index = 0; index < 2; index++) {
			const transfer = await fixture.service.createTransfer({
				fromWarehouseId: SOURCE,
				toWarehouseId: DESTINATION,
				lines: [{ variantId: VARIANT, requestedQuantity: 4 }]
			});

			await fixture.service.request(transfer.id);
			await fixture.service.approve(transfer.id);
			transfers.push(transfer);
		}

		const [firstLine, secondLine] = fixture.lines();

		await expect(
			fixture.service.ship(transfers[0].id, [{ lineId: secondLine.id, shippedQuantity: 4 }])
		).rejects.toMatchObject({
			response: { code: 'STOCK_LEVEL_NOT_FOUND', details: { lineId: secondLine.id } }
		});
		expect(fixture.lines().map((line) => line.shippedQuantity)).toEqual([0, 0]);
		expect(fixture.store.ledgerOf(SOURCE)).toEqual([]);
		expect(firstLine.id).not.toBe(secondLine.id);
	});
});

describe('StockTransferService — cancelling a transfer (doc 09 §8.2)', () => {
	it('cancels a draft with a reason and writes nothing at all', async () => {
		const fixture = transferFixture();
		const transfer = await fixture.service.createTransfer({
			fromWarehouseId: SOURCE,
			toWarehouseId: DESTINATION,
			lines: [{ variantId: VARIANT, requestedQuantity: 10 }]
		});

		const cancelled = await fixture.service.cancel(transfer.id, 'No longer needed');

		expect(cancelled).toMatchObject({ status: StockTransferStatus.CANCELED, note: 'No longer needed' });
		expect(fixture.store.ledgerOf(SOURCE)).toEqual([]);
		expect(fixture.onHand(SOURCE)).toBe(100);
	});

	it('cancels a transfer in transit without un-shipping what already left', async () => {
		// Dispatched stock returns through a compensating transfer, never by rewriting the row (§8.2): the
		// cancellation stops the document, and the units that left the source stay recorded as having left.
		const fixture = dispatchedFixture({ requested: 10, shipped: 10 });
		const ledgerBefore = fixture.store.ledgerOf(SOURCE).length;

		const cancelled = await fixture.service.cancel(fixture.transferId, 'Goods lost in transit');

		expect(cancelled).toMatchObject({
			status: StockTransferStatus.CANCELED,
			note: 'Goods lost in transit'
		});
		// No half-state: the cancellation rewrote no ledger row, credited the source nothing back, and left
		// the line saying what was dispatched.
		expect(fixture.store.ledgerOf(SOURCE)).toHaveLength(ledgerBefore);
		expect(fixture.onHand(SOURCE)).toBe(100);
		expect(fixture.lines()[0]).toMatchObject({ shippedQuantity: 10, receivedQuantity: 0 });
		// The ten units are on the road: they are in neither location, and what the documents say about them
		// is the lines' remainder, which is the in-transit balance a reconciliation reads.
		expect(stillInTransit(fixture)).toBe(10);
		expect(fixture.store.totalOnHand()).toBe(140);
	});
});

describe('StockTransferLineService — the lines a dispatch and a receipt write', () => {
	it('adds a line to a draft transfer and merges a second line for the same variant into it', async () => {
		const fixture = transferFixture();
		const transfer = await fixture.service.createTransfer({
			fromWarehouseId: SOURCE,
			toWarehouseId: DESTINATION
		});
		const lineService = new StockTransferLineService(fixture.store.lineRepository as never, {} as never);

		const first = await lineService.addLine({
			transferId: transfer.id,
			variantId: VARIANT,
			requestedQuantity: 4
		});
		const merged = await lineService.addLine({
			transferId: transfer.id,
			variantId: VARIANT,
			requestedQuantity: 3
		});

		expect(merged.id).toBe(first.id);
		expect(merged.requestedQuantity).toBe(7);
		expect(fixture.lines()).toHaveLength(1);
		expect(merged).toMatchObject({ shippedQuantity: 0, receivedQuantity: 0, damagedQuantity: 0 });
	});

	it('refuses to add a line once the transfer has left draft', async () => {
		// Once a transfer is requested, the set of things being moved is what was approved.
		const { fixture, transfer } = await approvedTransfer(10);
		const lineService = new StockTransferLineService(fixture.store.lineRepository as never, {} as never);

		await expect(
			lineService.addLine({ transferId: transfer.id, variantId: OTHER_VARIANT, requestedQuantity: 1 })
		).rejects.toMatchObject({
			response: {
				code: 'STOCK_TRANSFER_ILLEGAL_TRANSITION',
				details: { transferId: transfer.id, status: StockTransferStatus.APPROVED }
			}
		});
		expect(fixture.lines()).toHaveLength(1);
	});
});





