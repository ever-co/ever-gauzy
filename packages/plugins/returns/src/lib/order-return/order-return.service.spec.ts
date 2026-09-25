/**
 * Which ORM the platform's CRUD base reads and writes through, configured per case.
 *
 * The base-class double below answers from the repository of that ORM, as the platform's own does, so a case
 * that runs on MikroORM can tell a read the platform made from one the service made through the TypeORM
 * repository behind its back.
 */
const mockOrm = { type: 'typeorm' };

/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a return service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the catalogue and inventory packages' service specs do, and **the services under test
 * are the real ones**: the return service and the line service it delegates the ceiling to, with the
 * real quantity helpers, the real entity classes and the real money layer.
 *
 * Only the base CRUD class, the request context, the numbering series and the entity base classes are
 * substituted. The platform's `Money` is the real one, because the amounts this suite asserts are the
 * amounts a customer is paid and a double would make the rounding cases say nothing.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	// The kernel's conditional write is the real one. The subject of the optimistic-concurrency cases
	// below is what `commitVersionedUpdate` does with a version that moved on, and a re-implementation
	// here would assert the double rather than the platform.
	const versionedWrite = jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return mockOrm.type;
		}

		/** The repository of the configured ORM, which is the one the platform's CRUD base reads through. */
		protected get store(): any {
			return mockOrm.type === 'mikro-orm' ? this.mikroOrmRepository : this.typeOrmRepository;
		}

		async findAll(options: any = {}): Promise<any> {
			const [items, total] = await this.store.findAndCount(options);

			return { items, total };
		}

		async find(options: any = {}): Promise<any> {
			return this.store.find(options);
		}

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.store.findAndCount(options);

			return { items, total };
		}

		async findOneByIdString(id: any, options: any = {}): Promise<any> {
			if (!id) {
				throw new NotFoundException('The requested record was not found');
			}

			const record = await this.store.findOne({
				...options,
				where: { ...(options.where ?? {}), id }
			});

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async findOneByWhereOptions(where: any): Promise<any> {
			const record = await this.store.findOneBy(where);

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async create(entity: any): Promise<any> {
			return this.store.save(this.store.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			return this.store.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.store.delete(criteria);
		}

		async softDelete(criteria: any): Promise<any> {
			return this.store.softDelete(criteria);
		}

		// The platform's soft-delete pair: the row is resolved through the tenant-aware read, then retired or
		// restored. Neither knows anything about a return, which is the point of the cases that drive them.
		async softRemove(id: any): Promise<any> {
			const entity = await this.findOneByIdString(id);

			await this.store.softDelete({ id: entity.id });

			return { ...entity, deletedAt: new Date() };
		}

		async softRecover(id: any): Promise<any> {
			const entity = await this.findOneByIdString(id, { withDeleted: true });

			await this.store.restore({ id: entity.id });

			return { ...entity, deletedAt: null };
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
		VersionedColumn: decorator,
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
		// The kernel's own conditional write, so a conflict is the platform's conflict rather than this
		// suite's.
		commitVersionedUpdate: versionedWrite.commitVersionedUpdate,
		versionExpectationOf: versionedWrite.versionExpectationOf,
		// Added when the retirement of a live return grew its own refusal: a removal whose predicated statement
		// matched no row is the platform's conflict, raised with the platform's class and code.
		ApiException: jest.requireActual('@gauzy/core/src/lib/core/errors/api-exception').ApiException,
		ApiErrorCode: jest.requireActual('@gauzy/core/src/lib/core/errors/api-error-codes').ApiErrorCode,
		MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		// Added when the receipt grew its order-line counter move: the line service now subtracts two
		// exact decimals to state the delta, and a double that omits the helper makes the code under
		// test call nothing — which fails the suite for a reason that is not its own.
		subtractDecimalStrings: jest.requireActual('@gauzy/core/src/lib/money/decimal').subtractDecimalStrings,
		SequenceService: class SequenceService {},
		EventOutboxService: class EventOutboxService {},
		TenantSettingService: class TenantSettingService {},
		Warehouse: class Warehouse {},
		Product: class Product {},
		ProductVariant: class ProductVariant {},
		ProductVariantPrice: class ProductVariantPrice {},
		Organization: class Organization {},
		OrganizationVendor: class OrganizationVendor {},
		OrganizationContact: class OrganizationContact {},
		User: class User {},
		Tag: class Tag {},
		ImageAsset: class ImageAsset {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { OrderReturnStatus, RETURNS_TOTALS_REASON, StockMovementKind } from '../returns.types';
import { OrderReturnLineService } from '../order-return-line/order-return-line.service';
import { OrderReturnService } from './order-return.service';

/**
 * Goods coming back: the authorisation, the receipt, and the money that follows it.
 *
 * The specification fixes a lifecycle with a consequence outside this table behind every edge
 * (doc 10 §11.1), an ordered receipt whose later steps depend on the earlier ones (doc 10 §11.6), and
 * two invariants this suite is built around:
 *
 * - **the ceiling comes first.** A request is measured against what was fulfilled before the header
 *   exists, so a return nobody may make leaves no row and consumes no return number
 *   (doc 10 §11.5 steps 1–2);
 * - **a receipt conserves quantity.** What arrived plus what is still outstanding is what was asked
 *   for, and each arriving unit writes exactly one stock movement whose kind follows what happened to
 *   it — a sound restocked unit is a `RETURN`, a sound unit that is not restocked is a `WRITE_OFF`
 *   and never enters sellable stock, and a broken one is a `DAMAGE` (doc 10 §11.3);
 * - **money follows goods and never precedes them.** The status is written before the ledger and the
 *   refund is issued after both, so a refund is never paid for goods the ledger refused
 *   (doc 10 §11.6 step 5);
 * - **the state machine refuses what it does not admit.** Approving a return whose goods are already
 *   in, cancelling one whose goods have arrived, or closing one that has received nothing are all
 *   refusals that leave the row exactly as it was (doc 10 §11.1);
 * - **every write of the header is conditional on the version its caller read.** The counter moves on
 *   with the write that checked it, a version that moved on between the caller's read and its write is
 *   refused with `ENTITY_VERSION_CONFLICT` and nothing applied, and a write the platform makes on its
 *   own behalf — a receipt compensating itself, or the second write of one request — is still
 *   predicated on the version the row holds.
 *
 * The service is constructed directly over in-memory tables. The repository double states the `where`
 * the services state — equality, `In` and the nested `Not(In(...))` the live-return read builds —
 * because a double that returned every row regardless would make the aggregate and scope cases
 * vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const ORDER = '00000000-0000-4000-8000-000000000010';
const ORDER_LINE = '00000000-0000-4000-8000-000000000020';
const SECOND_ORDER_LINE = '00000000-0000-4000-8000-000000000021';
const VARIANT = '00000000-0000-4000-8000-000000000030';
const SECOND_VARIANT = '00000000-0000-4000-8000-000000000031';
const WAREHOUSE = '00000000-0000-4000-8000-000000000040';
const OTHER_WAREHOUSE = '00000000-0000-4000-8000-000000000041';

type Row = Record<string, any>;

/** The tables this suite drives, as plain arrays. */
interface ITables {
	order_return: Row[];
	order_return_line: Row[];
}

/**
 * The in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository writes.
 */
function repository(tables: ITables, tableName: keyof ITables) {
	let sequence = 0;
	const rows = () => tables[tableName].filter((row) => !row.deletedAt);
	/** The rows a read answers: the live ones, and the retired ones too when it states `withDeleted`. */
	const readable = (options: any = {}) => (options?.withDeleted ? tables[tableName] : rows());
	/** What every `update` was asked to write, and the criteria it was asked to write it under. */
	const updates: Array<{ criteria: Row; partial: Row }> = [];
	/** Every read this repository answered, so a case can tell which ORM's repository a service read through. */
	const reads: any[] = [];
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	/** Every operator the services actually build, and nothing else: an unknown one throws. */
	const matchesOperator = (value: unknown, operator: FindOperator<any>): boolean => {
		switch (operator.type) {
			case 'in':
				return (operator.value ?? []).some((candidate: unknown) => matchesValue(value, candidate));
			case 'not':
				// TypeORM's `value` accessor unwraps a nested operator, so `Not(In(...))` arrives here as
				// the raw array: the double reads it the way the ORM does.
				return Array.isArray(operator.value)
					? !operator.value.some((candidate: unknown) => same(value, candidate))
					: !same(value, operator.value);
			default:
				throw new Error(`the in-memory double does not implement the "${operator.type}" operator`);
		}
	};
	const matchesValue = (value: unknown, expected: unknown): boolean => {
		if (expected instanceof FindOperator) {
			return matchesOperator(value, expected);
		}

		// MikroORM's own spelling of a membership test, which a read through its entity manager states.
		if (expected && typeof expected === 'object' && '$in' in (expected as Row)) {
			return ((expected as Row)['$in'] as unknown[]).some((candidate) => same(value, candidate));
		}

		// A missing column and a null column are the same thing to the database, and TypeORM drops an
		// `undefined` member from the condition rather than matching nothing.
		if (expected === undefined) {
			return true;
		}

		return same(value, expected);
	};
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where ?? {}).every(([field, expected]) => matchesValue(row[field], expected));
	/** The table an entity class names, for a read through MikroORM's entity manager. */
	const tableOf = (entity: { name?: string }): keyof ITables =>
		entity?.name === 'OrderReturnLine' ? 'order_return_line' : 'order_return';

	return {
		rows,
		updates,
		reads,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => {
			reads.push(options);

			return readable(options).filter((row) => matches(row, options.where));
		},
		findOne: async (options: any = {}) => {
			reads.push(options);

			return readable(options).find((row) => matches(row, options.where)) ?? null;
		},
		// MikroORM's entity manager, which reads the table an entity class names, with the soft-delete filter on.
		getEntityManager: () => ({
			find: async (entity: { name?: string }, where: Row = {}) => {
				reads.push({ entity: entity?.name, where });

				return tables[tableOf(entity)].filter((row) => !row.deletedAt && matches(row, where));
			},
			findOne: async (entity: { name?: string }, where: Row = {}) => {
				reads.push({ entity: entity?.name, where });

				return tables[tableOf(entity)].find((row) => !row.deletedAt && matches(row, where)) ?? null;
			}
		}),
		findOneBy: async (where: any) => rows().find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async (options: any = {}) => rows().filter((row) => matches(row, options.where)).length,
		create: (partial: any) => ({
			// The platform's own `create` stamps the tenant the request carries onto the row it writes —
			// `TenantAwareCrudService.create` reads `RequestContext.currentTenantId()` — and every read below
			// filters by it. A double that did not would make "write a line and read it straight back"
			// impossible, which is what a set rewrite does.
			...(partial.tenantId === undefined ? { tenantId: RequestContext.currentTenantId() } : {}),
			...(partial.organizationId === undefined ? { organizationId: RequestContext.currentOrganizationId() } : {}),
			...partial
		}),
		save: async (rowOrRows: any) => {
			const list = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];

			for (const entity of list) {
				if (entity.id) {
					const index = tables[tableName].findIndex((row) => same(row.id, entity.id));

					if (index >= 0) {
						tables[tableName][index] = { ...tables[tableName][index], ...entity };
						continue;
					}
				}

				entity.id = `${String(tableName)}-new-${++sequence}`;

				// The column's own default, which the database applies and an in-memory table does not.
				// `@VersionedColumn()` declares `DEFAULT 1`, so a freshly inserted header is at version
				// one — and without that here, the first conditional write found a row carrying no
				// version at all, took the platform's unversioned-row path and landed the return back on
				// one. The suite then read a version that never moved and could not have caught a write
				// that failed to move it.
				if (tableName === 'order_return' && entity.version === undefined) {
					entity.version = 1;
				}

				tables[tableName].push(entity);
			}

			return Array.isArray(rowOrRows) ? list : list[0];
		},
		// The platform's `update` reaches TypeORM's own, which answers an `UpdateResult` and not the row.
		// `TenantAwareCrudService.update` merges the caller's scoped conditions into the criteria the
		// statement runs with and resolves a criteria that does not name a `version` through a read,
		// which raises when nothing matches. **A criteria that does name one skips that read**, because
		// the column is a precondition the `UPDATE` evaluates rather than a locator — so a version that
		// moved on reaches the affected-row count, which is where the conflict is read from. Both
		// branches are mirrored here: a double that pre-read every criteria would answer a stale version
		// with a not-found, and the cases below would assert the double instead of the platform.
		update: async (criteria: any, partial: any) => {
			const where = typeof criteria === 'string' ? { id: criteria } : (criteria ?? {});
			// The platform reads first only for a criteria that does not name a version.
			const readsFirst = typeof criteria === 'string' || !('version' in where);

			if (readsFirst && !rows().some((row) => matches(row, where))) {
				throw new NotFoundException('The requested record was not found');
			}

			const matching = rows().filter((row) => matches(row, where));

			updates.push({ criteria: where, partial });

			for (const row of matching) {
				Object.assign(row, partial);
			}

			return { affected: matching.length };
		},
		softDelete: async (criteria: any) => {
			const matching = tables[tableName].filter((row) => matches(row, criteria));

			for (const row of matching) {
				row.deletedAt = new Date();
			}

			return { affected: matching.length };
		},
		restore: async (criteria: any) => {
			const matching = tables[tableName].filter((row) => matches(row, criteria));

			for (const row of matching) {
				row.deletedAt = null;
			}

			return { affected: matching.length };
		},
		// A `DELETE` is predicated on every member of its criteria, as the statement is; a missing row, or one
		// that no longer matches, is an answer of nothing affected rather than an error.
		delete: async (criteria: any) => {
			const where = typeof criteria === 'string' ? { id: criteria } : (criteria ?? {});
			const matching = tables[tableName].filter((row) => matches(row, where));

			for (const row of matching) {
				tables[tableName].splice(tables[tableName].indexOf(row), 1);
			}

			return { affected: matching.length };
		}
	};
}

/** One `order_return` row, as the service reads it. */
const returnRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: ORDER,
	number: `RET-${id}`,
	status: OrderReturnStatus.OPEN,
	currency: 'USD',
	noNotification: false,
	warehouseId: WAREHOUSE,
	// Every row carries the version its writes are predicated on, as the entity's own column does.
	version: 1,
	...overrides
});

/** One `order_return_line` row, as the service reads it. */
const lineRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	returnId: 'return-1',
	orderLineId: ORDER_LINE,
	quantity: '5.000000',
	receivedQuantity: '0',
	damagedQuantity: '0',
	restock: true,
	createdAt: `2026-01-01T00:00:0${id.length % 10}.000Z`,
	...overrides
});

