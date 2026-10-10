/**
 * The order's document and approval verbs, served over both protocols alike.
 *
 * Each verb is one service method behind two surfaces: a REST route and the GraphQL field that mirrors it.
 * The rule this suite pins is the programme's parity rule — GraphQL is never wider than REST, and a field
 * states exactly what its route states — so for every pair it compares what the kernel's own decorators
 * wrote on the two handlers (the grant, the retry scope, the versioned resource), and then drives both
 * handlers and checks that each hands the same service method the same order and the same version.
 *
 * `@gauzy/core`'s barrel is doubled at the module boundary for the reason the package's other suites
 * give; the three decorators whose metadata is compared are the kernel's own.
 */
jest.mock('@gauzy/plugin-cart', () => ({
	TotalsCalculator: jest.requireActual('@gauzy/plugin-cart/src/lib/totals/totals-calculator').TotalsCalculator
}));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		...jest.requireActual('@gauzy/core/src/lib/money/decimal'),
		quoteIdentifier: (identifier: string) => `"${identifier}"`,
		prepareSQLQuery: (query: string) => query,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		CrudService: class {},
		TenantAwareCrudService: class {},
		CrudController: class CrudController {
			constructor(protected readonly service: any) {}
		},
		BaseQueryDTO: class {},
		UUIDValidationPipe: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		// The three declarations this suite compares are the kernel's own, or write exactly what the kernel's
		// own writes.
		Permissions: jest.requireActual('@gauzy/core/src/lib/shared/decorators/permissions.decorator').Permissions,
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		Versioned: (options: any = {}) =>
			require('@nestjs/common').SetMetadata(
				jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').VERSIONED_METADATA_KEY,
				options
			),
		UseValidationPipe: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		FeatureFlagGuard: class {},
		VersionedColumn: decorator,
		commitVersionedUpdate: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.commitVersionedUpdate,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
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
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		},
		AdjustmentService: class {},
		TaxLineService: class {},
		SequenceService: class {},
		InvoiceService: class {},
		InvoiceModule: class {}
	};
});

import { print } from 'graphql';
import { HttpStatus, RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { ORDER_PERMISSIONS } from '../order.permissions';
import { OrderController } from '../order/order.controller';
import { OrderService } from '../order/order.service';
import { OrderResolver } from './order.resolver';
import { orderSchemaExtensions } from './schema-extensions';

const { IDEMPOTENT_METADATA_KEY } = jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy');
const { VERSIONED_METADATA_KEY, VERSION_EXPECTATION_PROPERTY } = jest.requireActual(
	'@gauzy/core/src/lib/concurrency/version.util'
);

const reflector = new Reflector();

/** The order both surfaces act on. */
const ID = '00000000-0000-4000-8000-000000000001';

/** The version the guard accepted, as it leaves it on the request. */
const STATED = { wildcard: false, versions: [3] };

/**
 * One verb: its route, its field, the grant both state, the retry scope both declare (or none), the path,
 * and the service method both call — on the invoicing service, or on the order service.
 */
interface IPair {
	field: keyof OrderResolver;
	route: keyof OrderController;
	path: string;
	permission: string;
	scope?: string;
	service: 'invoicing' | 'order';
	method: string;
	/** How the field is called: the order, the version, and the retry key when the field takes one. */
	call: (resolver: any, context: any) => Promise<unknown>;
	/** How the route is called. */
	invoke: (controller: any, request: any) => Promise<unknown>;
	/** The SDL declaration of the field, as the printer states it. */
	declaration: string;
}

const PAIRS: IPair[] = [
	{
		field: 'generateOrderInvoice',
		route: 'invoice',
		path: ':id/invoice',
		permission: ORDER_PERMISSIONS.ORDERS_EDIT,
		scope: 'order.invoice',
		service: 'invoicing',
		method: 'generateInvoice',
		call: (resolver, context) => resolver.generateOrderInvoice(ID, 3, 'retry-key-1', context),
		invoke: (controller, request) => controller.invoice(ID, request),
		declaration: 'generateOrderInvoice(id: ID!, version: Int, idempotencyKey: String): Order!'
	}
];

/** The two surfaces over one pair of service doubles. */
function surfaces() {
	const answer = { id: ID, version: 4 };
	const invoicingService: Record<string, jest.Mock> = {};
	const orderService: Record<string, jest.Mock> = {};

	for (const pair of PAIRS) {
		(pair.service === 'invoicing' ? invoicingService : orderService)[pair.method] = jest.fn(async () => answer);
	}

	const controller = new OrderController(
		orderService as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		invoicingService as never
	);
	const resolver = new OrderResolver(
		orderService as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		invoicingService as never
	);

	return { controller, resolver, invoicingService, orderService };
}

describe('The order’s document and approval verbs — one capability, two surfaces', () => {
	it.each(PAIRS.map((pair) => [pair.field, pair]))(
		'%s states the grant, the retry scope and the versioned resource its route states',
		(_field, pair) => {
			const route = (OrderController.prototype as any)[pair.route];
			const field = (OrderResolver.prototype as any)[pair.field];

			// The grant is the route's own, not the class-level view grant, and the field states the same.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, route)).toEqual([pair.permission]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, field)).toEqual([pair.permission]);

			expect(reflector.get(IDEMPOTENT_METADATA_KEY, route)?.scope).toBe(pair.scope);
			expect(reflector.get(IDEMPOTENT_METADATA_KEY, field)?.scope).toBe(pair.scope);
			expect(reflector.get(IDEMPOTENT_METADATA_KEY, field)?.required ?? false).toBe(false);

			// Both are writes predicated on the order's version, read by the guard from the order service.
			expect(reflector.get(VERSIONED_METADATA_KEY, route)).toMatchObject({ resource: OrderService });
			expect(reflector.get(VERSIONED_METADATA_KEY, field)).toMatchObject({ resource: OrderService });
			expect(reflector.get(VERSIONED_METADATA_KEY, route)?.write ?? true).toBe(true);
		}
	);

	it.each(PAIRS.map((pair) => [pair.route, pair]))(
		'%s is a POST under the order it acts on, answered 200',
		(_route, pair) => {
			const route = (OrderController.prototype as any)[pair.route];

			expect(Reflect.getMetadata(PATH_METADATA, route)).toBe(pair.path);
			expect(Reflect.getMetadata(METHOD_METADATA, route)).toBe(RequestMethod.POST);
			expect(Reflect.getMetadata(HTTP_CODE_METADATA, route)).toBe(HttpStatus.OK);
		}
	);

	it.each(PAIRS.map((pair) => [pair.field, pair]))(
		'%s and its route hand the same service method the order and the version the caller stated',
		async (_field, pair) => {
			const { controller, resolver, invoicingService, orderService } = surfaces();
			const request = { [VERSION_EXPECTATION_PROPERTY]: STATED };
			const service = pair.service === 'invoicing' ? invoicingService : orderService;

			await pair.invoke(controller, request);
			await pair.call(resolver, { req: request });

			expect(service[pair.method].mock.calls).toEqual([
				[ID, STATED],
				[ID, STATED]
			]);
		}
	);

	it.each(PAIRS.map((pair) => [pair.field, pair]))(
		'the schema declares %s as the field resolves it',
		(_field, pair) => {
			expect(print(orderSchemaExtensions)).toContain(pair.declaration);
		}
	);
});
