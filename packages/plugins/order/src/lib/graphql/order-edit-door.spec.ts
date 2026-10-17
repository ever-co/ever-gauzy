/**
 * The two GraphQL doors to changing an order that refused every well-formed call (R2-G20, R2-G21).
 *
 * - `requestOrderEdit` is `@Versioned` against the order its input names, and the guard reads a GraphQL
 *   write's version from `input.version` — but `RequestOrderEditInput` declared none, so every call was
 *   `428 VERSION_REQUIRED`. The input declares it now, as `POST /orders/:id/changes` takes `If-Match`.
 * - `updateOrder` handed its whole input to `updateMutable`: the `version` the guard requires became a
 *   patch key (`400 ORDER_IMMUTABLE` on every placed order), `note` named no column, and `cancelReason`
 *   — `cancelOrder`'s, under `ORDERS_CANCEL` — was writable under `ORDERS_EDIT`. The change set is now the
 *   input without the version, and a note or a cancellation reason is refused with its own code.
 *
 * The `@gauzy/core` double is the one `order.resolver.spec.ts` uses, for the reasons it gives.
 */
jest.mock('@gauzy/plugin-cart', () => ({
	TotalsCalculator: jest.requireActual('@gauzy/plugin-cart/src/lib/totals/totals-calculator').TotalsCalculator
}));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		// The statement helpers are pure and dialect-driven; loading the real module here would pull
		// `@gauzy/config` and the request context into a suite that doubles the barrel on purpose.
		quoteIdentifier: (identifier: string) => `"${identifier}"`,
		prepareSQLQuery: (query: string) => query,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		CrudService: class {},
		TenantAwareCrudService: class {},
		CrudController: class {
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
		Permissions: decorator,
		UseValidationPipe: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		// Every resolver class carries the platform's feature guard, so the double provides the class
		// the resolver imports: an undefined guard handed to the real `@UseGuards` fails the suite.
		FeatureFlagGuard: class {},
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		// Rebuilt rather than required: the real decorator imports the version guard, the interceptor behind
		// it and the idempotency service behind that, which reaches the entity graph and — under this
		// workspace's ESM-only `uuid` — fails the whole suite to LOAD. What this suite reads is the
		// metadata the decorator writes, so that is what the double writes.
		Versioned: (options: any = {}) =>
			require('@nestjs/common').SetMetadata(
				jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').VERSIONED_METADATA_KEY,
				options
			),
		VersionedColumn: decorator,
		commitVersionedUpdate: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.commitVersionedUpdate,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		// The connection helpers the list fields page and answer with, taken from the kernel: a double that
		// left them undefined would have the suite fail with "not a function" the moment a case called one
		// of those fields, rather than tell it anything about the page it answered.
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
		// The validation pipe the resolvers' routes build at class-definition time; Nest refuses a pipe with
		// no `transform`, and the resolver file reaches it through this barrel.
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
		SequenceService: class {}
	};
});

import { BadRequestException } from '@nestjs/common';
import { InputObjectTypeDefinitionNode, print } from 'graphql';
import { OrderResolver, orderUpdateOf } from './order.resolver';
import { orderSchemaExtensions } from './schema-extensions';
import { OrderService } from '../order/order.service';
import { UpdateOrderDTO } from '../order/dto';

const { VERSIONED_METADATA_KEY, versionFromResolverArgs } = jest.requireActual(
	'@gauzy/core/src/lib/concurrency/version.util'
);
const { getMetadataStorage } = jest.requireActual('class-validator');

const ORDER_ID = '00000000-0000-4000-8000-0000000000e1';
const EXPECTATION = { wildcard: false, versions: [3] };
const REQUEST = { versionExpectation: EXPECTATION };

/** The members an input of the order document declares. */
function inputMembers(name: string): string[] {
	const input = orderSchemaExtensions.definitions.find(
		(definition): definition is InputObjectTypeDefinitionNode =>
			definition.kind === 'InputObjectTypeDefinition' && definition.name.value === name
	);

	return (input?.fields ?? []).map((field) => `${field.name.value}: ${print(field.type)}`);
}