/** What one incoming movement looked like, as the ledger saw it. */
interface IMovement {
	warehouseId: string;
	variantId: string;
	quantity: string;
	kind: StockMovementKind;
	/** Whether the movement was stated as an event about units that never entered the level. */
	eventOnly?: boolean;
	referenceType: string;
	referenceId: string;
	reason: string;
}

/**
 * Builds the return service — and the real line service it delegates to — over one in-memory store.
 *
 * @param options.returns The returns the fixture starts with.
 * @param options.lines The return lines the fixture starts with.
 * @param options.fulfilled What the order domain reports as fulfilled.
 * @param options.withFulfillment Whether the order capability is registered.
 * @param options.withLedger Whether the inventory capability is registered.
 * @param options.withRefund Whether the payment capability is registered.
 * @param options.withShipping Whether the shipping capability is registered.
 * @param options.withTotals Whether the order capability that recomputes the order's derived columns is
 * registered.
 * @param options.numberSeries Whether the organization has a `RETURN` series.
 * @param options.receiptRefused Whether the order refuses every move of its received-return counter.
 * @param options.ledgerFailsOn Which ledger requests the ledger refuses, when some are to be refused.
 * @param options.beforeRequestMove A hook run inside the order's requested-counter move, before it lands,
 * which is where a case puts a concurrent writer.
 * @param options.beforeReceiptMove The same hook inside the order's received-counter move.
 * @param options.orm The ORM the platform's CRUD base is configured with. Under MikroORM the services are
 * handed a second set of repositories over the same tables, as the module hands them one of each ORM.
 */
function returnFixture(
	options: {
		orm?: 'typeorm' | 'mikro-orm';
		returns?: Row[];
		lines?: Row[];
		fulfilled?: Array<{ orderLineId: string; fulfilledQuantity: string; variantId?: string; unitPrice?: string }>;
		withFulfillment?: boolean;
		withLedger?: boolean;
		withRefund?: boolean;
		withShipping?: boolean;
		withTotals?: boolean;
		totalsFail?: boolean;
		numberSeries?: boolean;
		receiptRefused?: boolean;
		ledgerFailsOn?: (request: IMovement) => boolean;
		beforeRequestMove?: (moves: Array<{ orderLineId: string; quantityDelta: string }>, tables: ITables) => void;
		beforeReceiptMove?: (moves: Array<{ orderLineId: string; quantityDelta: string }>, tables: ITables) => void;
	} = {}
) {
	const tables: ITables = {
		order_return: [...(options.returns ?? [returnRow('return-1')])],
		order_return_line: [...(options.lines ?? [lineRow('line-1')])]
	};
	const typeOrmOrderReturnRepository = repository(tables, 'order_return');
	const typeOrmOrderReturnLineRepository = repository(tables, 'order_return_line');
	const mikroOrmOrderReturnRepository = repository(tables, 'order_return');
	const mikroOrmOrderReturnLineRepository = repository(tables, 'order_return_line');

	mockOrm.type = options.orm ?? 'typeorm';

	const fulfilled = options.fulfilled ?? [
		{
			orderLineId: ORDER_LINE,
			fulfilledQuantity: '5.000000',
			variantId: VARIANT,
			unitPrice: '10.00'
		},
		{
			orderLineId: SECOND_ORDER_LINE,
			fulfilledQuantity: '5.000000',
			variantId: SECOND_VARIANT,
			unitPrice: '10.00'
		}
	];
	/** Every move of the order's received-return counter this package asked the order capability for. */
	const recordedReceipts: Array<{ orderId: string; moves: Array<{ orderLineId: string; quantityDelta: string }> }> =
		[];
	/**
	 * Every move of the order's requested-return counter the order accepted.
	 *
	 * Recorded only once accepted, like the receipts above: the port is all or nothing, so a refused call
	 * moved nothing and is not something a compensation may undo.
	 */
	const recordedRequests: Array<{ orderId: string; moves: Array<{ orderLineId: string; quantityDelta: string }> }> =
		[];
	const fulfillment =
		options.withFulfillment === false
			? undefined
			: {
					getFulfilledLines: async () => fulfilled,
					recordReturnReceipt: async (orderId: string, moves: Array<{ orderLineId: string; quantityDelta: string }>) => {
						if (options.receiptRefused === true) {
							throw new BadRequestException('ORDER_LINE_RECEIPT_BELOW_ZERO: the order refused the move.');
						}

						options.beforeReceiptMove?.(moves, tables);
						recordedReceipts.push({ orderId, moves });
					},
					recordReturnRequest: async (orderId: string, moves: Array<{ orderLineId: string; quantityDelta: string }>) => {
						options.beforeRequestMove?.(moves, tables);
						recordedRequests.push({ orderId, moves });
					}
			  };
	const lineService = new OrderReturnLineService(
		typeOrmOrderReturnLineRepository as never,
		mikroOrmOrderReturnLineRepository as never,
		typeOrmOrderReturnRepository as never,
		fulfillment as never
	);
	const sequenceCalls: string[] = [];
	const sequenceService = {
		allocate: async (key: string) => {
			sequenceCalls.push(key);

			if (options.numberSeries === false) {
				throw new Error(`no series configured for ${key}`);
			}

			return { formatted: 'RET-000001', key };
		}
	};
	const movements: IMovement[] = [];
	const ledger =
		options.withLedger === false
			? undefined
			: {
					recordMovement: async (request: IMovement) => {
						if (options.ledgerFailsOn?.(request)) {
							throw new Error(`the ledger refused ${request.kind} ${request.quantity}`);
						}

						movements.push(request);

						return { movementId: `movement-${movements.length}`, quantityAfter: request.quantity };
					}
			  };
	const refundCalls: Row[] = [];
	const refundGateway =
		options.withRefund === false
			? undefined
			: {
					createRefund: async (request: Row) => {
						refundCalls.push(request);

						return { refundId: `refund-${refundCalls.length}`, amount: request.amount, currency: request.currency };
					}
			  };
	const shipmentCalls: Row[] = [];
	const shipmentGateway =
		options.withShipping === false
			? undefined
			: {
					createReturnShipment: async (request: Row) => {
						shipmentCalls.push(request);

						return {
							fulfillmentId: 'fulfillment-1',
							trackingNumber: request.trackingNumber ?? 'TRACK-1',
							labelUrl: 'https://labels.invalid/return-1.pdf'
						};
					}
			  };
	/** Every `return.*` row the service appended, in the order it appended them. */
	const events: Row[] = [];
	/**
	 * Every recompute the service asked the order capability for.
	 *
	 * The order's totals, its payment status and its summary row are derived from the `order_transaction`
	 * ledger, and a refund is the only row this package appends to it — so the recompute is owed exactly
	 * where a refund was issued and nowhere else. The calls are recorded rather than asserted inline
	 * because "which transitions ask for it" is the whole question.
	 */
	const totalsCalls: Row[] = [];
	const orderTotals =
		options.withTotals === false
			? undefined
			: {
					recompute: async (orderId: string, reason: string) => {
						totalsCalls.push({ orderId, reason });

						if (options.totalsFail === true) {
							throw new Error('the order capability is unreachable');
						}

						return { id: orderId };
					}
			  };
	/**
	 * The platform outbox, reduced to the one call this service makes on it.
	 *
	 * The manager it is handed is the return repository's own, which is what the assertions below
	 * check: an event appended through some other connection is an event a crash can separate from the
	 * write it describes, and the outbox is a table rather than a bus for exactly that reason.
	 */
	const outbox = {
		append: async (manager: any, input: Row) => {
			events.push({ manager, ...input });

			return input;
		}
	};

	// The entity manager the conditional update and the event both go through.
	(typeOrmOrderReturnRepository as Row).manager = { name: 'return-manager' };
	const service = new OrderReturnService(
		typeOrmOrderReturnRepository as never,
		mikroOrmOrderReturnRepository as never,
		lineService,
		sequenceService as never,
		outbox as never,
		ledger as never,
		refundGateway as never,
		shipmentGateway as never,
		orderTotals as never
	);

	return {
		service,
		lineService,
		tables,
		events,
		totalsCalls,
		manager: (typeOrmOrderReturnRepository as Row).manager,
		movements,
		recordedReceipts,
		recordedRequests,
		refundCalls,
		shipmentCalls,
		sequenceCalls,
		updates: typeOrmOrderReturnRepository.updates,
		/** Every read the service made through a TypeORM repository behind the platform's back. */
		typeOrmReads: () => [...typeOrmOrderReturnRepository.reads, ...typeOrmOrderReturnLineRepository.reads],
		/** Every read made through the MikroORM repositories, the platform's included. */
		mikroOrmReads: () => [...mikroOrmOrderReturnRepository.reads, ...mikroOrmOrderReturnLineRepository.reads],
		returnRow: (id: string) => tables.order_return.find((row) => row.id === id),
		line: (id: string) => tables.order_return_line.find((row) => row.id === id)
	};
}

