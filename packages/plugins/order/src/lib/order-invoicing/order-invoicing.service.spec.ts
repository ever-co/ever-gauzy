/**
 * The bridge from an order to the accounting documents that bill it.
 *
 * `@gauzy/core`'s barrel boots the whole application graph, and `@gauzy/plugin-cart`'s barrel reaches every
 * commerce package, so both are doubled at the module boundary exactly as the neighbouring suites do —
 * and **the services under test are the real ones**: the order service, the totals writer every write ends
 * in, the line, shipping, summary and timeline services, over one in-memory datastore. The two seams that
 * reach another package are doubled: the invoicing port (the platform's finance document) and the line
 * invoice register (whose own suite drives its transaction).
 *
 * The tenant-aware read is doubled **with its tenant criterion**, because that criterion is the whole of
 * what keeps one tenant's order out of another tenant's request, and a double without it would let a
 * cross-tenant case pass for the wrong reason.
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

import { ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
	AdjustmentOwnerType,
	FulfillmentStatus,
	OrderPaymentStatus,
	OrderStatus,
	PermissionsEnum,
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
import { OrderService } from '../order/order.service';
import { OrderLineInvoiceDirection, OrderLineKind } from '../order.types';
import { OrderInvoicingService } from './order-invoicing.service';

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
 * The finance document, in memory: what the invoicing port writes, numbers and voids.
 *
 * It is the port's contract, not the core invoice service: the adapter that answers the port over the core
 * service has its own suite.
 */
function invoicingPort() {
	const documents = new Map<string, any>();
	let number = 100;

	return {
		documents,
		issue: jest.fn(async (document: any) => {
			const invoiceNumber = ++number;
			const invoiceId = `invoice-${invoiceNumber}`;

			documents.set(invoiceId, { ...document, invoiceId, invoiceNumber, status: 'DRAFT', isAccepted: null });

			return {
				invoiceId,
				invoiceNumber,
				items: document.items.map((item: any, index: number) => ({
					key: item.key,
					invoiceItemId: `${invoiceId}-item-${index + 1}`
				}))
			};
		}),
		read: jest.fn(async (invoiceId: string) => {
			const document = documents.get(invoiceId);

			return document
				? {
						invoiceId,
						invoiceNumber: document.invoiceNumber,
						isEstimate: document.isEstimate,
						isAccepted: document.isAccepted,
						status: document.status
					}
				: null;
		}),
		voidDocument: jest.fn(async (invoiceId: string, reason: string) => {
			Object.assign(documents.get(invoiceId) ?? {}, { status: 'VOID', voidReason: reason });
		})
	};
}

/** The line invoice register, in memory: its own suite drives the transaction it records under. */
function lineInvoiceRegister() {
	const links: any[] = [];

	return {
		links,
		record: jest.fn(async (input: any) => {
			const link = { id: `link-${links.length + 1}`, ...input };

			links.push(link);

			return { link, line: {} };
		}),
		delete: jest.fn(async (id: string) => {
			const index = links.findIndex((link) => link.id === id);

			if (index >= 0) {
				links.splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		})
	};
}

/**
 * An order with three lines — two billable, one heading — a delivery choice, tax lines and a discount.
 *
 * The prices are the ones a binary double cannot add: `0.1 × 3` and `0.2 × 2`. The second line is priced
 * tax-inclusive, so its net is what the document bills and its tax is part of the order's tax.
 */
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
		status: OrderStatus.CONFIRMED,
		isDraft: false,
		isTest: false,
		paymentStatus: OrderPaymentStatus.NOT_PAID,
		fulfillmentStatus: FulfillmentStatus.NOT_FULFILLED,
		paidTotal: 0,
		version: 3,
		...options.order
	});
	tables.order_line.push(
		line('line-1', { title: 'Widget', sku: 'W-1', quantity: 3, unitPrice: 0.1, productId: 'product-1' }),
		line('line-2', { title: 'Gadget', quantity: 2, unitPrice: 0.2, isTaxInclusive: true }),
		line('line-3', { title: 'Heading', kind: OrderLineKind.SECTION, quantity: 0, unitPrice: 0 })
	);
	tables.order_shipping_method.push({
		id: 'shipping-1',
		orderId: 'order-1',
		name: 'Courier',
		amount: 5,
		isTaxInclusive: false
	});

	const taxLines: Record<string, any[]> = {
		[`${TaxLineOwnerType.ORDER_LINE}:line-1`]: [{ amount: 0.03 }],
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
	const historyService = new OrderHistoryService(repo('order_history') as never, {} as never);
	const orderService = new OrderService(
		typeOrmOrderRepository as never,
		{} as never,
		totalsService,
		lineService,
		new OrderAddressService(repo('order_address') as never, {} as never),
		shippingService,
		historyService,
		{ findOpenForOrder: jest.fn(async () => []) } as never,
		{ allocate: jest.fn() } as never
	);
	const port = invoicingPort();
	const register = lineInvoiceRegister();
	const service = new OrderInvoicingService(
		orderService,
		totalsService,
		register as never,
		historyService,
		options.port === false ? undefined : (port as never)
	);

	return { service, tables, port, register, outbox, order: () => tables.order[0] };
}

