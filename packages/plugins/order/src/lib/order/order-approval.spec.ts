/**
 * Placing a buyer's order for a staff member's approval, and the decision that follows it.
 *
 * `@gauzy/core`'s barrel and `@gauzy/plugin-cart`'s barrel are doubled at the module boundary exactly as the
 * neighbouring suites do, and **the services under test are the real ones**: the order service, the totals
 * writer every move ends in, the line, shipping, summary and timeline services, over one in-memory
 * datastore. The one seam that reaches another package — the platform's approval machinery — is doubled
 * with the port's contract; the adapter that answers it over the core approval service has its own suite.
 *
 * The tenant-aware read is doubled with its tenant criterion, because that criterion is what keeps one
 * tenant's order out of another tenant's request.
 */
jest.mock('@gauzy/plugin-cart', () => ({
	TotalsCalculator: jest.requireActual('@gauzy/plugin-cart/src/lib/totals/totals-calculator').TotalsCalculator
}));

/** The request the suite runs under: its tenant, and the grants its role carries. */
const mockCaller: { tenantId: string | null; organizationId: string | null; permissions: Set<string> } = {
	tenantId: 'tenant-1',
	organizationId: 'organization-1',
	permissions: new Set()
};

jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class CrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}
	}

	class TenantAwareCrudService extends CrudService {
		async findAll(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		/** The real read states the caller's tenant as a criterion; so does this one. */
		async findOneByIdString(id: any, options: any = {}): Promise<any> {
			const record = await this.typeOrmRepository.findOne({
				...options,
				where: {
					...(options.where ?? {}),
					id,
					...(mockCaller.tenantId ? { tenantId: mockCaller.tenantId } : {})
				}
			});

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
	}

	return {
		quoteIdentifier: (identifier: string) => `"${identifier}"`,
		prepareSQLQuery: (query: string) => query,
		...jest.requireActual('@gauzy/core/src/lib/money/decimal'),
		CrudService,
		TenantAwareCrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		Idempotent: decorator,
		Versioned: decorator,
		VersionedColumn: decorator,
		commitVersionedUpdate: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.commitVersionedUpdate,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		ApiException: jest.requireActual('@gauzy/core/src/lib/core/errors/api-exception').ApiException,
		ApiErrorCode: jest.requireActual('@gauzy/core/src/lib/core/errors/api-error-codes').ApiErrorCode,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => mockCaller.tenantId,
			currentOrganizationId: () => mockCaller.organizationId,
			currentEmployeeId: () => null,
			hasPermission: (permission: string) => mockCaller.permissions.has(permission)
		},
		AdjustmentService: class {},
		TaxLineService: class {},
		SequenceService: class {}
	};
});

import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
	AdjustmentOwnerType,
	FulfillmentStatus,
	OrderChangeStatus,
	OrderPaymentStatus,
	OrderStatus,
	TaxLineOwnerType
} from '@gauzy/contracts';
import { OrderAddressService } from '../order-address/order-address.service';
import { OrderCreditLineService } from '../order-credit-line/order-credit-line.service';
import { OrderHistoryService } from '../order-history/order-history.service';
import { OrderLineService } from '../order-line/order-line.service';
import { OrderShippingMethodService } from '../order-shipping-method/order-shipping-method.service';
import { OrderSummaryService } from '../order-summary/order-summary.service';
import { OrderTotalsService } from '../order-totals/order-totals.service';
import { OrderTransactionService } from '../order-transaction/order-transaction.service';
import { OrderStateMachine } from '../order-state-machine/order-state-machine';
import { OrderLineKind } from '../order.types';
import { OrderService } from './order.service';

type TableName =
	| 'order'
	| 'order_line'
	| 'order_shipping_method'
	| 'order_address'
	| 'order_credit_line'
	| 'order_transaction'
	| 'order_history'
	| 'order_summary';

const TABLES: TableName[] = [
	'order',
	'order_line',
	'order_shipping_method',
	'order_address',
	'order_credit_line',
	'order_transaction',
	'order_history',
	'order_summary'
];