describe('OrderReturnService — requesting a return (doc 10 §11.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('raises a return with the documented defaults, its number and its lines', async () => {
		const fixture = returnFixture({ returns: [], lines: [] });

		const created = await fixture.service.create({
			orderId: ORDER,
			currency: 'USD',
			lines: [{ orderLineId: ORDER_LINE, quantity: 2 }]
		} as never);

		expect(created).toMatchObject({
			orderId: ORDER,
			number: 'RET-000001',
			status: OrderReturnStatus.OPEN,
			currency: 'USD',
			noNotification: false,
			tenantId: TENANT,
			organizationId: ORG,
			refundAmount: undefined
		});
		expect(created.requestedAt).toBeInstanceOf(Date);
		// The number comes from the `RETURN` series, which is what makes it quotable to a customer.
		expect(fixture.sequenceCalls).toEqual(['RETURN']);
		expect(created.lines).toHaveLength(1);
		expect(created.lines?.[0]).toMatchObject({ returnId: created.id, orderLineId: ORDER_LINE, quantity: '2.000000' });
	});

	it('announces every lifecycle move into the outbox, through the write’s own manager', async () => {
		// The package emitted nothing at all, so goods and money could travel back without the search
		// index, the buyer's notifications, an outbound webhook or the accounting export learning of it.
		// Each event is appended by the call that committed the move — through the return repository's
		// own entity manager — so a crash cannot separate the fact from the change it describes.
		const fixture = returnFixture({ returns: [], lines: [] });

		const created = await fixture.service.create({
			orderId: ORDER,
			currency: 'USD',
			lines: [{ orderLineId: ORDER_LINE, quantity: 2 }]
		} as never);

		await fixture.service.approve(created.id, 'Approved by supervisor');
		await fixture.service.reject(created.id, 'Changed our mind');

		expect(fixture.events.map((event) => event.name)).toEqual([
			'return.requested',
			'return.approved',
			'return.rejected'
		]);
		expect(fixture.events.every((event) => event.manager === fixture.manager)).toBe(true);
		expect(fixture.events.every((event) => event.aggregateType === 'ORDER_RETURN')).toBe(true);
		expect(fixture.events.every((event) => event.aggregateId === created.id)).toBe(true);
		// A projection, not a row: the identity, where the return is in its lifecycle, what it has paid
		// back and the version the write landed on.
		expect(fixture.events[1].data).toMatchObject({
			returnId: created.id,
			orderId: ORDER,
			number: 'RET-000001',
			status: OrderReturnStatus.APPROVED,
			currency: 'USD',
			version: 2
		});
	});

	it('announces nothing when the conditional write was refused', async () => {
		// The reason the event is appended inside `commitHeader` rather than by the caller afterwards: a
		// caller that announced on its own would have told every consumer about an approval the version
		// predicate declined.
		const fixture = returnFixture({ returns: [returnRow('return-1', { version: 7 })] });

		await expect(
			fixture.service.approve('return-1', undefined, { wildcard: false, versions: [3] })
		).rejects.toBeDefined();

		expect(fixture.events).toEqual([]);
	});

	it('refuses a return that names no order, no currency or no line', async () => {
		const fixture = returnFixture({ returns: [], lines: [] });

		await expect(
			fixture.service.create({ currency: 'USD', lines: [{ orderLineId: ORDER_LINE, quantity: 1 }] } as never)
		).rejects.toThrow(/must name the order it is against/);

		await expect(
			fixture.service.create({ orderId: ORDER, lines: [{ orderLineId: ORDER_LINE, quantity: 1 }] } as never)
		).rejects.toThrow(/must state the currency/);

		await expect(fixture.service.create({ orderId: ORDER, currency: 'USD' } as never)).rejects.toThrow(
			/at least one line/
		);

		expect(fixture.tables.order_return).toEqual([]);
		expect(fixture.sequenceCalls).toEqual([]);
	});

	it('measures the request against what was fulfilled before the header exists', async () => {
		// The ceiling is the whole point of the request, so it is checked before anything is written —
		// including before a return number is consumed, which is what "before the header exists" means
		// in practice.
		const fixture = returnFixture({ returns: [], lines: [] });

		await expect(
			fixture.service.create({
				orderId: ORDER,
				currency: 'USD',
				lines: [{ orderLineId: ORDER_LINE, quantity: 6 }]
			} as never)
		).rejects.toThrow(/would exceed the 5\.000000 that was fulfilled/);

		expect(fixture.tables.order_return).toEqual([]);
		expect(fixture.tables.order_return_line).toEqual([]);
		expect(fixture.sequenceCalls).toEqual([]);
	});

	it('names the missing numbering series rather than failing generically', async () => {
		// A configuration fault worth naming: without a series there is no number, and a return without a
		// number is not a document a customer can quote.
		const fixture = returnFixture({ returns: [], lines: [], numberSeries: false });

		await expect(
			fixture.service.create({
				orderId: ORDER,
				currency: 'USD',
				lines: [{ orderLineId: ORDER_LINE, quantity: 1 }]
			} as never)
		).rejects.toThrow(/"RETURN"/);
		expect(fixture.tables.order_return).toEqual([]);
	});

	it('tells a zero refund apart from an unstated one', async () => {
		// "An amount of zero is a real amount": a return recorded with a zero refund is a different fact
		// from a return whose refund is not known yet, and the guard is for "not stated" rather than
		// "falsy".
		const fixture = returnFixture({ returns: [], lines: [] });

		const withZero = await fixture.service.create({
			orderId: ORDER,
			currency: 'USD',
			refundAmount: 0,
			lines: [{ orderLineId: ORDER_LINE, quantity: 1 }]
		} as never);
		const withNothing = await fixture.service.create({
			orderId: ORDER,
			currency: 'USD',
			refundAmount: '',
			lines: [{ orderLineId: ORDER_LINE, quantity: 1 }]
		} as never);

		expect(withZero.refundAmount).toBe('0.000000');
		expect(withNothing.refundAmount).toBeUndefined();
	});

	it('normalises a stated refund onto the currency’s scale, half-up', async () => {
		const fixture = returnFixture({ returns: [], lines: [] });

		const up = await fixture.service.create({
			orderId: ORDER,
			currency: 'USD',
			refundAmount: '10.005',
			lines: [{ orderLineId: ORDER_LINE, quantity: 1 }]
		} as never);
		const down = await fixture.service.create({
			orderId: ORDER,
			currency: 'USD',
			refundAmount: '10.004',
			lines: [{ orderLineId: ORDER_LINE, quantity: 1 }]
		} as never);

		expect(up.refundAmount).toBe('10.010000');
		expect(down.refundAmount).toBe('10.000000');
	});

	it('prices a return in its own currency rather than in the currency of the last one', async () => {
		// A JPY return has no minor unit at all, so a stated 100.4 is 100; the money layer decides that,
		// not the caller and not this service.
		const fixture = returnFixture({ returns: [], lines: [] });

		const created = await fixture.service.create({
			orderId: ORDER,
			currency: 'JPY',
			refundAmount: '100.5',
			lines: [{ orderLineId: ORDER_LINE, quantity: 1 }]
		} as never);

		expect(created.currency).toBe('JPY');
		expect(created.refundAmount).toBe('101.000000');
	});
});

describe('OrderReturnService — the lifecycle and the edges it refuses (doc 10 §11.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('approves an open or a requested return and stamps the decision', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1'), returnRow('return-2', { status: OrderReturnStatus.REQUESTED })]
		});

		const first = await fixture.service.approve('return-1', 'looks fine');
		const second = await fixture.service.approve('return-2');

		expect(first).toMatchObject({ status: OrderReturnStatus.APPROVED, note: 'looks fine' });
		expect(first.approvedAt).toBeInstanceOf(Date);
		expect(second.status).toBe(OrderReturnStatus.APPROVED);
	});

	it('refuses to approve a return whose goods are already in', async () => {
		// Approval is what lets the customer ship; once the goods have arrived there is nothing left to
		// authorise, and re-approving would reopen a decision that was already acted on.
		const fixture = returnFixture({
			returns: [
				returnRow('received', { status: OrderReturnStatus.RECEIVED }),
				returnRow('partial', { status: OrderReturnStatus.PARTIALLY_RECEIVED }),
				returnRow('closed', { status: OrderReturnStatus.CLOSED })
			]
		});

		for (const id of ['received', 'partial', 'closed']) {
			await expect(fixture.service.approve(id)).rejects.toBeInstanceOf(BadRequestException);
			expect(fixture.returnRow(id)?.approvedAt).toBeUndefined();
		}
	});

	it('rejects a return the tenant has decided against, from any status it may still be decided in', async () => {
		const fixture = returnFixture({
			returns: [
				returnRow('open', { status: OrderReturnStatus.OPEN }),
				returnRow('requested', { status: OrderReturnStatus.REQUESTED }),
				returnRow('approved', { status: OrderReturnStatus.APPROVED })
			]
		});

		for (const id of ['open', 'requested', 'approved']) {
			await expect(fixture.service.reject(id, 'outside the window')).resolves.toMatchObject({
				status: OrderReturnStatus.REJECTED,
				reason: 'outside the window'
			});
		}
	});

	it('refuses to reject a return whose goods have arrived, because that is a closure rather than a refusal', async () => {
		const fixture = returnFixture({
			returns: [returnRow('received', { status: OrderReturnStatus.RECEIVED })]
		});

		await expect(fixture.service.reject('received', 'too late')).rejects.toThrow(
			/cannot reject; expected OPEN or REQUESTED or APPROVED/
		);
		expect(fixture.returnRow('received')).toMatchObject({ status: OrderReturnStatus.RECEIVED });
	});

	it('cancels a return before its goods were received, and refuses once they have been', async () => {
		// The cancelled return keeps no trace of a receipt: a cancellation may not undo goods that
		// physically arrived, which is what the state machine is protecting.
		const fixture = returnFixture({
			returns: [
				returnRow('approved', { status: OrderReturnStatus.APPROVED }),
				returnRow('partial', { status: OrderReturnStatus.PARTIALLY_RECEIVED })
			]
		});

		const canceled = await fixture.service.cancel('approved', 'customer changed their mind');

		expect(canceled).toMatchObject({
			status: OrderReturnStatus.CANCELED,
			reason: 'customer changed their mind'
		});
		expect(canceled.canceledAt).toBeInstanceOf(Date);

		await expect(fixture.service.cancel('partial', 'too late')).rejects.toBeInstanceOf(BadRequestException);
		expect(fixture.returnRow('partial')).toMatchObject({ status: OrderReturnStatus.PARTIALLY_RECEIVED });
	});

	it('refuses a transition on a return of another organization and one that does not exist', async () => {
		const fixture = returnFixture({
			returns: [returnRow('theirs', { organizationId: OTHER_ORG })]
		});

		await expect(fixture.service.approve('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.cancel('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.approve('no-such-return')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('refuses a shipment for a return that has not been approved', async () => {
		// "A return must be approved before its goods can be shipped back": creating the return leg
		// before the tenant has agreed to take the goods back would book a parcel nobody authorised.
		const fixture = returnFixture({ returns: [returnRow('return-1', { status: OrderReturnStatus.OPEN })] });

		await expect(fixture.service.createShipment('return-1')).rejects.toThrow(/must be approved/);
		expect(fixture.shipmentCalls).toEqual([]);
	});

	it('refuses a shipment when the shipping capability is not registered', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			withShipping: false
		});

		await expect(fixture.service.createShipment('return-1')).rejects.toThrow(/RETURN_SHIPPING_UNAVAILABLE/);
	});

	it('creates the return leg and records the chosen option on the return', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED, warehouseId: WAREHOUSE })]
		});

		const shipment = await fixture.service.createShipment('return-1', {
			shippingOptionId: 'option-9',
			trackingNumber: 'TRACK-9'
		});

		expect(shipment).toMatchObject({ fulfillmentId: 'fulfillment-1', trackingNumber: 'TRACK-9' });
		expect(fixture.shipmentCalls[0]).toMatchObject({
			returnId: 'return-1',
			orderId: ORDER,
			shippingOptionId: 'option-9',
			warehouseId: WAREHOUSE,
			trackingNumber: 'TRACK-9'
		});
		expect(fixture.returnRow('return-1')).toMatchObject({ shippingOptionId: 'option-9' });
	});
});