/** The timeline of the fixture order. */
const timelineOf = (built: ReturnType<typeof fixture>) => built.tables.order_history.map((entry: any) => entry.action);

/** An expectation that names one version, as the guard leaves an `If-Match` on the request. */
const at = (version: number) => ({ wildcard: false, versions: [version] });

beforeEach(() => {
	mockCaller.tenantId = 'tenant-1';
	mockCaller.organizationId = 'organization-1';
	mockCaller.permissions = new Set([PermissionsEnum.INVOICES_EDIT, PermissionsEnum.ESTIMATES_EDIT]);
});

describe('OrderInvoicingService.generateInvoice — the invoice that bills an order', () => {
	it('issues the document from the order’s own figures, exactly, and stamps the order under its version', async () => {
		const built = fixture();

		const invoiced = await built.service.generateInvoice('order-1', at(3));

		// One item per billable line — the heading carries nothing to bill — and one per delivery choice, every
		// figure as exact decimal text: `0.1 × 3` is `0.3`, not `0.30000000000000004`, and the tax-inclusive
		// line bills its net, `0.40 − 0.04`.
		expect(built.port.issue).toHaveBeenCalledTimes(1);
		const document = built.port.issue.mock.calls[0][0];

		expect(document).toMatchObject({
			isEstimate: false,
			tenantId: 'tenant-1',
			organizationId: 'organization-1',
			currency: 'USD',
			contactId: 'contact-1',
			sentTo: 'buyer@example.com',
			reference: 'ORD-000123',
			discountTotal: '0.05',
			taxTotal: '0.57',
			grandTotal: '6.18'
		});
		expect(document.items).toEqual([
			{
				key: 'line-1',
				description: 'Widget (W-1)',
				quantity: '3',
				unitPrice: '0.1',
				totalValue: '0.3',
				productId: 'product-1',
				applyTax: true,
				applyDiscount: true
			},
			{
				key: 'line-2',
				description: 'Gadget',
				quantity: '2',
				unitPrice: '0.2',
				totalValue: '0.36',
				productId: undefined,
				applyTax: true,
				applyDiscount: false
			},
			{
				key: 'shipping-1',
				description: 'Courier',
				quantity: '1',
				unitPrice: '5',
				totalValue: '5',
				applyTax: true,
				applyDiscount: false
			}
		]);

		// The order is stamped by the versioned write — one version further, one summary row that says why —
		// and its status is untouched: invoicing is not a lifecycle move.
		expect(invoiced).toMatchObject({ invoiceId: 'invoice-101', version: 4, status: OrderStatus.CONFIRMED });
		expect(built.tables.order_summary.map((row: any) => [row.version, row.reason])).toEqual([[4, 'INVOICED']]);
		expect(timelineOf(built)).toEqual(['ORDER_INVOICED']);
		expect(built.tables.order_history[0].metadata).toEqual({ invoiceId: 'invoice-101', invoiceNumber: 101 });
	});

	it('records each billed line’s link to the item that billed it, with the line’s own figures', async () => {
		const built = fixture();

		await built.service.generateInvoice('order-1', at(3));

		expect(built.register.links.map(({ id, ...link }: any) => link)).toEqual([
			{
				orderLineId: 'line-1',
				invoiceItemId: 'invoice-101-item-1',
				direction: OrderLineInvoiceDirection.INVOICE,
				quantity: '3',
				amount: '0.3',
				currency: 'USD',
				metadata: {
					source: 'ORDER_INVOICE',
					invoiceId: 'invoice-101',
					invoiceNumber: 101,
					discount: '0.05',
					tax: '0.03',
					lineTotal: '0.28'
				}
			},
			{
				orderLineId: 'line-2',
				invoiceItemId: 'invoice-101-item-2',
				direction: OrderLineInvoiceDirection.INVOICE,
				quantity: '2',
				amount: '0.36',
				currency: 'USD',
				metadata: {
					source: 'ORDER_INVOICE',
					invoiceId: 'invoice-101',
					invoiceNumber: 101,
					discount: '0',
					tax: '0.04',
					lineTotal: '0.4'
				}
			}
		]);
	});

	it('refuses an order that is already invoiced with 409, and issues nothing', async () => {
		const built = fixture({ order: { invoiceId: 'invoice-7' } });

		const refusal = await built.service.generateInvoice('order-1', at(3)).catch((error) => error);

		expect(refusal).toBeInstanceOf(ConflictException);
		expect(refusal.getStatus()).toBe(409);
		expect(refusal.getResponse()).toMatchObject({
			code: 'ORDER_ALREADY_INVOICED',
			details: { invoiceId: 'invoice-7' }
		});
		expect(built.port.issue).not.toHaveBeenCalled();
		expect(built.order()).toMatchObject({ invoiceId: 'invoice-7', version: 3 });
	});

	it.each([
		[OrderStatus.DRAFT, /not been placed/],
		[OrderStatus.CANCELED, /owes nothing/],
		[OrderStatus.ARCHIVED, /read-only/]
	])('refuses an order in %s with 409 and says why', async (status, why) => {
		const built = fixture({ order: { status } });

		const refusal = await built.service.generateInvoice('order-1', at(3)).catch((error) => error);

		expect(refusal).toBeInstanceOf(ConflictException);
		expect(refusal.getResponse()).toMatchObject({ code: 'ORDER_NOT_INVOICEABLE', details: { status } });
		expect(refusal.getResponse().details.reason).toMatch(why);
		expect(built.port.issue).not.toHaveBeenCalled();
		expect(built.order().version).toBe(3);
	});

	it('refuses a test order, which the invoice bridge excludes', async () => {
		const built = fixture({ order: { isTest: true } });

		await expect(built.service.generateInvoice('order-1', at(3))).rejects.toMatchObject({
			response: { code: 'ORDER_TEST_NOT_INVOICEABLE' }
		});
		expect(built.port.issue).not.toHaveBeenCalled();
	});

	it('requires the finance grant as well as the order grant, before anything is written', async () => {
		const built = fixture();
		mockCaller.permissions = new Set([PermissionsEnum.ESTIMATES_EDIT]);

		await expect(built.service.generateInvoice('order-1', at(3))).rejects.toBeInstanceOf(ForbiddenException);
		expect(built.port.issue).not.toHaveBeenCalled();
		expect(built.order().version).toBe(3);
	});

	it('answers ORDER_INVOICING_UNAVAILABLE when no invoicing capability is registered, before any write', async () => {
		const built = fixture({ port: false });

		await expect(built.service.generateInvoice('order-1', at(3))).rejects.toBeInstanceOf(
			ServiceUnavailableException
		);
		await expect(built.service.generateInvoice('order-1', at(3))).rejects.toThrow(/ORDER_INVOICING_UNAVAILABLE/);
		expect(built.order()).toMatchObject({ version: 3 });
		expect(built.order().invoiceId).toBeUndefined();
		expect(built.register.record).not.toHaveBeenCalled();
	});

	it('does not find another tenant’s order, and issues nothing for it', async () => {
		const built = fixture();
		mockCaller.tenantId = 'tenant-2';

		await expect(built.service.generateInvoice('order-1', at(3))).rejects.toBeInstanceOf(NotFoundException);
		expect(built.port.issue).not.toHaveBeenCalled();
		expect(built.order()).toMatchObject({ version: 3 });

		// The control: the same request under the order's own tenant is served.
		mockCaller.tenantId = 'tenant-1';
		await expect(built.service.generateInvoice('order-1', at(3))).resolves.toMatchObject({
			invoiceId: 'invoice-101'
		});
	});

	it('voids the document and withdraws the links when the stated version is stale, and answers the conflict', async () => {
		const built = fixture();

		await expect(built.service.generateInvoice('order-1', at(2))).rejects.toMatchObject({
			code: 'ENTITY_VERSION_CONFLICT'
		});

		expect(built.port.documents.get('invoice-101')).toMatchObject({ status: 'VOID' });
		expect(built.register.links).toEqual([]);
		expect(built.order()).toMatchObject({ version: 3 });
		expect(built.order().invoiceId).toBeUndefined();
		expect(timelineOf(built)).toEqual([]);
	});

	it('holds a caller that stated no version to the version it read, so a concurrent write cannot be overwritten', async () => {
		const built = fixture();
		// Another writer moves the order while the document is being issued: the version this request read is
		// no longer the order's, so its stamp is refused rather than landing on an order it never checked.
		built.port.issue.mockImplementationOnce(async (document: any) => {
			Object.assign(built.order(), { version: 4, invoiceId: 'invoice-from-elsewhere' });

			return {
				invoiceId: 'invoice-201',
				invoiceNumber: 201,
				items: document.items.map((item: any) => ({ key: item.key, invoiceItemId: `x-${item.key}` }))
			};
		});
		built.port.documents.set('invoice-201', { status: 'DRAFT' });

		await expect(built.service.generateInvoice('order-1')).rejects.toMatchObject({
			code: 'ENTITY_VERSION_CONFLICT'
		});

		expect(built.order()).toMatchObject({ invoiceId: 'invoice-from-elsewhere', version: 4 });
		expect(built.port.voidDocument).toHaveBeenCalledWith('invoice-201', expect.stringMatching(/refused/));
	});
});
