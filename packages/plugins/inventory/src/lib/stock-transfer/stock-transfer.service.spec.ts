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
	const { NotFoundException, SetMetadata } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

	/**
	 * The kernel’s own entity-tag parser, read from its source rather than restated here.
	 *
	 * The controller reads `If-Match` with it, and the cases below are about the route following the
	 * kernel’s reading of a precondition rather than inventing a second one — so the parser is the real
	 * one. It is a file with no imports at all — neither NestJS nor an ORM — which is why it can be
	 * loaded beside the doubled barrel.
	 */
	const { parseIfMatch } = jest.requireActual('../../../../../core/src/lib/concurrency/version.util');

	/**
	 * The platform’s conditional write and its reader for the version a request accepted. The engine
	 * under test reaches both through the barrel being replaced here, so the shared double answers for
	 * both — the kernel’s own behaviour, decided rather than stubbed.
	 */
	const { commitVersionedUpdate, versionExpectationOf } = require('../testing/versioned-write.double');

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
		// The statement helpers are pure and dialect-driven; loading the real module here would pull
		// `@gauzy/config` and the request context into a suite that doubles the barrel on purpose.
		quoteIdentifier: (identifier: string) => `"${identifier}"`,
		prepareSQLQuery: (query: string) => query,
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
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		UUIDValidationPipe: class UUIDValidationPipe {},
		UseValidationPipe: decorator,
		// The two conventions the decorated routes carry. Both are decorator factories and nothing more:
		// the guard and the interceptor they attach are application providers, and a unit test that never
		// boots the application never runs them.
		Versioned: () => () => undefined,
		Idempotent: () => () => undefined,
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		parseIfMatch,
		BaseEvent: class {},
		EventBus: class {},
		Product: class Product {},
		ProductVariant: class ProductVariant {},
		Warehouse: class Warehouse {},
		WarehouseProduct: class WarehouseProduct {},
		WarehouseProductVariant: class WarehouseProductVariant {},
		User: class User {},
		Sequence: class Sequence {},
		// The kernel helpers the ledger engine imports beside the entities above. Both decide rather than
		// answer unconditionally, so a versioned write is refused here as it is refused in production.
		commitVersionedUpdate,
		versionExpectationOf,
		RequestContext: {
			// The engine reads the version the current request accepted from here, and a unit test has no
			// request: the accepted version is then absent, which is the case the engine's own
			// compare-and-set covers.
			currentRequest: () => null,
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
		isMySQL: () => false,
		isPostgres: () => false,
		isSqlite: () => true,
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

import { Product, ProductVariant, WarehouseProduct, WarehouseProductVariant } from '@gauzy/core';
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
import { StockTransferController } from './stock-transfer.controller';
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
 * It is a real (if tiny) transactional store, and the two transactions it hands out are deliberately
 * not the same thing. `manager.transaction` is the caller’s unit of work: a throw from inside it puts
 * the store back exactly as it was. `dataSource.transaction` is what a component asks for when it
 * opens a transaction of its own — and on a real connection that runs on a connection of its own, so
 * what it commits is durable and the caller’s rollback cannot take it back. The double models that
 * difference, because a one-store nested snapshot hides exactly the defect a caller needs to see: a
 * movement written inside its own transaction survives the document that wrote it.
 *
 * @param tables The whole datastore.
 */
function datastore(tables: Record<string, Row[]>) {
	const entityToTable = new Map<unknown, string>([
		[Product, 'product'],
		// The variant table is read through the repository rather than as raw SQL, so the double maps it.
		[ProductVariant, 'product_variant'],
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
	/**
	 * The transactions in flight, outermost first, and what each one has written.
	 *
	 * A transaction that commits while another is open committed on a connection of its own, so its
	 * writes are recorded here and re-applied after an outer rollback put the store back: they are not
	 * the outer transaction’s to undo.
	 */
	const frames: Array<{ writes: Array<{ table: string; id: string }> }> = [];
	const committedElsewhere: Array<{ table: string; id: string; row: Row }> = [];
	/** Records that the innermost open transaction wrote a row, so a commit can be told apart. */
	const recordWrite = (table: string | undefined, id: unknown) => {
		const frame = frames[frames.length - 1];

		if (!frame || !table || id === undefined || id === null) {
			return;
		}

		frame.writes.push({ table, id: String(id) });
	};
	const restore = (copy: Record<string, Row[]>) => {
		for (const [table, tableRows] of Object.entries(copy)) {
			tables[table] = tableRows;
		}
		// A commit another transaction made is not this one’s to roll back.
		for (const commit of committedElsewhere) {
			const table = tables[commit.table] ?? (tables[commit.table] = []);
			const index = table.findIndex((row) => same(row.id, commit.id));

			if (index >= 0) {
				table[index] = { ...commit.row };
				continue;
			}

			table.push({ ...commit.row });
		}
	};
	/**
	 * Runs one transaction.
	 *
	 * @param run The work the transaction holds.
	 * @param independent Whether this is a transaction the caller opened for itself — one that commits
	 * on a connection of its own and therefore survives an outer rollback.
	 */
	const transaction = async (run: (transactional: any) => Promise<any>, independent: boolean) => {
		const copy = snapshot();
		frames.push({ writes: [] });

		try {
			const result = await run(manager);
			const frame = frames.pop();

			if (independent && frames.length && frame) {
				for (const write of frame.writes) {
					const row = (tables[write.table] ?? []).find((candidate) => same(candidate.id, write.id));

					if (row) {
						committedElsewhere.push({ table: write.table, id: write.id, row: { ...row } });
					}
				}
			}

			return result;
		} catch (error) {
			frames.pop();
			restore(copy);
			throw error;
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
		/**
	 * Reads the delta out of the SQL the engine builds for its aggregate update.
	 *
	 * The engine binds its delta as a named parameter now (`"quantity" + :quantityDelta`, handed over
	 * through `setParameters`) and used to interpolate it as a literal; the double reads both spellings,
	 * so it pins neither. The parameters arrive from the caller because they live in the query builder's
	 * closure, not beside the in-memory tables.
	 */
	const deltaFrom = (value: unknown, boundParams: Row = {}): number => {
		const sql = typeof value === 'function' ? String((value as () => string)()) : String(value);
		const literal = /"\s*\+\s*(-?\d+(?:\.\d+)?)/.exec(sql);
		if (literal) {
			return Number(literal[1]);
		}

		const bound = /"\s*\+\s*:(\w+)/.exec(sql);
		if (bound) {
			return Number(boundParams[bound[1]]);
		}

		throw new Error(`the in-memory double cannot read a delta out of "${sql}"`);
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

			// The statement names its parameters in a call of their own, after the predicate that uses
			// them; `execute` reads one map, so they join the condition the predicate pushed.
			setParameters: (params: Row = {}) => {
				const last = conditions[conditions.length - 1];

				if (last) {
					last.params = { ...last.params, ...params };
				} else {
					conditions.push({ sql: '', params });
				}

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
					row[column] = typeof value === 'function' ? Number(row[column] ?? 0) + deltaFrom(value, conditions.reduce<Row>((all, one) => ({ ...all, ...one.params }), {})) : value;
				}
				recordWrite(entityToTable.get(target), row.id);

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
					recordWrite(entityToTable.get(entity), row.id);
					continue;
				}

				if (!row.id) {
					row.id = `${String(entityToTable.get(entity))}-${++sequence}`;
				}

				table.push(row);
				recordWrite(entityToTable.get(entity), row.id);
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
		/**
		 * The raw statements the engine issues: the lock timeout, the row lock, and the read of a
		 * variant’s own product — which is what a movement that names no product resolves a first-time
		 * level from. Anything else is a statement this double does not model, and it says so instead of
		 * answering.
		 */
		query: async (sql: string, params: any[] = []) => {
			if (/SET LOCAL lock_timeout|SET SESSION innodb_lock_wait_timeout|FOR UPDATE/.test(sql)) {
				return [];
			}
			if (/FROM "product_variant"/.test(sql)) {
				const variant = tables.product_variant.find((row) => same(row.id, params[0]));

				return variant ? [{ productId: variant.productId }] : [];
			}

			throw new Error(`the in-memory double does not implement the statement "${sql}"`);
		}
	};

	/**
	 * The two transactions this connection hands out, and they are not the same thing.
	 *
	 * The manager’s is the caller’s unit of work: the callback sees the same datastore, and a throw from
	 * anywhere inside it puts the datastore back exactly as it was, which is what makes "no half-state"
	 * a claim about the store rather than about the call log. The data source’s is a transaction a
	 * component opens for itself, and on a real connection that is a second connection: what it commits
	 * is durable, and the caller’s rollback cannot undo it.
	 */
	manager.transaction = async (run: (transactional: any) => Promise<any>) => await transaction(run, false);

	const dataSource: any = {
		manager,
		createQueryBuilder,
		transaction: async (run: (transactional: any) => Promise<any>) => await transaction(run, true)
	};
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
 * @param options.seedDestination Whether the variant has ever been stocked at the destination at all,
 * so the receipt that opens a level there for the first time is reachable.
 */
function transferFixture(options: { source?: number; destination?: number; seedDestination?: boolean } = {}) {
	const tables: Record<string, Row[]> = {
		product: [{ id: PRODUCT, tenantId: TENANT, organizationId: ORG }],
		// Where a variant says which product it belongs to: the answer a movement that names no product
		// resolves a first-time level from.
		product_variant: [
			{ id: VARIANT, productId: PRODUCT },
			{ id: OTHER_VARIANT, productId: PRODUCT }
		],
		warehouse_product: [],
		warehouse_product_variant: [],
		stock_movement: [],
		stock_transfer: [],
		stock_transfer_line: []
	};

	for (const [index, warehouseId] of [SOURCE, DESTINATION].entries()) {
		if (index === 1 && options.seedDestination === false) {
			continue;
		}

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

	const controller = new StockTransferController(service);

	return {
		service,
		controller,
		store,
		tables,
		allocated,
		transfer: (id: string = 'stock_transfer-1') => tables.stock_transfer.find((row) => row.id === id),
		lines: () => tables.stock_transfer_line,
		aggregateAt: (warehouseId: string) => tables.warehouse_product.find((row) => row.warehouseId === warehouseId),
		levelAt: (warehouseId: string) => {
			const aggregate = tables.warehouse_product.find((row) => row.warehouseId === warehouseId);

			return tables.warehouse_product_variant.find((row) => row.warehouseProductId === aggregate?.id);
		},
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
	// §15.3 names the `If-Match` conflict among the unit cases this service owes. The transition is
	// written under the version it was read at, so a caller working from a stale copy of the document
	// is refused rather than accepted (`stock-transfer.service.ts`, `commitTransition`).
	it('refuses a transition that states a version the document has moved past', async () => {
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
 * The version guard on the CRUD `update` route.
 *
 * Doc 09 §8.5 states the service contract as `update(id, input, expectedVersion)`, and §8.2 states that
 * *every* transition takes `If-Match: "<version>"` and bumps the version. An edit of a transfer’s own
 * fields is a write on the same versioned document as a transition, so it takes the same precondition:
 * the edit is written under the version it was read at, and a caller working from a copy the document
 * has moved past is refused with the transition’s own conflict code rather than silently erasing the
 * edit it never saw. The controller reads the header with the kernel’s own entity-tag parser — the one
 * the transitions already use — so the resource has one reading of a precondition rather than two.
 *
 * The controller is what these cases drive, because the header *is* the interface: the version arrives
 * as a request precondition, and a service-level test would not show whether the route reads it.
 */
describe('StockTransferController — the version guard on the update route (doc 09 §8.5)', () => {
	it('refuses an edit that states a version the document has moved past', async () => {
		const { fixture, transfer } = await approvedTransfer();
		const current = fixture.transfer(transfer.id).version;
		const before = { ...fixture.transfer(transfer.id) };

		await expect(
			fixture.controller.update(transfer.id, { note: 'Written from a stale copy' } as never, `"${current - 1}"`)
		).rejects.toMatchObject({
			response: {
				code: 'STOCK_TRANSFER_VERSION_CONFLICT',
				details: { transferId: transfer.id, actualVersion: current, expectedVersion: current - 1 }
			}
		});
		// The refusal is an edit that did not happen: the document is exactly as it was.
		expect(fixture.transfer(transfer.id)).toEqual(before);
	});

	it('accepts an edit that states the version the document holds, and moves the document on', async () => {
		const { fixture, transfer } = await approvedTransfer();
		const current = fixture.transfer(transfer.id).version;

		const updated = await fixture.controller.update(
			transfer.id,
			{ note: 'Rebalanced at the dock' } as never,
			`"${current}"`
		);

		expect(updated).toMatchObject({
			id: transfer.id,
			note: 'Rebalanced at the dock',
			status: StockTransferStatus.APPROVED,
			version: current + 1
		});
		expect(fixture.transfer(transfer.id)).toMatchObject({ note: 'Rebalanced at the dock', version: current + 1 });
		// An edit moves no stock: it is the document that changed, not what is at either location.
		expect(fixture.store.ledgerOf(SOURCE)).toEqual([]);
		expect(fixture.store.totalOnHand()).toBe(140);
	});

	it('treats a request that states no precondition as a request that states none', async () => {
		const { fixture, transfer } = await approvedTransfer();
		const current = fixture.transfer(transfer.id).version;

		const withoutHeader = await fixture.controller.update(transfer.id, { note: 'No header' } as never);

		expect(withoutHeader).toMatchObject({ note: 'No header', version: current + 1 });

		// `*` states that the document must exist and accepts whatever version it holds, which is the same
		// unconditional edit written the explicit way.
		const wildcard = await fixture.controller.update(transfer.id, { note: 'A wildcard' } as never, '*');

		expect(wildcard).toMatchObject({ note: 'A wildcard', version: current + 2 });
	});

	it('refuses a header it cannot read as one version rather than ignoring it', async () => {
		// A precondition that quietly degrades into an unconditional write is the failure the header
		// exists to prevent, so a header that is not a version is refused before anything is written.
		const { fixture, transfer } = await approvedTransfer();
		const before = { ...fixture.transfer(transfer.id) };

		await expect(
			fixture.controller.update(transfer.id, { note: 'Malformed' } as never, 'the-version-i-read')
		).rejects.toMatchObject({ response: { statusCode: 400 } });
		await expect(
			fixture.controller.update(transfer.id, { note: 'Two of them' } as never, '"1", "2"')
		).rejects.toMatchObject({ response: { statusCode: 400 } });
		expect(fixture.transfer(transfer.id)).toEqual(before);
	});
});

/**
 * The ledger effect of a dispatch and a receipt.
 *
 * A dispatch and a receipt name the variant and the location they move stock at, and nothing else:
 * the level row standing at `(location, variant)` is what the movement is recorded against, and its
 * own product is the product the movement belongs to. That is the first of the two ways doc 09 §4.1
 * step 1 states a level row is addressed, and it is the one a transfer uses — a transfer moves what
 * is at a location, and the document never has to name the product to say so.
 */
describe('StockTransferService — shipping and receiving (doc 09 §8.3, INV-13, INV-19)', () => {
	it('moves the dispatched quantity out of the source, and leaves the total across locations unchanged', async () => {
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

	it('records a partial receipt on the line and completes it on the next one', async () => {
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

	it('records the units that arrived damaged on the line, losing exactly those from the total', async () => {
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
	it('cancels a draft with a reason, beside the operator’s own note rather than over it', async () => {
		const fixture = transferFixture();
		const transfer = await fixture.service.createTransfer({
			fromWarehouseId: SOURCE,
			toWarehouseId: DESTINATION,
			note: 'Rebalancing the winter stock',
			lines: [{ variantId: VARIANT, requestedQuantity: 10 }]
		});

		const cancelled = await fixture.service.cancel(transfer.id, 'No longer needed');

		// The reason used to be patched onto `note`, which is the operator's own free text from
		// `createTransfer` — so the document's explanation of why it exists was replaced by the
		// explanation of why it was stopped, and the first was simply gone. Both are kept now.
		expect(cancelled).toMatchObject({
			status: StockTransferStatus.CANCELED,
			note: 'Rebalancing the winter stock',
			metadata: { cancelReason: 'No longer needed' }
		});
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
			metadata: { cancelReason: 'Goods lost in transit' }
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

/**
 * The receipt that opens a level at a location which has never stocked the variant.
 *
 * A transfer moves what is at a location, so the document names the variant and the two locations and
 * never a product. For the receipt into a location that has never stocked the variant there is no level
 * row to take the product from, and the product-level aggregate the new level hangs from has to be
 * created — with the variant’s own product, which the variant table states. The alternative is a
 * receipt refused for a product id the caller had no way to know, which is what this case pins against:
 * the level is created with the variant’s product, and the ledger sum still equals the level quantity.
 */
describe('StockTransferService — receiving into a location that has never stocked the variant (INV-01)', () => {
	it('creates the destination level from the variant’s own product and keeps the ledger in agreement', async () => {
		const fixture = transferFixture({ seedDestination: false });
		const transfer = await fixture.service.createTransfer({
			fromWarehouseId: SOURCE,
			toWarehouseId: DESTINATION,
			lines: [{ variantId: VARIANT, requestedQuantity: 6 }]
		});
		await fixture.service.request(transfer.id);
		await fixture.service.approve(transfer.id);
		const lineId = fixture.lines()[0].id;

		await fixture.service.ship(transfer.id, [{ lineId, shippedQuantity: 6 }]);

		// Nothing has ever been stocked at the destination: no aggregate, no level.
		expect(fixture.aggregateAt(DESTINATION)).toBeUndefined();
		expect(fixture.levelAt(DESTINATION)).toBeUndefined();

		await fixture.service.receive(transfer.id, [{ lineId, receivedQuantity: 6 }]);

		const aggregate = fixture.aggregateAt(DESTINATION);
		const level = fixture.levelAt(DESTINATION);

		expect(aggregate).toMatchObject({ warehouseId: DESTINATION, productId: PRODUCT, quantity: 6 });
		expect(level).toMatchObject({ variantId: VARIANT, quantity: 6, reservedQuantity: 0, version: 2 });
		// The movement is recorded against the level and the product it resolved to, so a ledger read
		// needs no second lookup to know whose stock it moved.
		expect(fixture.store.ledgerOf(DESTINATION)).toHaveLength(1);
		expect(fixture.store.ledgerOf(DESTINATION)[0]).toMatchObject({
			type: StockMovementType.TRANSFER_IN,
			quantity: 6,
			quantityBefore: 0,
			quantityAfter: 6,
			warehouseId: DESTINATION,
			variantId: VARIANT,
			warehouseProductId: aggregate.id,
			warehouseProductVariantId: level.id,
			referenceId: lineId
		});
		// INV-01, on the level that was created by this very receipt: the level is the sum of its ledger.
		expect(fixture.store.ledgerOf(DESTINATION).reduce((sum, row) => sum + Number(row.quantity), 0)).toBe(
			Number(level.quantity)
		);
		expect(fixture.transfer(transfer.id)).toMatchObject({ status: StockTransferStatus.RECEIVED });
	});

	it('keeps the receipt one write when the level it opens is refused', async () => {
		// Control for the case above: the level is created inside the receipt’s transaction, so a receipt
		// the destination refuses leaves no level, no aggregate and no movement behind.
		const fixture = transferFixture({ seedDestination: false });
		const transfer = await fixture.service.createTransfer({
			fromWarehouseId: SOURCE,
			toWarehouseId: DESTINATION,
			lines: [{ variantId: VARIANT, requestedQuantity: 6 }]
		});
		await fixture.service.request(transfer.id);
		await fixture.service.approve(transfer.id);
		const lineId = fixture.lines()[0].id;

		await fixture.service.ship(transfer.id, [{ lineId, shippedQuantity: 6 }]);

		await expect(
			fixture.service.receive(transfer.id, [{ lineId, receivedQuantity: 7 }])
		).rejects.toMatchObject({ response: { code: 'STOCK_TRANSFER_OVER_RECEIPT' } });

		expect(fixture.aggregateAt(DESTINATION)).toBeUndefined();
		expect(fixture.levelAt(DESTINATION)).toBeUndefined();
		expect(fixture.store.ledgerOf(DESTINATION)).toEqual([]);
		expect(fixture.lines()[0]).toMatchObject({ receivedQuantity: 0, damagedQuantity: 0 });
	});
});

/**
 * The engine’s transaction is the caller’s transaction.
 *
 * A receipt writes its inbound movement beside its own line and status, and the two are one write or
 * neither: the movement joins the transaction the receipt is already inside. The failure this pins is
 * the one a shared store hides — an engine that opened a transaction of its own would commit the
 * movement on a second connection, and the receipt’s rollback would leave a level and a ledger row that
 * no document explains. The control below shows that this fixture can see exactly that difference.
 */
describe('StockTransferService — the movement engine joins its caller’s transaction (doc 09 §4.1)', () => {
	/** A transfer already dispatched, with two lines on the road: the state a receipt starts from. */
	function inTransitFixture() {
		const fixture = transferFixture();

		fixture.tables.stock_transfer.push({
			id: 'transfer-two-lines',
			number: 'TRF-000010',
			tenantId: TENANT,
			organizationId: ORG,
			fromWarehouseId: SOURCE,
			toWarehouseId: DESTINATION,
			status: StockTransferStatus.IN_TRANSIT,
			version: 4,
			shippedAt: new Date('2026-01-15T10:00:00.000Z')
		});
		for (const [id, variantId] of [
			['line-a', VARIANT],
			['line-b', OTHER_VARIANT]
		] as const) {
			fixture.tables.stock_transfer_line.push({
				id,
				tenantId: TENANT,
				organizationId: ORG,
				transferId: 'transfer-two-lines',
				variantId,
				requestedQuantity: 10,
				shippedQuantity: 10,
				receivedQuantity: 0,
				damagedQuantity: 0
			});
		}

		return fixture;
	}

	it('takes a receipt’s inbound movement back with the receipt that failed after it', async () => {
		const fixture = inTransitFixture();

		await expect(
			fixture.service.receive('transfer-two-lines', [
				{ lineId: 'line-a', receivedQuantity: 5 },
				{ lineId: 'line-b', receivedQuantity: 11 }
			])
		).rejects.toMatchObject({ response: { code: 'STOCK_TRANSFER_OVER_RECEIPT' } });

		// The first line’s movement was written before the second was refused, and it is gone with the
		// receipt: the destination holds what it held, the ledger has no row for an arrival that did not
		// happen, and the line says nothing arrived.
		expect(fixture.onHand(DESTINATION)).toBe(40);
		expect(fixture.store.ledgerOf(DESTINATION)).toEqual([]);
		expect(fixture.lines().map((line) => line.receivedQuantity)).toEqual([0, 0]);
		expect(fixture.transfer('transfer-two-lines')).toMatchObject({
			status: StockTransferStatus.IN_TRANSIT,
			version: 4
		});
	});

	it('CONTROL: this fixture can see a movement an engine’s own transaction committed', async () => {
		// The same store, the same failure, and the movement written by an engine asked for a transaction
		// of its own: on a real connection that transaction has a connection of its own, so its commit is
		// durable and the caller’s rollback cannot reach it. This is the divergence the case above is
		// about — the fixture reports it, which is what makes that case a claim rather than a coincidence.
		const fixture = inTransitFixture();
		const engine = new StockLevelService(fixture.store.dataSource as never);

		await expect(
			fixture.store.manager.transaction(async () => {
				await engine.applyMovement({
					warehouseId: DESTINATION,
					variantId: VARIANT,
					type: StockMovementType.TRANSFER_IN,
					quantityDelta: 5,
					reservedDelta: 0,
					referenceType: StockMovementReferenceType.TRANSFER,
					referenceId: 'line-a',
					reason: 'CONTROL'
				} as never);
				throw new Error('the caller’s transaction failed after the movement was written');
			})
		).rejects.toThrow();

		expect(fixture.onHand(DESTINATION)).toBe(45);
		expect(fixture.store.ledgerOf(DESTINATION)).toHaveLength(1);
	});
});