describe('OrderReturnService — receiving goods (doc 10 §11.6, §11.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('receives everything, moves to RECEIVED and conserves the quantity', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { quantity: '5.000000' }), lineRow('line-2', { quantity: '2.000000' })]
		});

		const outcome = await fixture.service.receive('return-1', [
			{ lineId: 'line-1', receivedQuantity: '5' },
			{ lineId: 'line-2', receivedQuantity: '2' }
		]);

		expect(outcome).toMatchObject({
			returnId: 'return-1',
			status: OrderReturnStatus.RECEIVED,
			receivedQuantity: '7.000000',
			outstandingQuantity: '0.000000'
		});
		expect(fixture.returnRow('return-1')?.receivedAt).toBeInstanceOf(Date);
		// What arrived plus what is still outstanding is exactly what was asked for.
		expect(outcome.receivedQuantity).toBe('7.000000');
	});

	it('leaves a partly received return open, with the remainder outstanding', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { quantity: '5.000000' })]
		});

		const outcome = await fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '2' }]);

		expect(outcome).toMatchObject({
			status: OrderReturnStatus.PARTIALLY_RECEIVED,
			receivedQuantity: '2.000000',
			outstandingQuantity: '3.000000'
		});
		expect(fixture.returnRow('return-1')).toMatchObject({ status: OrderReturnStatus.PARTIALLY_RECEIVED });
	});

	it('is refused on a return that has not been approved', async () => {
		const fixture = returnFixture({ returns: [returnRow('return-1', { status: OrderReturnStatus.OPEN })] });

		await expect(
			fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '5' }])
		).rejects.toThrow(/cannot receive; expected APPROVED or PARTIALLY_RECEIVED/);
		expect(fixture.movements).toEqual([]);
		expect(fixture.line('line-1')).toMatchObject({ receivedQuantity: '0' });
	});

	it('writes one movement per arriving unit, of the kind that unit earned', async () => {
		// Doc 10 §11.3: a sound restocked unit is a `RETURN`, a unit that came back unsellable is a
		// `WRITE_OFF` (recorded without ever entering sellable stock), and a unit that arrived broken is
		// a `DAMAGE`. The distinction is the whole reason the return domain states movements rather than
		// writing a level itself.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [
				lineRow('restocked', { quantity: '4.000000', orderLineId: ORDER_LINE, restock: true }),
				lineRow('written-off', { quantity: '4.000000', orderLineId: SECOND_ORDER_LINE, restock: false })
			]
		});

		await fixture.service.receive('return-1', [
			{ lineId: 'restocked', receivedQuantity: '4' },
			{ lineId: 'written-off', receivedQuantity: '2', damagedQuantity: '1' }
		]);

		expect(fixture.movements).toHaveLength(3);
		expect(
			fixture.movements.map((movement) => [movement.kind, movement.quantity, movement.eventOnly ?? false])
		).toEqual([
			[StockMovementKind.RETURN, '4.000000', false],
			// The two units nobody may sell are stated as events: the ledger writes the row and leaves the
			// level alone, because these units were never in the location's stock. A movement that carried
			// the quantity as a delta would put unsellable units into the number the platform sells against.
			[StockMovementKind.WRITE_OFF, '2.000000', true],
			[StockMovementKind.DAMAGE, '1.000000', true]
		]);
		// Every movement names the return as its concept and the location it landed at, so the ledger
		// reads without a join and the units are counted where they physically are.
		for (const movement of fixture.movements) {
			expect(movement).toMatchObject({
				referenceType: 'ORDER_RETURN',
				referenceId: 'return-1',
				warehouseId: WAREHOUSE
			});
		}
		expect(fixture.movements.map((movement) => movement.variantId)).toEqual([VARIANT, SECOND_VARIANT, SECOND_VARIANT]);
	});

	it('refuses a receipt with units to move and no ledger, and refuses it loudly', async () => {
		// "A receipt whose goods never became sellable is worse than a receipt that did not happen."
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			withLedger: false
		});

		await expect(
			fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '5' }])
		).rejects.toThrow(/RETURN_STOCK_LEDGER_UNAVAILABLE/);
	});

	it('refuses a movement it cannot locate, and one it cannot tie to a fulfilled variant', async () => {
		const nowhere = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED, warehouseId: undefined })],
			lines: [lineRow('line-1', { quantity: '5.000000', warehouseId: undefined })]
		});

		await expect(
			nowhere.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '5' }])
		).rejects.toThrow(/has no receiving location/);
		expect(nowhere.movements).toEqual([]);

		const untied = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { quantity: '5.000000', orderLineId: 'an-order-line-that-never-shipped' })]
		});

		await expect(
			untied.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '5' }])
		).rejects.toThrow(/is not tied to a fulfilled variant/);
		expect(untied.movements).toEqual([]);
	});

	it('takes the receiving location from the request when the line and the header name none', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED, warehouseId: undefined })],
			lines: [lineRow('line-1', { quantity: '1.000000', warehouseId: undefined })]
		});

		const outcome = await fixture.service.receive(
			'return-1',
			[{ lineId: 'line-1', receivedQuantity: '1' }],
			{ warehouseId: OTHER_WAREHOUSE }
		);

		expect(outcome.movementIds).toEqual(['movement-1']);
		expect(fixture.movements[0].warehouseId).toBe(OTHER_WAREHOUSE);
		expect(fixture.returnRow('return-1')?.warehouseId).toBe(OTHER_WAREHOUSE);
	});

	it('issues the refund only after the goods are in, and records the amount on the return', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { quantity: '5.000000' })]
		});

		const outcome = await fixture.service.receive(
			'return-1',
			[{ lineId: 'line-1', receivedQuantity: '5' }],
			{ refund: '50.00' }
		);

		expect(outcome.status).toBe(OrderReturnStatus.RECEIVED);
		expect(outcome.refund).toMatchObject({ refundId: 'refund-1', amount: '50.000000', currency: 'USD' });
		expect(fixture.refundCalls[0]).toMatchObject({ orderId: ORDER, returnId: 'return-1', amount: '50.000000' });
		expect(fixture.returnRow('return-1')?.refundAmount).toBe('50.000000');
	});

	it('does not issue the refund for goods the ledger refused', async () => {
		// "Money never leaves for goods the ledger refused": the ordering is the guarantee, not the
		// intent, so a receipt that could not be posted must stop before the refund step.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			withLedger: false
		});

		await expect(
			fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '5' }], { refund: '50.00' })
		).rejects.toThrow(/RETURN_STOCK_LEDGER_UNAVAILABLE/);
		expect(fixture.refundCalls).toEqual([]);
	});

	it('records each delivery as its own movement, so the ledger sums to what arrived', async () => {
		// Two deliveries against one line are two movements, never one rewritten row: the ledger is what
		// the level is reconciled against, so it has to hold every arrival separately. What the *line*
		// records of the two deliveries is the separate matter the defect case below is about.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { quantity: '10.000000' })]
		});

		await fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '4' }]);
		await fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '6' }]);

		expect(fixture.movements.map((movement) => movement.quantity)).toEqual(['4.000000', '6.000000']);
		expect(fixture.movements.reduce((total, movement) => total + Number(movement.quantity), 0)).toBe(10);
	});

	it('asks the order capability for each delivery’s own units, not for the running total', async () => {
		// The order line's received-return counter is the order's cache of what came back, and the
		// order package moves it by a delta rather than setting it — so each delivery states the units it
		// brought. Sending the running total twice would double the first delivery in the order's columns,
		// and the derivation that reads them would then call a two-unit return fully received.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { quantity: '10.000000' })]
		});

		await fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '4' }]);
		await fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '6' }]);

		expect(fixture.recordedReceipts).toEqual([
			{ orderId: ORDER, moves: [{ orderLineId: ORDER_LINE, quantityDelta: '4.000000' }] },
			{ orderId: ORDER, moves: [{ orderLineId: ORDER_LINE, quantityDelta: '6.000000' }] }
		]);
	});

	it('states one move per order line, for the order lines the return’s own lines point at', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [
				lineRow('line-1', { quantity: '3.000000', orderLineId: ORDER_LINE }),
				lineRow('line-2', { quantity: '2.000000', orderLineId: SECOND_ORDER_LINE })
			]
		});

		await fixture.service.receive('return-1', [
			{ lineId: 'line-1', receivedQuantity: '2' },
			{ lineId: 'line-2', receivedQuantity: '2' }
		]);

		expect(fixture.recordedReceipts).toEqual([
			{
				orderId: ORDER,
				moves: [
					{ orderLineId: ORDER_LINE, quantityDelta: '2.000000' },
					{ orderLineId: SECOND_ORDER_LINE, quantityDelta: '2.000000' }
				]
			}
		]);
	});

	it('moves the order’s counter back when the receipt is compensated', async () => {
		// The order line counter is part of doc 10 §11.6 step 2, so it is compensated with the lines it
		// was moved for: a receipt the ledger refused must leave neither the return nor the order claiming
		// the goods arrived — the order's counter is what its `fulfillmentStatus` is derived from, and a
		// counter left behind would show the customer a returned order that never came back.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { quantity: '10.000000' })],
			withLedger: false
		});

		await expect(
			fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '5' }])
		).rejects.toThrow(/RETURN_STOCK_LEDGER_UNAVAILABLE/);

		expect(fixture.recordedReceipts).toEqual([
			{ orderId: ORDER, moves: [{ orderLineId: ORDER_LINE, quantityDelta: '5.000000' }] },
			{ orderId: ORDER, moves: [{ orderLineId: ORDER_LINE, quantityDelta: '-5.000000' }] }
		]);
	});

	it('refuses a receipt on another organization’s return', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { organizationId: OTHER_ORG, status: OrderReturnStatus.APPROVED })]
		});

		await expect(
			fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '5' }])
		).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.movements).toEqual([]);
	});

	// The defect: a receipt is recorded and its status written *before* the stock movements are written,
	// and nothing compensates when the ledger refuses. The return is then left claiming goods it never
	// took back, which is the state the refund guard reads. Doc 10 §11.6 states the failure semantics
	// verbatim: "a failure in steps 2–3 compensates fully and the return stays `APPROVED`".
	// (`order-return.service.ts`: the receipt is planned and its movements resolved before either is
	// written, and the `catch` around the line write, the movement writes and the status write reverses
	// the movements that were posted and puts the lines back.)
	it('leaves a return un-received when its stock movements could not be written', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			withLedger: false
		});

		await expect(
			fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '5' }])
		).rejects.toThrow(/RETURN_STOCK_LEDGER_UNAVAILABLE/);

		// Asserted on the value rather than on the key: a receipt refused before its header write no
		// longer rewrites the header at all, so the row never gains a `receivedAt` member to hold one.
		expect(fixture.returnRow('return-1')).toMatchObject({ status: OrderReturnStatus.APPROVED });
		expect(fixture.returnRow('return-1')?.receivedAt).toBeUndefined();
		expect(fixture.line('line-1')).toMatchObject({ receivedQuantity: '0', damagedQuantity: '0' });
	});

	// The defect: the compensation restored the header unconditionally, and the header is the receipt's
	// *last* write — so for every receipt refused before it (a ledger that refused a movement, a line
	// the plan could not place, a version conflict on the header write itself) the restore wrote the
	// values the row already held and still moved the version on. The caller that read version 2 and
	// was refused found the return at 3, so its retry was refused again as a conflict it could not have
	// caused. The end-to-end receipt run measured exactly that: a refused receipt left
	// `version = 3` with nothing received.
	it('leaves the version where the caller read it when a receipt is refused before its header write', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED, version: 2 })],
			withLedger: false
		});

		await expect(
			fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '5' }])
		).rejects.toThrow(/RETURN_STOCK_LEDGER_UNAVAILABLE/);

		expect(fixture.returnRow('return-1')).toMatchObject({ status: OrderReturnStatus.APPROVED, version: 2 });
	});

	// The defect: `recordReceipt` *overwrites* a line's `receivedQuantity` rather than accumulating it,
	// so a return received in two parts never reaches `RECEIVED` — the second call records only its own
	// delivery against a request that the first delivery already consumed part of. Doc 10 §11.1 names
	// the transition this makes unreachable (`PARTIALLY_RECEIVED --> RECEIVED : remaining units
	// received`), and the service's own statement is that "the same lines can be received again".
	// (`order-return-line.service.ts`: `planReceipt` adds each delivery to what the line already holds,
	// and refuses a total that would exceed what was requested.)
	it('reaches RECEIVED when the remainder arrives in a second delivery', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { quantity: '5.000000' })]
		});

		await fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '2' }]);
		const second = await fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '3' }]);

		expect(second.status).toBe(OrderReturnStatus.RECEIVED);
		expect(second.outstandingQuantity).toBe('0.000000');
		expect(fixture.line('line-1')?.receivedQuantity).toBe('5.000000');
		// And the ledger holds one movement per unit received, never two for one unit.
		expect(fixture.movements.reduce((total, movement) => total + Number(movement.quantity), 0)).toBe(5);
	});
});

