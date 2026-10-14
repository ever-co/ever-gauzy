/**
 * R3-11 / the order children of a placed order and the order ledgers: see the describe blocks below.
 *
 * `@gauzy/core` is doubled exactly as `order-delete-retires.db.spec.ts` doubles it (its barrel boots the application
 * graph); the CRUD bases are the kernel's own.
 */
jest.mock('@gauzy/plugin-cart', () => ({
	TotalsCalculator: jest.requireActual('@gauzy/plugin-cart/src/lib/totals/totals-calculator').TotalsCalculator
}));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the order entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		// The kernel's own CRUD bases and request context: the retirement under test is their code.
		CrudService: jest.requireActual('@gauzy/core/src/lib/core/crud/crud.service').CrudService,
		TenantAwareCrudService: jest.requireActual('@gauzy/core/src/lib/core/crud/tenant-aware-crud.service')
			.TenantAwareCrudService,
		MikroOrmBaseEntityRepository: jest.requireActual(
			'@gauzy/core/src/lib/core/repository/mikro-orm-base-entity.repository'
		).MikroOrmBaseEntityRepository,
		RequestContext: jest.requireActual('@gauzy/core/src/lib/core/context').RequestContext,
		// The base controller, in the shape the kernel declares it.
		CrudController: class CrudController {
			constructor(protected readonly crudService: any) {}

			async delete(id: any, ..._options: any[]): Promise<any> {
				return this.crudService.delete(id);
			}

			async softRemove(id: any, ...options: any[]): Promise<any> {
				return await this.crudService.softRemove(id, options);
			}

			async softRecover(id: any, ...options: any[]): Promise<any> {
				return await this.crudService.softRecover(id, options);
			}
		},
		quoteIdentifier: (identifier: string) => `"${identifier}"`,
		prepareSQLQuery: (query: string) => query,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		BaseQueryDTO: class {},
		UUIDValidationPipe: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		Permissions: jest.requireActual('@gauzy/core/src/lib/shared/decorators/permissions.decorator').Permissions,
		UseValidationPipe: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		FeatureFlagGuard: class {},
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		Versioned: () => decorator(),
		VersionedColumn: decorator,
		commitVersionedUpdate: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.commitVersionedUpdate,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		paginateRows: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection').paginateRows,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		AdjustmentService: class {},
		TaxLineService: class {},
		SequenceService: class {}
	};
});

import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus, OrderTransactionType } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { OrderEditGuard } from './order/order-edit.guard';
import { OrderLineController } from './order-line/order-line.controller';
import { OrderShippingMethodController } from './order-shipping-method/order-shipping-method.controller';
import { OrderAddressController } from './order-address/order-address.controller';
import { OrderCreditLineController } from './order-credit-line/order-credit-line.controller';
import { OrderTransactionController } from './order-transaction/order-transaction.controller';
import { OrderTransactionService } from './order-transaction/order-transaction.service';
import { OrderHistoryService } from './order-history/order-history.service';
import { OrderSummaryService } from './order-summary/order-summary.service';
import { OrderLineResolver } from './graphql/order-line.resolver';
import { OrderResolver } from './graphql/order.resolver';

/**
 * Review R3-11: the generic routes of a placed order's children and its ledgers.
 *
 * `OrderService` says a placed order is not edited outside an order change, and `updateMutable` holds the order row
 * to that. The children's own CRUD routes - and the GraphQL fields that retire and restore them - did not:
 * `PUT /order-lines/:id {"unitPrice":0.01}` repriced a confirmed order with no version bump and no re-derivation,
 * `PUT /order-lines/:id {"orderId":…}` moved a line between orders, `POST /order-credit-lines` wrote a credit with no
 * ledger row, and retiring a line or a ledger row hid it from the next derivation. `POST /order-transactions`
 * accepted any kind in any currency, which the calculator then summed as the order's.
 *
 * The controllers, the resolvers, the guard and the ledger services are the real ones; the child services are
 * doubles recording what reached them, and the order table is a map the guard reads through its repository.
 */
const TENANT = '00000000-0000-4000-8000-000000000001';
const DRAFT = 'order-draft';
const PLACED = 'order-placed';

const orders: Record<string, { id: string; status: OrderStatus; isDraft?: boolean; currency: string }> = {
	[DRAFT]: { id: DRAFT, status: OrderStatus.DRAFT, isDraft: true, currency: 'USD' },
	[PLACED]: { id: PLACED, status: OrderStatus.CONFIRMED, isDraft: false, currency: 'USD' }
};

/** The order repository the guard reads: one table, read by id and tenant. */
const orderRepository = {
	findOne: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
		where.tenantId === TENANT ? orders[where.id] ?? null : null
	)
};