/** A resolver over a stubbed order service; the other collaborators are not reached by these fields. */
function resolverWith(orderService: Record<string, jest.Mock>, changeService: Record<string, jest.Mock> = {}) {
	return new OrderResolver(
		orderService as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		changeService as any,
		{} as any,
		{} as any
	);
}

describe('R2-G20 — requestOrderEdit can state the version it is guarded on', () => {
	it('declares `version: Int` on RequestOrderEditInput, nullable like every version member', () => {
		expect(inputMembers('RequestOrderEditInput')).toContain('version: Int');
	});

	it('is versioned against the order the input names, and the guard finds the version where the input puts it', () => {
		const options = Reflect.getMetadata(VERSIONED_METADATA_KEY, OrderResolver.prototype.requestOrderEdit);
		const args = { input: { orderId: ORDER_ID, actions: [], version: 3 } };
		const context = { getArgByIndex: (index: number) => (index === 1 ? args : undefined) };

		expect(options?.resource).toBe(OrderService);
		expect(options.identify(undefined, context)).toBe(ORDER_ID);
		expect(versionFromResolverArgs(args)).toBe('3');
	});

	it('hands the change to the service without the version — a precondition, not a field of the change', async () => {
		const changeService = { create: jest.fn().mockResolvedValue({ id: 'change-1' }) };
		const resolver = resolverWith({}, changeService);

		await resolver.requestOrderEdit({
			orderId: ORDER_ID,
			changeType: 'EDIT',
			note: 'swap size',
			actions: [],
			version: 3,
			idempotencyKey: 'k-1'
		});

		expect(changeService.create).toHaveBeenCalledWith({
			orderId: ORDER_ID,
			changeType: 'EDIT',
			note: 'swap size',
			actions: []
		});
	});
});

describe('R2-G21 — updateOrder writes only fields of the order', () => {
	it('does not hand the version to updateMutable as a patch key', async () => {
		const orderService = { updateMutable: jest.fn().mockResolvedValue({ id: ORDER_ID }) };

		await resolverWith(orderService).updateOrder(ORDER_ID, { email: 'buyer@example.com', version: 3 }, {
			req: REQUEST
		});

		expect(orderService.updateMutable).toHaveBeenCalledWith(ORDER_ID, { email: 'buyer@example.com' }, EXPECTATION);
	});

	it.each([
		[{ note: 'leave at the door' }, 'ORDER_NOTE_NOT_A_FIELD'],
		[{ cancelReason: 'changed my mind' }, 'ORDER_CANCEL_REASON_NOT_WRITABLE']
	])('refuses %o with %s and writes nothing', async (input, code) => {
		const orderService = { updateMutable: jest.fn() };

		await expect(
			resolverWith(orderService).updateOrder(ORDER_ID, { ...input, version: 3 }, { req: REQUEST })
		).rejects.toMatchObject({ response: { code } });
		expect(orderService.updateMutable).not.toHaveBeenCalled();
	});

	it('lets an explicit null through as "not stated", as an omitted member is', () => {
		expect(orderUpdateOf({ email: 'a@example.com', note: null, cancelReason: null, version: 2 })).toEqual({
			email: 'a@example.com'
		});
		expect(() => orderUpdateOf(undefined)).not.toThrow();
		expect(() => orderUpdateOf({ note: '' })).toThrow(BadRequestException);
	});

	it('matches the REST body, which never carried a note or a cancellation reason', () => {
		const members = new Set(
			getMetadataStorage()
				.getTargetValidationMetadatas(UpdateOrderDTO, '', false, false)
				.map((entry: { propertyName: string }) => entry.propertyName)
		);

		expect(members.has('email')).toBe(true);
		expect(members.has('note')).toBe(false);
		expect(members.has('cancelReason')).toBe(false);
	});
});