/**
 * The order-line counters a return moves, and the compensation that moves them back.
 *
 * Three defects are pinned here, each at the counter it corrupted:
 *
 * - **a compensation undid steps that never ran.** A receipt refused before it reached the order — in
 *   `planMovements`, for a line with no receiving location — was compensated by moving the order's
 *   received-return counter back by its whole plan, which subtracted units another return of the same
 *   line had put there, once per retry. The compensation now undoes what the receipt recorded as done;
 * - **damaged units moved no counter.** A return of one sound and one broken unit reached `RECEIVED`
 *   while its order was told one unit came back, and a delivery that was all broken told it nothing.
 *   Every unit that arrived now moves `returnReceivedQuantity`, which is the counter
 *   `deriveFulfillmentStatus` reads as "came back";
 * - **nothing wrote the requested counter**, so doc 10 invariant I-12 (`returnReceivedQuantity +
 *   returnDismissedQuantity <= returnRequestedQuantity`) compared what came back against a zero. A
 *   return's lines now move it by what they ask for, an edit by the difference, and a withdrawal gives
 *   back what was still outstanding.
 */
describe('OrderReturnService — the order-line counters a return moves (doc 10 §11.6 step 2, §11.7, I-12)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('does not move the order’s counter back for a receipt refused before it reached the order', async () => {
		// The failure scenario of C2: another return of the same order line has already put units on the
		// counter, and this receipt is refused in `planMovements` because neither the line nor the header
		// nor the request names a receiving location. The compensation used to send `-5` for a receipt that
		// never sent `+5` — on every retry.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED, warehouseId: undefined })],
			lines: [lineRow('line-1', { quantity: '5.000000', warehouseId: undefined })]
		});

		for (let retry = 0; retry < 2; retry++) {
			await expect(
				fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '5' }])
			).rejects.toThrow(/has no receiving location/);
		}

		expect(fixture.recordedReceipts).toEqual([]);
		expect(fixture.line('line-1')).toMatchObject({ receivedQuantity: '0', damagedQuantity: '0' });
		expect(fixture.returnRow('return-1')).toMatchObject({ status: OrderReturnStatus.APPROVED, version: 1 });
	});

	it('does not move the order’s counter back when the order refused the move itself', async () => {
		// The port is all or nothing, so a call that threw moved nothing and there is nothing to take back —
		// while the return's own lines, whose write did run, are still put back.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { quantity: '5.000000' })],
			receiptRefused: true
		});

		await expect(
			fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '5' }])
		).rejects.toThrow(/ORDER_LINE_RECEIPT_BELOW_ZERO/);

		expect(fixture.recordedReceipts).toEqual([]);
		expect(fixture.movements).toEqual([]);
		expect(fixture.line('line-1')).toMatchObject({ receivedQuantity: '0', damagedQuantity: '0' });
	});

	it('undoes every step that ran, even when the undo of one of them fails', async () => {
		// The second movement is refused, and so is the reversal of the first: the ledger's refusal is no
		// reason to leave the lines and the order claiming the goods arrived, so both are still put back and
		// the original failure is the one the caller sees.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [
				lineRow('line-1', { quantity: '2.000000', orderLineId: ORDER_LINE }),
				lineRow('line-2', { quantity: '2.000000', orderLineId: SECOND_ORDER_LINE })
			],
			ledgerFailsOn: (request) => request.variantId === SECOND_VARIANT || request.quantity.startsWith('-')
		});

		await expect(
			fixture.service.receive('return-1', [
				{ lineId: 'line-1', receivedQuantity: '2' },
				{ lineId: 'line-2', receivedQuantity: '2' }
			])
		).rejects.toThrow(/the ledger refused RETURN 2\.000000/);

		expect(fixture.line('line-1')).toMatchObject({ receivedQuantity: '0' });
		expect(fixture.line('line-2')).toMatchObject({ receivedQuantity: '0' });
		expect(fixture.recordedReceipts).toEqual([
			{
				orderId: ORDER,
				moves: [
					{ orderLineId: ORDER_LINE, quantityDelta: '2.000000' },
					{ orderLineId: SECOND_ORDER_LINE, quantityDelta: '2.000000' }
				]
			},
			{
				orderId: ORDER,
				moves: [
					{ orderLineId: ORDER_LINE, quantityDelta: '-2.000000' },
					{ orderLineId: SECOND_ORDER_LINE, quantityDelta: '-2.000000' }
				]
			}
		]);
	});

	it('tells the order about damaged units, as units that came back', async () => {
		// The failure scenario of C6: a line of two comes back as one sound and one broken unit. The return
		// reaches `RECEIVED` on both, so the order is told two units came back — which is what makes its
		// derivation answer `RETURNED` rather than `PARTIALLY_RETURNED`.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { quantity: '2.000000' })]
		});

		const outcome = await fixture.service.receive('return-1', [
			{ lineId: 'line-1', receivedQuantity: '1', damagedQuantity: '1' }
		]);

		expect(outcome.status).toBe(OrderReturnStatus.RECEIVED);
		expect(fixture.recordedReceipts).toEqual([
			{ orderId: ORDER, moves: [{ orderLineId: ORDER_LINE, quantityDelta: '2.000000' }] }
		]);
	});

	it('tells the order about a delivery that arrived entirely broken, which used to move nothing', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { quantity: '2.000000' })]
		});

		await fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '0', damagedQuantity: '2' }]);

		expect(fixture.recordedReceipts).toEqual([
			{ orderId: ORDER, moves: [{ orderLineId: ORDER_LINE, quantityDelta: '2.000000' }] }
		]);
		// The broken units are still recorded as the event they were, never as stock.
		expect(fixture.movements.map((movement) => [movement.kind, movement.quantity, movement.eventOnly])).toEqual([
			[StockMovementKind.DAMAGE, '2.000000', true]
		]);
	});

	it('takes damaged units back from the order when their receipt is compensated', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { quantity: '3.000000' })],
			withLedger: false
		});

		await expect(
			fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '1', damagedQuantity: '2' }])
		).rejects.toThrow(/RETURN_STOCK_LEDGER_UNAVAILABLE/);

		expect(fixture.recordedReceipts.map((call) => call.moves)).toEqual([
			[{ orderLineId: ORDER_LINE, quantityDelta: '3.000000' }],
			[{ orderLineId: ORDER_LINE, quantityDelta: '-3.000000' }]
		]);
	});

	it('asks the order for exactly what a new return requests', async () => {
		const fixture = returnFixture({ returns: [], lines: [] });

		await fixture.service.create({
			orderId: ORDER,
			currency: 'USD',
			lines: [
				{ orderLineId: ORDER_LINE, quantity: 2 },
				{ orderLineId: SECOND_ORDER_LINE, quantity: '1.5' }
			]
		} as never);

		expect(fixture.recordedRequests).toEqual([
			{
				orderId: ORDER,
				moves: [
					{ orderLineId: ORDER_LINE, quantityDelta: '2.000000' },
					{ orderLineId: SECOND_ORDER_LINE, quantityDelta: '1.500000' }
				]
			}
		]);
	});

	it('moves the request by what an edit changes, and not at all for an edit that changes nothing', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.OPEN })],
			lines: [lineRow('line-1', { quantity: '5.000000', orderLineId: ORDER_LINE })]
		});

		await fixture.service.replaceLines('return-1', [
			{ orderLineId: ORDER_LINE, quantity: '3' },
			{ orderLineId: SECOND_ORDER_LINE, quantity: '1' }
		]);
		await fixture.service.replaceLines('return-1', [
			{ orderLineId: ORDER_LINE, quantity: '3' },
			{ orderLineId: SECOND_ORDER_LINE, quantity: '1' }
		]);

		// Five were asked for and three are now: the order gives two back on the first line and takes one on
		// the second. The second edit asks for what the first left, so the order is not written at all.
		expect(fixture.recordedRequests).toEqual([
			{
				orderId: ORDER,
				moves: [
					{ orderLineId: ORDER_LINE, quantityDelta: '-2.000000' },
					{ orderLineId: SECOND_ORDER_LINE, quantityDelta: '1.000000' }
				]
			}
		]);
	});

	it('gives back what a rejected return still asked for, and what a cancelled one did', async () => {
		const fixture = returnFixture({
			returns: [
				returnRow('rejected', { status: OrderReturnStatus.APPROVED }),
				returnRow('canceled', { status: OrderReturnStatus.REQUESTED })
			],
			lines: [
				lineRow('line-1', { returnId: 'rejected', quantity: '5.000000', orderLineId: ORDER_LINE }),
				lineRow('line-2', { returnId: 'canceled', quantity: '3.000000', orderLineId: SECOND_ORDER_LINE })
			]
		});

		await fixture.service.reject('rejected', 'outside the window');
		await fixture.service.cancel('canceled', 'customer changed their mind');

		expect(fixture.recordedRequests).toEqual([
			{ orderId: ORDER, moves: [{ orderLineId: ORDER_LINE, quantityDelta: '-5.000000' }] },
			{ orderId: ORDER, moves: [{ orderLineId: SECOND_ORDER_LINE, quantityDelta: '-3.000000' }] }
		]);
	});

	it('keeps the request of a return closed short, because a closed return still counts', async () => {
		// Doc 10 §11.7 has `CLOSED` change nothing on the order, and a closed return is one of the live
		// statuses the ceiling check still counts in full: the unreceived remainder is recorded on the
		// return, not released on the order.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.PARTIALLY_RECEIVED })],
			lines: [lineRow('line-1', { quantity: '5.000000', receivedQuantity: '3.000000' })]
		});

		await fixture.service.close('return-1');

		expect(fixture.recordedRequests).toEqual([]);
	});

	it('puts the request back when the withdrawal itself is refused', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED, version: 4 })],
			lines: [lineRow('line-1', { quantity: '5.000000' })]
		});

		await expect(
			fixture.service.reject('return-1', 'stale', { wildcard: false, versions: [3] })
		).rejects.toMatchObject({ status: 409, code: 'ENTITY_VERSION_CONFLICT' });

		expect(fixture.recordedRequests.map((call) => call.moves)).toEqual([
			[{ orderLineId: ORDER_LINE, quantityDelta: '-5.000000' }],
			[{ orderLineId: ORDER_LINE, quantityDelta: '5.000000' }]
		]);
		expect(fixture.returnRow('return-1')).toMatchObject({ status: OrderReturnStatus.APPROVED, version: 4 });
	});

	it('does not let a second withdrawal of one return give its units back again', async () => {
		// Another operator cancels the return between this rejection's read and its write. The rejection
		// states no version, so it is predicated on the one the row holds when it writes — the version the
		// cancellation just produced — and without the status in the predicate it landed, and the order was
		// given the same five units back twice. With it, the write changes no row and the release is undone.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED, version: 1 })],
			lines: [lineRow('line-1', { quantity: '5.000000' })],
			beforeRequestMove: (moves, tables) => {
				const row = tables.order_return[0];

				if (row.status === OrderReturnStatus.APPROVED && moves[0]?.quantityDelta.startsWith('-')) {
					Object.assign(row, { status: OrderReturnStatus.CANCELED, version: 2 });
				}
			}
		});

		await expect(fixture.service.reject('return-1', 'too late')).rejects.toMatchObject({
			status: 409,
			code: 'ENTITY_VERSION_CONFLICT'
		});

		expect(fixture.updates[fixture.updates.length - 1].criteria).toMatchObject({
			id: 'return-1',
			status: OrderReturnStatus.APPROVED
		});
		expect(fixture.recordedRequests.map((call) => call.moves)).toEqual([
			[{ orderLineId: ORDER_LINE, quantityDelta: '-5.000000' }],
			[{ orderLineId: ORDER_LINE, quantityDelta: '5.000000' }]
		]);
		expect(fixture.returnRow('return-1')).toMatchObject({ status: OrderReturnStatus.CANCELED, version: 2 });
	});

	it('refuses a receipt whose return was withdrawn while it was in flight, and takes its units back', async () => {
		// The mirror of the case above, from the receipt's side. A cancellation that read the lines before
		// the receipt moved them released every unit the return asked for; a receipt that then wrote
		// `RECEIVED` over `CANCELED` left the order holding five units received against none requested —
		// I-12 broken by two writes that each succeeded. The receipt's header write is predicated on the
		// status the receipt was decided from, so it changes no row, and the compensation takes the receipt
		// back off the lines and off the order.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED, version: 1 })],
			lines: [lineRow('line-1', { quantity: '5.000000' })],
			beforeReceiptMove: (moves, tables) => {
				const row = tables.order_return[0];

				if (row.status === OrderReturnStatus.APPROVED && !moves[0]?.quantityDelta.startsWith('-')) {
					Object.assign(row, { status: OrderReturnStatus.CANCELED, version: 2 });
				}
			}
		});

		await expect(
			fixture.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '5' }])
		).rejects.toMatchObject({ status: 409, code: 'ENTITY_VERSION_CONFLICT' });

		expect(fixture.updates[fixture.updates.length - 1].criteria).toMatchObject({
			id: 'return-1',
			status: OrderReturnStatus.APPROVED
		});
		expect(fixture.recordedReceipts.map((call) => call.moves)).toEqual([
			[{ orderLineId: ORDER_LINE, quantityDelta: '5.000000' }],
			[{ orderLineId: ORDER_LINE, quantityDelta: '-5.000000' }]
		]);
		expect(fixture.line('line-1')).toMatchObject({ receivedQuantity: '0', damagedQuantity: '0' });
		expect(fixture.returnRow('return-1')).toMatchObject({ status: OrderReturnStatus.CANCELED, version: 2 });
	});
});