/** A child service double whose rows belong to the order their id names. */
function childService() {
	return {
		findOneByIdString: jest.fn(async (id: string) => ({ id, orderId: id.startsWith('placed') ? PLACED : DRAFT })),
		create: jest.fn(async (entity: object) => ({ id: 'created', ...entity })),
		update: jest.fn(async () => ({ affected: 1 })),
		softRemove: jest.fn(async (id: string) => ({ id, deletedAt: new Date() })),
		softRecover: jest.fn(async (id: string) => ({ id, deletedAt: null }))
	};
}

const guard = () => new OrderEditGuard(orderRepository as never);

const IMMUTABLE = { response: { code: 'ORDER_IMMUTABLE', details: { orderId: PLACED, status: OrderStatus.CONFIRMED } } };

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
});

afterEach(() => jest.restoreAllMocks());

describe('OrderEditGuard', () => {
	it('lets a draft through, and refuses a placed order, naming the order change', async () => {
		await expect(guard().assertDraft(DRAFT, 'order line')).resolves.toBeUndefined();
		await expect(guard().assertDraft(PLACED, 'order line')).rejects.toMatchObject({
			response: {
				code: 'ORDER_IMMUTABLE',
				details: { orderId: PLACED, changeEndpoint: `POST /api/orders/${PLACED}/changes` }
			}
		});
	});

	it('answers an order of another tenant, or none, as missing', async () => {
		await expect(guard().assertDraft('nope', 'order line')).rejects.toBeInstanceOf(NotFoundException);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('another-tenant');
		await expect(guard().assertDraft(DRAFT, 'order line')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('refuses to move a child to another order', () => {
		expect(() => guard().assertSameOrder(DRAFT, 'order-other', 'order line')).toThrow(BadRequestException);
		expect(() => guard().assertSameOrder(DRAFT, DRAFT, 'order line')).not.toThrow();
		expect(() => guard().assertSameOrder(DRAFT, undefined, 'order line')).not.toThrow();
	});
});

describe.each([
	['OrderLineController', OrderLineController],
	['OrderShippingMethodController', OrderShippingMethodController],
	['OrderAddressController', OrderAddressController],
	['OrderCreditLineController', OrderCreditLineController]
])('%s writes to a draft only', (_name, Controller) => {
	const build = () => {
		const service = childService();
		const controller = new (Controller as any)(service, guard());

		return { service, controller };
	};

	it('creates on a draft, and refuses to create on a placed order', async () => {
		const { service, controller } = build();

		await controller.create({ orderId: DRAFT });
		expect(service.create).toHaveBeenCalledTimes(1);

		await expect(controller.create({ orderId: PLACED })).rejects.toMatchObject(IMMUTABLE);
		expect(service.create).toHaveBeenCalledTimes(1);
	});

	it('updates a draft row, and refuses a placed one or a move to another order', async () => {
		const { service, controller } = build();

		await controller.update('draft-row', { note: 'x' });
		expect(service.update).toHaveBeenCalledTimes(1);

		await expect(controller.update('placed-row', { note: 'x' })).rejects.toMatchObject(IMMUTABLE);
		await expect(controller.update('draft-row', { orderId: PLACED })).rejects.toMatchObject({
			response: { code: 'ORDER_IMMUTABLE', details: { orderId: DRAFT, statedOrderId: PLACED } }
		});
		expect(service.update).toHaveBeenCalledTimes(1);
	});

	it('retires and restores a draft row, and refuses a placed one on every route', async () => {
		const { service, controller } = build();

		await controller.delete('draft-row');
		await controller.softRemove('draft-row');
		await controller.softRecover('draft-row');
		expect(service.softRemove).toHaveBeenCalledTimes(2);
		expect(service.softRecover).toHaveBeenCalledTimes(1);

		await expect(controller.delete('placed-row')).rejects.toMatchObject(IMMUTABLE);
		await expect(controller.softRemove('placed-row')).rejects.toMatchObject(IMMUTABLE);
		await expect(controller.softRecover('placed-row')).rejects.toMatchObject(IMMUTABLE);
		expect(service.softRemove).toHaveBeenCalledTimes(2);
		expect(service.softRecover).toHaveBeenCalledTimes(1);
		// A restore reads the retired row too.
		expect(service.findOneByIdString).toHaveBeenLastCalledWith('placed-row', { withDeleted: true });
	});
});

describe('the GraphQL fields that retire and restore a placed order child', () => {
	it('softDeleteOrderLine / recoverOrderLine refuse a line of a placed order', async () => {
		const line = childService();
		const resolver = new OrderLineResolver({} as never, line as never, guard());

		await expect(resolver.softDeleteOrderLine('placed-row')).rejects.toMatchObject(IMMUTABLE);
		await expect(resolver.recoverOrderLine('placed-row')).rejects.toMatchObject(IMMUTABLE);
		expect(line.softRemove).not.toHaveBeenCalled();
		expect(line.softRecover).not.toHaveBeenCalled();

		await resolver.softDeleteOrderLine('draft-row');
		expect(line.softRemove).toHaveBeenCalledWith('draft-row');
	});

	it('the address, credit-line and shipping-method fields refuse a row of a placed order', async () => {
		const address = childService();
		const credit = childService();
		const shipping = childService();
		const none = {} as never;
		const resolver = new OrderResolver(
			none,
			none,
			none,
			address as never,
			shipping as never,
			credit as never,
			none,
			none,
			none,
			guard()
		) as any;

		for (const field of [
			'softDeleteOrderAddress',
			'recoverOrderAddress',
			'deleteOrderAddress',
			'softDeleteOrderCreditLine',
			'recoverOrderCreditLine',
			'deleteOrderCreditLine',
			'softDeleteOrderShippingMethod',
			'recoverOrderShippingMethod'
		]) {
			await expect(resolver[field]('placed-row')).rejects.toMatchObject(IMMUTABLE);
		}
		for (const service of [address, credit, shipping]) {
			expect(service.softRemove).not.toHaveBeenCalled();
			expect(service.softRecover).not.toHaveBeenCalled();
		}

		await resolver.softDeleteOrderAddress('draft-row');
		expect(address.softRemove).toHaveBeenCalledWith('draft-row');
	});
});

describe('the order ledgers are append-only, and the one direct write is a MANUAL correction', () => {
	const ledger = (Service: any) => new Service({ manager: { findOne: jest.fn() } } as never, {} as never);

	it.each([
		['order_transaction', OrderTransactionService],
		['order_history', OrderHistoryService],
		['order_summary', OrderSummaryService]
	])('%s refuses every edit, removal, retirement and restore', async (table, Service) => {
		const service = ledger(Service);

		for (const call of [
			() => service.update('row-1', { amount: 1 }),
			() => service.delete('row-1'),
			() => service.softRemove('row-1'),
			() => service.softRecover('row-1')
		]) {
			await expect(call()).rejects.toMatchObject({ response: { code: 'ORDER_LEDGER_APPEND_ONLY', details: { table } } });
		}
	});

	const transactions = () => {
		const findOne = jest.fn(async (_entity: unknown, { where }: { where: { id: string; tenantId: string } }) =>
			where.tenantId === TENANT ? orders[where.id] ?? null : null
		);
		const service = new OrderTransactionService({ manager: { findOne } } as never, {} as never);
		const create = jest.spyOn(service, 'create').mockImplementation(async (row: any) => ({ id: 'tx-1', ...row }));
		const totals = { recompute: jest.fn(async () => ({})) };
		const controller = new OrderTransactionController(service, totals as never);

		return { service, create, totals, controller };
	};

	it('records a MANUAL correction in the order currency and re-derives the order', async () => {
		const { create, totals, controller } = transactions();

		const row = await controller.create({ orderId: PLACED, type: OrderTransactionType.MANUAL, amount: 5, currency: 'usd' } as never);

		expect(row).toMatchObject({ orderId: PLACED, type: OrderTransactionType.MANUAL, currency: 'USD' });
		expect(create).toHaveBeenCalledTimes(1);
		expect(totals.recompute).toHaveBeenCalledWith(PLACED, 'PAYMENT_RECONCILED');
	});

	it('refuses any other kind, another currency, a zero amount and an order of another tenant', async () => {
		const { create, totals, controller } = transactions();

		await expect(
			controller.create({ orderId: PLACED, type: OrderTransactionType.CAPTURE, amount: 5, currency: 'USD' } as never)
		).rejects.toMatchObject({ response: { code: 'ORDER_TRANSACTION_NOT_MANUAL' } });
		await expect(
			controller.create({ orderId: PLACED, type: OrderTransactionType.MANUAL, amount: 500, currency: 'JPY' } as never)
		).rejects.toMatchObject({ response: { code: 'ORDER_TRANSACTION_CURRENCY_MISMATCH' } });
		await expect(
			controller.create({ orderId: PLACED, type: OrderTransactionType.MANUAL, amount: 0, currency: 'USD' } as never)
		).rejects.toMatchObject({ response: { code: 'ORDER_TRANSACTION_AMOUNT_INVALID' } });

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('another-tenant');
		await expect(
			controller.create({ orderId: PLACED, type: OrderTransactionType.MANUAL, amount: 5, currency: 'USD' } as never)
		).rejects.toBeInstanceOf(NotFoundException);

		expect(create).not.toHaveBeenCalled();
		expect(totals.recompute).not.toHaveBeenCalled();
	});
});