/** An in-memory stand-in for one table's TypeORM repository. */
function repository(tables: Record<string, any[]>, tableName: TableName) {
	let sequence = 0;
	const rows = () => tables[tableName];
	const matches = (row: any, where: any): boolean =>
		Object.entries(where ?? {}).every(
			([field, expected]) => expected === undefined || String(row[field] ?? '') === String(expected)
		);

	return {
		rows,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		// Every read answers a copy, as a database does: a caller holding a row it read must not see another
		// writer's change appear in it.
		find: async (options: any = {}) =>
			rows()
				.filter((row) => matches(row, options.where))
				.map((row) => ({ ...row })),
		findOne: async (options: any = {}) => {
			const row = rows().find((candidate) => matches(candidate, options.where));

			return row ? { ...row } : null;
		},
		findOneBy: async (where: any) => {
			const row = rows().find((candidate) => matches(candidate, where));

			return row ? { ...row } : null;
		},
		findAndCount: async (options: any = {}) => {
			const items = rows()
				.filter((row) => matches(row, options.where))
				.map((row) => ({ ...row }));

			return [items, items.length];
		},
		create: (partial: any) => ({ ...partial }),
		save: async (entity: any) => {
			const created = { id: `${tableName}-new-${++sequence}`, ...entity };

			rows().push(created);

			return created;
		},
		update: async (criteria: any, partial: any) => {
			const index = rows().findIndex((row) =>
				matches(row, typeof criteria === 'string' ? { id: criteria } : criteria)
			);

			if (index >= 0) {
				Object.assign(rows()[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async () => ({ affected: 0 })
	};
}

/** One line of an order, with every counter the totals writer sums. */
const line = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	orderId: 'order-1',
	tenantId: 'tenant-1',
	organizationId: 'organization-1',
	title: `Line ${id}`,
	quantity: 1,
	unitPrice: 0,
	originalUnitPrice: 0,
	isTaxInclusive: false,
	isDiscountable: true,
	requiresShipping: true,
	kind: OrderLineKind.ITEM,
	fulfilledQuantity: 0,
	shippedQuantity: 0,
	deliveredQuantity: 0,
	returnRequestedQuantity: 0,
	returnReceivedQuantity: 0,
	returnDismissedQuantity: 0,
	writtenOffQuantity: 0,
	...overrides
});

/**
 * The platform's approval machinery, in memory: what the approval port files, finds and decides.
 *
 * `status` follows the platform's own codes: 1 requested, 2 approved, 3 refused.
 */
function approvalPort() {
	const requests: any[] = [];

	return {
		requests,
		requestApproval: jest.fn(async (request: any) => {
			const row = { id: `approval-${requests.length + 1}`, ...request, status: 1 };

			requests.push(row);

			return { approvalId: row.id };
		}),
		findOpen: jest.fn(async (orderId: string) => {
			const open = requests.find((request) => request.orderId === orderId && request.status === 1);

			return open ? { approvalId: open.id } : null;
		}),
		settle: jest.fn(async (orderId: string, approved: boolean) => {
			const open = requests.filter((request) => request.orderId === orderId && request.status === 1);

			for (const request of open) {
				request.status = approved ? 2 : 3;
			}

			return open.length;
		})
	};
}

/** A draft order with two priced lines — `0.1 × 3` and a tax-inclusive `0.2 × 2` — a delivery choice and its tax. */
function fixture(options: { order?: Record<string, unknown>; port?: boolean } = {}) {
	const tables: Record<string, any[]> = {};

	for (const table of TABLES) {
		tables[table] = [];
	}

	tables.order.push({
		id: 'order-1',
		tenantId: 'tenant-1',
		organizationId: 'organization-1',
		number: 'ORD-000123',
		channelId: 'channel-1',
		customerId: 'contact-1',
		email: 'buyer@example.com',
		currency: 'USD',
		currencyDecimals: 2,
		status: OrderStatus.DRAFT,
		isDraft: true,
		isTest: false,
		paymentStatus: OrderPaymentStatus.NOT_PAID,
		fulfillmentStatus: FulfillmentStatus.NOT_FULFILLED,
		paidTotal: 0,
		version: 3,
		...options.order
	});
	tables.order_line.push(
		line('line-1', { title: 'Widget', quantity: 3, unitPrice: 0.1 }),
		line('line-2', { title: 'Gadget', quantity: 2, unitPrice: 0.2, isTaxInclusive: true }),
		line('line-3', { title: 'Heading', kind: OrderLineKind.SECTION, quantity: 0, unitPrice: 0 })
	);
	tables.order_shipping_method.push({ id: 'shipping-1', orderId: 'order-1', name: 'Courier', amount: 5 });

	const taxLines: Record<string, any[]> = {
		[`${TaxLineOwnerType.ORDER_LINE}:line-2`]: [{ amount: 0.04 }],
		[`${TaxLineOwnerType.ORDER_SHIPPING}:shipping-1`]: [{ amount: 0.5 }]
	};
	const adjustments: Record<string, any[]> = {
		[`${AdjustmentOwnerType.ORDER_LINE}:line-1`]: [{ amount: -0.05, isTaxInclusive: false }]
	};

	const repo = (table: TableName) => repository(tables, table);
	const typeOrmOrderRepository = repo('order');
	const orderWriter = {
		update: async (criteria: any, partial: any) => typeOrmOrderRepository.update(criteria, partial),
		findOneByIdString: async (id: any) => typeOrmOrderRepository.findOne({ where: { id } })
	};
	const lineService = new OrderLineService(repo('order_line') as never, {} as never, {} as never);
	const shippingService = new OrderShippingMethodService(repo('order_shipping_method') as never, {} as never);
	const outbox = { append: jest.fn() };
	const totalsService = new OrderTotalsService(
		typeOrmOrderRepository as never,
		lineService as never,
		shippingService as never,
		new OrderCreditLineService(repo('order_credit_line') as never, {} as never) as never,
		new OrderTransactionService(repo('order_transaction') as never, {} as never) as never,
		new OrderSummaryService(repo('order_summary') as never, {} as never) as never,
		{ findByOwner: async (type: string, id: string) => adjustments[`${type}:${id}`] ?? [] } as never,
		{ findByOwner: async (type: string, id: string) => taxLines[`${type}:${id}`] ?? [] } as never,
		outbox as never,
		{ get: () => orderWriter } as never
	);
	const port = approvalPort();
	const service = new OrderService(
		typeOrmOrderRepository as never,
		{} as never,
		totalsService,
		lineService,
		new OrderAddressService(repo('order_address') as never, {} as never),
		shippingService,
		new OrderHistoryService(repo('order_history') as never, {} as never),
		{ findOpenForOrder: jest.fn(async () => []) } as never,
		{ allocate: jest.fn() } as never,
		options.port === false ? undefined : (port as never)
	);

	return { service, tables, port, outbox, order: () => tables.order[0] };
}

/** The timeline of the fixture order. */
const timelineOf = (built: ReturnType<typeof fixture>) => built.tables.order_history.map((entry: any) => entry.action);

/** An expectation that names one version, as the guard leaves an `If-Match` on the request. */
const at = (version: number) => ({ wildcard: false, versions: [version] });

beforeEach(() => {
	mockCaller.tenantId = 'tenant-1';
	mockCaller.organizationId = 'organization-1';
});

afterEach(() => jest.restoreAllMocks());

describe('OrderService.requestApproval — a buyer places a draft for a staff member’s approval', () => {
	it('places the draft through the state machine and files the request against it', async () => {
		const built = fixture();
		const transition = jest.spyOn(OrderStateMachine, 'transition');

		const requested = await built.service.requestApproval('order-1', 'Please approve before Friday', at(3));

		// The lifecycle has no "awaiting approval" status: the move is placeOrder's own, DRAFT -> PENDING.
		expect(transition.mock.calls.map(([from, to]) => [from.status, to])).toEqual([
			[OrderStatus.DRAFT, OrderStatus.PENDING]
		]);
		expect(requested).toMatchObject({ version: 4, approvalId: 'approval-1' });
		expect(requested.order).toMatchObject({ status: OrderStatus.PENDING, isDraft: false, version: 4 });

		// The request names the order through the polymorphic pair, and states the value a policy is applied to.
		expect(built.port.requestApproval).toHaveBeenCalledWith({
			orderId: 'order-1',
			organizationId: 'organization-1',
			name: 'Order ORD-000123',
			amount: 6.15,
			currency: 'USD',
			note: 'Please approve before Friday'
		});
		expect(timelineOf(built)).toEqual(['ORDER_PLACED', 'ORDER_APPROVAL_REQUESTED']);
		expect(built.tables.order_history[1].metadata).toEqual({
			approvalId: 'approval-1',
			note: 'Please approve before Friday'
		});
		expect(
			built.outbox.append.mock.calls.map(([, event]: any[]) => [event.name, event.data.approvalRequested])
		).toEqual([['order.placed', true]]);
	});

	it('is approved with the existing approve route: the staff confirmation decides the request', async () => {
		const built = fixture();
		await built.service.requestApproval('order-1', undefined, at(3));

		const confirmed = await built.service.confirm('order-1', 'STAFF', at(4));

		expect(confirmed).toMatchObject({ status: OrderStatus.CONFIRMED, version: 5 });
		expect(built.port.settle).toHaveBeenCalledWith('order-1', true);
		expect(built.port.requests[0].status).toBe(2);
		expect(timelineOf(built)).toEqual([
			'ORDER_PLACED',
			'ORDER_APPROVAL_REQUESTED',
			'ORDER_CONFIRMED',
			'ORDER_APPROVAL_APPROVED'
		]);
	});

	it('is refused by a cancellation, and a system confirmation never touches a request', async () => {
		const built = fixture();
		await built.service.requestApproval('order-1', undefined, at(3));

		await built.service.cancel('order-1', 'Not approved', at(4));

		expect(built.port.settle).toHaveBeenCalledWith('order-1', false);
		expect(built.port.requests[0].status).toBe(3);
		expect(timelineOf(built)).toContain('ORDER_APPROVAL_REFUSED');

		// The checkout path confirms as SYSTEM: an order that was never held for approval is not looked up.
		const checkout = fixture({ order: { status: OrderStatus.PENDING, isDraft: false } });
		await checkout.service.confirm('order-1', 'SYSTEM', at(3));
		expect(checkout.port.settle).not.toHaveBeenCalled();
	});

	it('files a request for a placed order that has none, without moving its status', async () => {
		const built = fixture({ order: { status: OrderStatus.PENDING, isDraft: false } });
		const transition = jest.spyOn(OrderStateMachine, 'transition');

		const requested = await built.service.requestApproval('order-1', undefined, at(3));

		expect(transition).not.toHaveBeenCalled();
		expect(requested).toMatchObject({
			version: 4,
			approvalId: 'approval-1',
			order: { status: OrderStatus.PENDING }
		});
		expect(built.tables.order_summary.map((row: any) => [row.version, row.reason])).toEqual([
			[4, 'APPROVAL_REQUESTED']
		]);
	});

	it('refuses a second request while one awaits a decision, with 409 and nothing written', async () => {
		const built = fixture();
		await built.service.requestApproval('order-1', undefined, at(3));

		await expect(built.service.requestApproval('order-1', undefined, at(4))).rejects.toMatchObject({
			status: 409,
			response: { code: 'ORDER_APPROVAL_ALREADY_REQUESTED', details: { approvalId: 'approval-1' } }
		});
		expect(built.port.requests).toHaveLength(1);
		expect(built.order().version).toBe(4);
	});

	it.each([
		[OrderStatus.CONFIRMED, /already past/],
		[OrderStatus.REQUIRES_ACTION, /waiting on its payment/],
		[OrderStatus.CANCELED, /already past/],
		[OrderStatus.ARCHIVED, /already past/]
	])('refuses an order in %s with 409 and says why', async (status, why) => {
		const built = fixture({ order: { status, isDraft: false } });

		const refusal = await built.service.requestApproval('order-1', undefined, at(3)).catch((error) => error);

		expect(refusal).toBeInstanceOf(ConflictException);
		expect(refusal.getResponse()).toMatchObject({ code: 'ORDER_APPROVAL_NOT_REQUESTABLE', details: { status } });
		expect(refusal.getResponse().details.reason).toMatch(why);
		expect(built.port.requestApproval).not.toHaveBeenCalled();
		expect(built.order().version).toBe(3);
	});

	it('answers ORDER_APPROVAL_UNAVAILABLE before the order moves when no approval machinery is registered', async () => {
		const built = fixture({ port: false });

		await expect(built.service.requestApproval('order-1', undefined, at(3))).rejects.toBeInstanceOf(
			ServiceUnavailableException
		);
		expect(built.order()).toMatchObject({ status: OrderStatus.DRAFT, version: 3 });
		expect(timelineOf(built)).toEqual([]);
	});

	it('does not find another tenant’s order, and files nothing for it', async () => {
		const built = fixture();
		mockCaller.tenantId = 'tenant-2';

		await expect(built.service.requestApproval('order-1', undefined, at(3))).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(built.port.requestApproval).not.toHaveBeenCalled();
		expect(built.order()).toMatchObject({ status: OrderStatus.DRAFT, version: 3 });
	});

	it('refuses a stale version with the conflict, and files nothing', async () => {
		const built = fixture();

		await expect(built.service.requestApproval('order-1', undefined, at(2))).rejects.toMatchObject({
			code: 'ENTITY_VERSION_CONFLICT'
		});
		expect(built.port.requestApproval).not.toHaveBeenCalled();
		expect(built.order()).toMatchObject({ status: OrderStatus.DRAFT, version: 3 });
	});

	it('leaves a placed order a request can still be filed for when filing fails, and files it on the retry', async () => {
		const built = fixture();
		built.port.requestApproval.mockRejectedValueOnce(new Error('approval store unavailable'));

		await expect(built.service.requestApproval('order-1', undefined, at(3))).rejects.toThrow(
			/approval store unavailable/
		);
		expect(built.order()).toMatchObject({ status: OrderStatus.PENDING, version: 4 });

		await expect(built.service.requestApproval('order-1', undefined, at(4))).resolves.toMatchObject({
			approvalId: 'approval-1',
			order: { status: OrderStatus.PENDING }
		});
	});

	it('never fails a confirmation over a request it could not decide', async () => {
		const built = fixture({ order: { status: OrderStatus.PENDING, isDraft: false } });
		built.port.settle.mockRejectedValueOnce(new Error('approval store unavailable'));
		jest.spyOn((built.service as any).logger, 'warn').mockImplementation(() => undefined);

		await expect(built.service.confirm('order-1', 'STAFF', at(3))).resolves.toMatchObject({
			status: OrderStatus.CONFIRMED
		});
		expect((built.service as any).logger.warn).toHaveBeenCalledWith(
			expect.stringMatching(/ORDER_APPROVAL_SETTLE_FAILED/)
		);
	});
});