describe('OrderReturnService — the money that follows the goods (doc 10 §11.6 step 5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a refund on a return that has received nothing', async () => {
		// The guard reads the status, which the receipt writes before the refund is attempted: that
		// ordering is what keeps money behind goods.
		const fixture = returnFixture({
			returns: [
				returnRow('open', { status: OrderReturnStatus.OPEN }),
				returnRow('approved', { status: OrderReturnStatus.APPROVED })
			]
		});

		for (const id of ['open', 'approved']) {
			await expect(fixture.service.refund(id, '10.00')).rejects.toThrow(/nothing has been received against it/);
		}
		expect(fixture.refundCalls).toEqual([]);
	});

	it('refuses a refund when no payment capability is registered', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.RECEIVED })],
			withRefund: false
		});

		await expect(fixture.service.refund('return-1', '10.00')).rejects.toThrow(/RETURN_REFUND_UNAVAILABLE/);
	});

	it('refuses an amount that is not positive, at the currency’s own boundary', async () => {
		// A refund of half a cent in USD rounds to nothing, and "a refund must be for a positive amount"
		// is a statement about the amount that would actually be paid — not about the text that arrived.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.RECEIVED })]
		});

		for (const amount of ['0', '0.004', '-1']) {
			await expect(fixture.service.refund('return-1', amount)).rejects.toThrow(
				/must be for a positive amount/
			);
		}
		expect(fixture.refundCalls).toEqual([]);

		// One storage unit past the boundary is a real refund.
		await expect(fixture.service.refund('return-1', '0.005')).resolves.toMatchObject({ amount: '0.010000' });
	});

	it('rounds the amount it asks for onto the currency’s scale', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.RECEIVED })]
		});

		await fixture.service.refund('return-1', '10.005');

		expect(fixture.refundCalls[0].amount).toBe('10.010000');
	});

	it('accumulates the refunded total exactly, never above the storage scale', async () => {
		// The running total on the return is the exact sum of what was refunded — each part already
		// rounded at the currency's scale, and each part stored as a decimal rather than as a binary
		// float. `0.1 + 0.2` is the smallest case where the two disagree.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.RECEIVED, refundAmount: '0' })]
		});

		await fixture.service.refund('return-1', '0.1');
		await fixture.service.refund('return-1', '0.2');

		expect(fixture.returnRow('return-1')?.refundAmount).toBe('0.300000');
		expect(fixture.refundCalls.map((call) => call.amount)).toEqual(['0.100000', '0.200000']);
	});

	it('counts a refund of half a cent as a whole cent, so two of them are two cents', async () => {
		// Each refund crosses its own boundary before it is issued, so the total is the sum of the parts
		// a customer actually received rather than the sum of the amounts that were typed.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.RECEIVED, refundAmount: '0' })]
		});

		await fixture.service.refund('return-1', '0.005');
		await fixture.service.refund('return-1', '0.005');

		expect(fixture.refundCalls.map((call) => call.amount)).toEqual(['0.010000', '0.010000']);
		expect(fixture.returnRow('return-1')?.refundAmount).toBe('0.020000');
	});

	it('allows a settled return to be refunded after it was closed', async () => {
		// A return may be closed on the goods and settled afterwards; the guard admits the two states
		// that mean "something arrived" plus the one that means "everything did".
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.CLOSED })]
		});

		await expect(fixture.service.refund('return-1', '5.00')).resolves.toMatchObject({ amount: '5.000000' });
	});
});

/**
 * The order's derived columns, and the two returns moves that change them (ADR-26).
 *
 * ADR-26 requires the order's `fulfillmentStatus`, its totals and its `paymentStatus` to be "recomputed
 * by a single function from the ledgers every time a transaction, fulfillment, **return**, claim or
 * exchange changes, inside the same transaction as the change". The function is the order package's
 * `OrderTotalsService.recompute`, and the whole of this describe is the question of *which* returns
 * moves owe it a call.
 *
 * The answer is read out of the function rather than assumed. `recompute` derives three things:
 * `computeTotals` from the order's lines, its shipping methods, its credit lines, its adjustments, its
 * tax lines and its `order_transaction` ledger; `derivePaymentStatus` from the order's status, that
 * snapshot and the same ledger; and `deriveFulfillmentStatus` from the order's status and five sums over
 * its lines — `quantity`, `writtenOffQuantity`, `returnDismissedQuantity`, `fulfilledQuantity` and
 * `returnReceivedQuantity`.
 *
 * **Two returns moves reach those inputs, and the second one is this revision's change.** A refund
 * appends an `order_transaction`, which is the first two derivations' ledger. A **receipt** writes the
 * order line's `returnReceivedQuantity` — the counter `deriveFulfillmentStatus` sums to decide
 * `PARTIALLY_RETURNED` against `RETURNED` — through the fulfillment port, which is why every receipt
 * owes a recompute whether or not money moves, and why the receipt's reason is `RETURN_RECEIVED`
 * rather than the refund's `PAYMENT_RECONCILED`. **Before that counter had a writer, this suite
 * asserted the opposite** — that a receipt refunding nothing was owed nothing — and the assertion was
 * correct about the code and wrong about the design: the order answered `NOT_FULFILLED` for goods its
 * own warehouse was holding. The transitions that still owe nothing are asserted beside the ones that
 * do.
 */
describe('OrderReturnService — the order columns a refund moves (ADR-26)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('asks for the recompute with the reason the service documents for a money move', async () => {
		// The reason is recorded on the `order_summary` row the recompute writes, so it is a fact another
		// domain reads rather than a log line. A refund moves money and nothing else, so the reason is the
		// money one: `FULFILLMENT_COMMITTED` would claim a fulfilment state moved, and the derivation that
		// would have to move it reads five order-line counters this package never writes.
		expect(RETURNS_TOTALS_REASON).toBe('PAYMENT_RECONCILED');

		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.RECEIVED })]
		});

		await fixture.service.refund('return-1', '10.00');

		expect(fixture.totalsCalls).toEqual([{ orderId: ORDER, reason: 'PAYMENT_RECONCILED' }]);
	});

	it('asks for it once per refund, on the order the refund was raised against', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.RECEIVED, refundAmount: '0' })]
		});

		await fixture.service.refund('return-1', '0.1');
		await fixture.service.refund('return-1', '0.2');

		expect(fixture.totalsCalls).toEqual([
			{ orderId: ORDER, reason: 'PAYMENT_RECONCILED' },
			{ orderId: ORDER, reason: 'PAYMENT_RECONCILED' }
		]);
	});

	it('asks for it on every receipt — once for the goods, and once more when the receipt refunds', async () => {
		// A receipt moves the order's received-return counter, so it is owed a recompute whether or not
		// money moves, with the reason that names the goods. A receipt that also refunds appends a ledger
		// row on top, which is a second change to the inputs the derivation reads — so it is owed a
		// second call, and the two reasons say which move each one is answering for.
		const settling = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { quantity: '5.000000' })]
		});

		await settling.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '5' }], {
			refund: '25.00'
		});

		expect(settling.totalsCalls).toEqual([
			{ orderId: ORDER, reason: 'RETURN_RECEIVED' },
			{ orderId: ORDER, reason: 'PAYMENT_RECONCILED' }
		]);

		const restocking = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { quantity: '5.000000' })]
		});

		await restocking.service.receive('return-1', [{ lineId: 'line-1', receivedQuantity: '5' }]);

		expect(restocking.movements).toHaveLength(1);
		expect(restocking.totalsCalls).toEqual([{ orderId: ORDER, reason: 'RETURN_RECEIVED' }]);
	});

	it('asks for nothing on the transitions that append no ledger row', async () => {
		// The control that keeps the wiring honest, and the point of reading the derivation first:
		// approving, rejecting, cancelling, closing, opening and editing a return all write this package's
		// own tables and nothing the order's totals, its payment status or its fulfilment status is
		// computed from. A recompute on any of them is a version-bumping write on the order, an
		// `order_summary` row and an outbox append that buy nothing.
		const fixture = returnFixture({
			returns: [
				returnRow('opened', { status: OrderReturnStatus.OPEN }),
				returnRow('requested', { status: OrderReturnStatus.REQUESTED }),
				returnRow('approved', { status: OrderReturnStatus.APPROVED }),
				returnRow('received', { status: OrderReturnStatus.RECEIVED })
			],
			lines: [lineRow('line-1', { quantity: '5.000000' })]
		});

		await fixture.service.create({
			orderId: ORDER,
			currency: 'USD',
			lines: [{ orderLineId: ORDER_LINE, quantity: 2 }]
		} as never);
		await fixture.service.update('requested', { note: 'a corrected note' } as never);
		await fixture.service.approve('requested', 'approved by the desk');
		await fixture.service.reject('opened', 'outside the window');
		await fixture.service.cancel('approved', 'customer changed their mind');
		await fixture.service.close('received');

		expect(fixture.totalsCalls).toEqual([]);
	});

	it('asks for nothing when the refund itself was refused', async () => {
		// The call sits after the write, not before it: a return that has received nothing is refused
		// before any money moves, and a recompute ordered before that check would refresh the order for a
		// refund the service is about to decline.
		const fixture = returnFixture({ returns: [returnRow('open', { status: OrderReturnStatus.OPEN })] });

		await expect(fixture.service.refund('open', '10.00')).rejects.toThrow(/nothing has been received/);

		expect(fixture.totalsCalls).toEqual([]);
	});

	it('does not answer a recorded refund as a failure when the recompute fails', async () => {
		// The ordering the money makes unavoidable: the provider has been asked for the money and the
		// refund row exists before the recompute runs, so raising here would tell the caller its refund
		// failed. The refund route carries no retry key, so the caller's retry would issue it twice — and
		// stale derived columns, which the order package's daily reconciliation re-derives, are the
		// smaller error. The attempt is still made, which is what the assertion on the calls records.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.RECEIVED })],
			totalsFail: true
		});

		await expect(fixture.service.refund('return-1', '10.00')).resolves.toMatchObject({
			refundId: 'refund-1',
			amount: '10.000000'
		});
		expect(fixture.refundCalls).toHaveLength(1);
		expect(fixture.returnRow('return-1')?.refundAmount).toBe('10.000000');
		// The attempt is still recorded, so the claim is "the failure was not reported" rather than "the
		// call was skipped".
		expect(fixture.totalsCalls).toEqual([{ orderId: ORDER, reason: 'PAYMENT_RECONCILED' }]);
	});

	it('takes a return and refunds it when no order capability is registered', async () => {
		// The port is optional, like the four beside it: a tenant that composes the returns plugin without
		// the order plugin still receives goods and pays money back, and the order's own columns are then
		// the order package's to bring up to date.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.RECEIVED })],
			withTotals: false
		});

		await expect(fixture.service.refund('return-1', '10.00')).resolves.toMatchObject({ amount: '10.000000' });
		expect(fixture.refundCalls).toHaveLength(1);
		expect(fixture.totalsCalls).toEqual([]);
	});

	it('asks for nothing when the return names no order, which no stored return can do', async () => {
		// `order_return.orderId` is a non-null foreign key, so this is a shape the database refuses rather
		// than one a caller can reach. It is asserted because the guard is what keeps a corrupt row from
		// asking the order capability to recompute a null identifier.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.RECEIVED, orderId: undefined })]
		});

		await fixture.service.refund('return-1', '10.00');

		expect(fixture.refundCalls).toHaveLength(1);
		expect(fixture.totalsCalls).toEqual([]);
	});
});

describe('OrderReturnService — closing (doc 10 §11.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('closes a fully received return', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.RECEIVED })],
			lines: [lineRow('line-1', { quantity: '5.000000', receivedQuantity: '5.000000' })]
		});

		const closed = await fixture.service.close('return-1');

		expect(closed.status).toBe(OrderReturnStatus.CLOSED);
		expect(closed.closedAt).toBeInstanceOf(Date);
	});

	it('closes an already closed return as a no-op rather than as an error', async () => {
		// The outcome the caller wanted has already happened; a second close is the same answer.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.CLOSED, closedAt: new Date(0) })]
		});

		const closed = await fixture.service.close('return-1');

		expect(closed.status).toBe(OrderReturnStatus.CLOSED);
		expect(closed.closedAt).toEqual(new Date(0));
	});

	it('refuses to close a return that has received nothing', async () => {
		const fixture = returnFixture({ returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })] });

		await expect(fixture.service.close('return-1')).rejects.toThrow(
			/cannot close; expected RECEIVED or PARTIALLY_RECEIVED/
		);
		expect(fixture.returnRow('return-1')?.closedAt).toBeUndefined();
	});

	it('refuses to close a received return whose lines are short of what was requested', async () => {
		// The lines, not the header, are what the closure reads: a header that says `RECEIVED` while a
		// line still owes units is a return that would close with goods outstanding.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.RECEIVED })],
			lines: [lineRow('line-1', { quantity: '5.000000', receivedQuantity: '3.000000', damagedQuantity: '1.000000' })]
		});

		await expect(fixture.service.close('return-1')).rejects.toThrow(/still has lines that were not fully received/);
		expect(fixture.returnRow('return-1')?.closedAt).toBeUndefined();
	});

	it('counts a damaged unit towards the request when it decides whether a line is complete', async () => {
		// A unit that arrived broken still arrived, so a line of five with four sound and one damaged is
		// a line that is fully accounted for.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.PARTIALLY_RECEIVED })],
			lines: [lineRow('line-1', { quantity: '5.000000', receivedQuantity: '4.000000', damagedQuantity: '1.000000' })]
		});

		await expect(fixture.service.close('return-1')).resolves.toMatchObject({ status: OrderReturnStatus.CLOSED });
	});

	// The defect: `close` refuses a return whose lines are short of what was requested, which makes the
	// documented short close unreachable. Doc 10 §11.1 gives the transition twice — the diagram's
	// `PARTIALLY_RECEIVED --> CLOSED : short close after the receive window` and the guard table's
	// "`RECEIVED` or `PARTIALLY_RECEIVED` → `CLOSED` ... or job `return-short-close` (daily) when
	// `receivedAt` is older than `settings.returns.receiveWindowDays`". §11.7 names the same state:
	// "`CLOSED` | unchanged since receipt | refund confirmed". (`order-return.service.ts`: the refusal
	// is kept for a header that claims `RECEIVED` while a line still owes units, and a
	// `PARTIALLY_RECEIVED` return closes short with the remainder written to `metadata.shortClose`.)
	it('closes a partly received return short, leaving the remainder abandoned', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.PARTIALLY_RECEIVED })],
			lines: [lineRow('line-1', { quantity: '5.000000', receivedQuantity: '3.000000' })]
		});

		const closed = await fixture.service.close('return-1');

		expect(closed).toMatchObject({ status: OrderReturnStatus.CLOSED });
		expect(closed.closedAt).toBeInstanceOf(Date);
	});
});

describe('OrderReturnService — reading a return with everything a detail view shows', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('reads the return, and refuses one that is not the caller’s', async () => {
		const fixture = returnFixture({
			returns: [returnRow('mine'), returnRow('theirs', { organizationId: OTHER_ORG })]
		});

		await expect(fixture.service.findOneDetailed('mine')).resolves.toMatchObject({ id: 'mine' });
		await expect(fixture.service.findOneDetailed('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneDetailed('no-such-return')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('delegates a line rewrite to the service that owns the ceiling', async () => {
		// One writer of return lines, and the ceiling lives in it: a caller holding the return edits it
		// without reaching for another service, and without a second copy of the rule.
		const fixture = returnFixture({ returns: [returnRow('return-1')], lines: [] });

		const written = await fixture.service.replaceLines('return-1', [
			{ orderLineId: ORDER_LINE, quantity: '3' }
		]);

		expect(written).toHaveLength(1);
		expect(fixture.tables.order_return_line.filter((row) => !row.deletedAt)).toHaveLength(1);

		await expect(
			fixture.service.replaceLines('return-1', [{ orderLineId: ORDER_LINE, quantity: '6' }])
		).rejects.toThrow(/would exceed/);
	});
});

describe('OrderReturnService — the versioned write (the aggregate’s optimistic lock)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('moves the version on in the same statement that checks it', async () => {
		// The comparison and the write are one statement, so there is no window between deciding and
		// acting: the caller states version 3, and the write it earns leaves the return at 4.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { version: 3, status: OrderReturnStatus.REQUESTED })]
		});

		const approved = await fixture.service.approve('return-1', 'looks fine', {
			wildcard: false,
			versions: [3]
		});

		expect(approved).toMatchObject({ status: OrderReturnStatus.APPROVED, version: 4 });
	});

	it('refuses a write whose version moved on, and leaves the return exactly as it was', async () => {
		// The failure this exists for: the caller read version 3, someone else wrote version 4, and the
		// caller's write is refused rather than erasing the change it never saw.
		//
		// The refusal is the *central* one. The version travels in the criteria the ordinary `update` runs
		// with, the statement matches no row there, and the kernel reads the conflict from the affected-row
		// count — the service adds no classification of its own below it.
		const fixture = returnFixture({
			returns: [
				returnRow('return-1', {
					version: 4,
					status: OrderReturnStatus.REQUESTED,
					note: 'the other operator’s note'
				})
			]
		});

		await expect(
			fixture.service.approve('return-1', 'mine', { wildcard: false, versions: [3] })
		).rejects.toMatchObject({ status: 409, code: 'ENTITY_VERSION_CONFLICT' });

		expect(fixture.updates[fixture.updates.length - 1].criteria).toEqual({
			id: 'return-1',
			version: 3,
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(fixture.returnRow('return-1')).toMatchObject({
			status: OrderReturnStatus.REQUESTED,
			note: 'the other operator’s note',
			version: 4
		});
		expect(fixture.returnRow('return-1')?.approvedAt).toBeUndefined();
	});

	it('tells a return that is gone apart from one that moved on', async () => {
		// A return that no longer exists is answered before any write is attempted, because the service
		// reads the row it is about to move; a version that moved on is the conflict the conditional
		// update answers, which is the case above.
		const fixture = returnFixture({ returns: [] });

		await expect(
			fixture.service.close('no-such-return', { wildcard: false, versions: [3] })
		).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.updates).toEqual([]);
	});

	it('predicates a write the platform makes on its own behalf on the version the row holds', async () => {
		// A caller inside the platform states no version, and the write is still conditional: the version
		// it read is the one the statement is predicated on, and it is moved on by the same statement.
		const fixture = returnFixture({ returns: [returnRow('return-1', { version: 7 })] });

		const approved = await fixture.service.approve('return-1');

		expect(approved.version).toBe(8);
	});

	it('writes one return twice in a single request, each write under the version the last one produced', async () => {
		// A receipt that refunds is two writes of one aggregate in one request: the status moves the
		// version to 2, and the refund is predicated on 2 rather than on the 1 the caller stated — which
		// the receipt has already spent. Reusing the stated version would refuse the refund of a receipt
		// that had in fact landed.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { version: 1, status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { quantity: '5.000000' })]
		});

		const outcome = await fixture.service.receive(
			'return-1',
			[{ lineId: 'line-1', receivedQuantity: '5' }],
			{ refund: '50.00' },
			{ wildcard: false, versions: [1] }
		);

		expect(outcome).toMatchObject({
			status: OrderReturnStatus.RECEIVED,
			version: 3
		});
		expect(fixture.returnRow('return-1')).toMatchObject({ version: 3, refundAmount: '50.000000' });
	});

	it('writes an edit of the header under the version the caller read', async () => {
		const fixture = returnFixture({ returns: [returnRow('return-1', { version: 2 })] });

		const edited = await fixture.service.applyVersionedUpdate(
			'return-1',
			{ note: 'customer asked for a different drop-off' },
			{ wildcard: false, versions: [2] }
		);

		expect(edited).toMatchObject({ note: 'customer asked for a different drop-off', version: 3 });

		await expect(
			fixture.service.applyVersionedUpdate('return-1', { note: 'again' }, {
				wildcard: false,
				versions: [2]
			})
		).rejects.toMatchObject({ status: 409, code: 'ENTITY_VERSION_CONFLICT' });
	});

	it('moves the version on for an edit that only rewrites the line set', async () => {
		// The lines are part of the aggregate: an edit that changes none of the header's own fields still
		// changes the return, so the version has to follow it — otherwise a client holding the old tag
		// could edit the same return a second time.
		const fixture = returnFixture({ returns: [returnRow('return-1', { version: 5 })], lines: [] });

		const edited = await fixture.service.applyVersionedUpdate('return-1', {}, {
			wildcard: false,
			versions: [5]
		});

		expect(edited.version).toBe(6);
	});
});

/**
 * Retiring a return, removing it and restoring it keep the order's requested counter true (doc 10 I-12).
 *
 * `order_line.returnRequestedQuantity` is the order's cache of what its live returns ask for, and a rejection
 * or a cancellation moves it back by what the return still had outstanding. A soft delete or a removal of a
 * live return — through the inherited REST routes or the GraphQL `softDeleteOrderReturn` and
 * `deleteOrderReturn` fields, which all reach the service's own `softRemove` and `delete` — took the return out
 * of every read, and out of the ceiling this package checks a new request against, while the order kept
 * counting its units: the next return of the same units then pushed the counter past what any live return
 * asks for. The resolver documents the soft delete as "the withdrawal a return needs", so it is one: the
 * outstanding units are released exactly as a withdrawal releases them, and a recovery that makes the return
 * live again asks for them again, after the ceiling says it still may.
 */
describe('OrderReturnService — retiring, removing and restoring a live return (doc 10 I-12)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => {
		jest.restoreAllMocks();
		mockOrm.type = 'typeorm';
	});

	/** An approved return of five whose goods came back as one sound and one broken unit: three are outstanding. */
	const partlyReceived = () => ({
		returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED, version: 1 })],
		lines: [lineRow('line-1', { quantity: '5.000000', receivedQuantity: '1.000000', damagedQuantity: '1.000000' })]
	});

	it('gives back what a retired return still asked for, and asks for it again when it is restored', async () => {
		const fixture = returnFixture(partlyReceived());

		const retired = await fixture.service.softRemove('return-1');

		// The two units that came back stay asked for: they are on the received counter, which I-12 bounds by
		// this one.
		expect(fixture.recordedRequests).toEqual([
			{ orderId: ORDER, moves: [{ orderLineId: ORDER_LINE, quantityDelta: '-3.000000' }] }
		]);
		expect(retired.deletedAt).toBeInstanceOf(Date);
		// The retirement is a write of the aggregate, predicated on the version and the status it was decided
		// from, and it moves the version on as every other write of the header does.
		expect(fixture.returnRow('return-1')).toMatchObject({ status: OrderReturnStatus.APPROVED, version: 2 });
		expect(fixture.updates[fixture.updates.length - 1].criteria).toMatchObject({
			id: 'return-1',
			status: OrderReturnStatus.APPROVED,
			version: 1
		});

		const restored = await fixture.service.softRecover('return-1');

		expect(fixture.recordedRequests.map((call) => call.moves)).toEqual([
			[{ orderLineId: ORDER_LINE, quantityDelta: '-3.000000' }],
			[{ orderLineId: ORDER_LINE, quantityDelta: '3.000000' }]
		]);
		expect(restored.deletedAt ?? null).toBeNull();
		expect(fixture.returnRow('return-1')?.deletedAt ?? null).toBeNull();
	});

	it('gives back what a removed return still asked for', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.REQUESTED })],
			lines: [lineRow('line-1', { quantity: '5.000000' })]
		});

		await fixture.service.delete('return-1');

		expect(fixture.recordedRequests).toEqual([
			{ orderId: ORDER, moves: [{ orderLineId: ORDER_LINE, quantityDelta: '-5.000000' }] }
		]);
		expect(fixture.returnRow('return-1')).toBeUndefined();
	});

	it('moves nothing for a return that no longer counts, whichever way it is retired or restored', async () => {
		// A rejected or cancelled return gave its units back when it was withdrawn; giving them back again would
		// subtract units another return of the same line asks for.
		const fixture = returnFixture({
			returns: [
				returnRow('rejected', { status: OrderReturnStatus.REJECTED }),
				returnRow('canceled', { status: OrderReturnStatus.CANCELED })
			],
			lines: [
				lineRow('line-1', { returnId: 'rejected', quantity: '5.000000' }),
				lineRow('line-2', { returnId: 'canceled', quantity: '3.000000' })
			]
		});

		await fixture.service.softRemove('rejected');
		await fixture.service.softRecover('rejected');
		await fixture.service.delete('canceled');

		expect(fixture.recordedRequests).toEqual([]);
		expect(fixture.returnRow('rejected')?.deletedAt ?? null).toBeNull();
		expect(fixture.returnRow('canceled')).toBeUndefined();
	});

	it('removes a retired return without giving its units back a second time', async () => {
		// Its retirement gave the units back; the removal of the retired row has nothing left to release.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED, deletedAt: new Date() })],
			lines: [lineRow('line-1', { quantity: '5.000000' })]
		});

		await fixture.service.delete('return-1');

		expect(fixture.recordedRequests).toEqual([]);
		expect(fixture.returnRow('return-1')).toBeUndefined();
	});

	it('refuses to restore a return whose units another return has asked for since, and asks for nothing', async () => {
		const fixture = returnFixture({
			returns: [
				returnRow('return-1', { status: OrderReturnStatus.APPROVED, deletedAt: new Date() }),
				returnRow('return-2', { status: OrderReturnStatus.OPEN })
			],
			lines: [
				lineRow('line-1', { returnId: 'return-1', quantity: '4.000000' }),
				lineRow('line-2', { returnId: 'return-2', quantity: '3.000000' })
			]
		});

		// Five shipped, three are asked back by the live return: restoring four more would ask back seven.
		await expect(fixture.service.softRecover('return-1')).rejects.toThrow(/would exceed the 5\.000000/);

		expect(fixture.recordedRequests).toEqual([]);
		expect(fixture.returnRow('return-1')?.deletedAt).toBeInstanceOf(Date);
	});

	it('puts the units back when the retirement is refused, so a withdrawal in flight is not counted twice', async () => {
		// Another operator cancels the return between this retirement's read and its write. The cancellation
		// gave the units back; the retirement's write is predicated on the version and the status it read, so
		// it changes no row, and its own release is undone.
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED, version: 1 })],
			lines: [lineRow('line-1', { quantity: '5.000000' })],
			beforeRequestMove: (moves, tables) => {
				const row = tables.order_return[0];

				if (row.status === OrderReturnStatus.APPROVED && moves[0]?.quantityDelta.startsWith('-')) {
					Object.assign(row, { status: OrderReturnStatus.CANCELED, version: 2 });
				}
			}
		});

		await expect(fixture.service.softRemove('return-1')).rejects.toMatchObject({
			status: 409,
			code: 'ENTITY_VERSION_CONFLICT'
		});

		expect(fixture.recordedRequests.map((call) => call.moves)).toEqual([
			[{ orderLineId: ORDER_LINE, quantityDelta: '-5.000000' }],
			[{ orderLineId: ORDER_LINE, quantityDelta: '5.000000' }]
		]);
		expect(fixture.returnRow('return-1')).toMatchObject({ status: OrderReturnStatus.CANCELED, version: 2 });
		expect(fixture.returnRow('return-1')?.deletedAt).toBeUndefined();
	});

	it('refuses a removal whose return moved on after it was read, and puts the units back', async () => {
		const fixture = returnFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED, version: 1 })],
			lines: [lineRow('line-1', { quantity: '5.000000' })],
			beforeRequestMove: (moves, tables) => {
				if (moves[0]?.quantityDelta.startsWith('-')) {
					tables.order_return[0].version = 2;
				}
			}
		});

		await expect(fixture.service.delete('return-1')).rejects.toMatchObject({
			status: 409,
			code: 'ENTITY_VERSION_CONFLICT'
		});

		expect(fixture.recordedRequests.map((call) => call.moves)).toEqual([
			[{ orderLineId: ORDER_LINE, quantityDelta: '-5.000000' }],
			[{ orderLineId: ORDER_LINE, quantityDelta: '5.000000' }]
		]);
		expect(fixture.returnRow('return-1')).toBeDefined();
	});

	it('does not find a return of another organization, and moves nothing of it', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);
		const fixture = returnFixture(partlyReceived());

		await expect(fixture.service.softRemove('return-1')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.delete('return-1')).rejects.toBeInstanceOf(NotFoundException);

		expect(fixture.recordedRequests).toEqual([]);
		expect(fixture.returnRow('return-1')).toMatchObject({ version: 1 });
		expect(fixture.returnRow('return-1')?.deletedAt).toBeUndefined();
	});

	it('reads the return and its lines through the configured ORM on MikroORM', async () => {
		const fixture = returnFixture({ ...partlyReceived(), orm: 'mikro-orm' });

		await fixture.service.softRemove('return-1');
		await fixture.service.softRecover('return-1');

		expect(fixture.recordedRequests.map((call) => call.moves)).toEqual([
			[{ orderLineId: ORDER_LINE, quantityDelta: '-3.000000' }],
			[{ orderLineId: ORDER_LINE, quantityDelta: '3.000000' }]
		]);
		// Under MikroORM the TypeORM entities carry their base columns alone, so a read through a TypeORM
		// repository would answer rows with no status, no quantities and no tenant.
		expect(fixture.typeOrmReads()).toEqual([]);
		expect(fixture.mikroOrmReads().length).toBeGreaterThan(0);
	});
});
