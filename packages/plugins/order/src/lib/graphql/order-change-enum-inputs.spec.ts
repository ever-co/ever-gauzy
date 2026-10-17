/**
 * The GraphQL change inputs name kinds the columns carry (R2-G24).
 *
 * `UpdateOrderChangeInput.changeType` and `UpdateOrderChangeActionInput.action` are declared `String`, so a
 * value outside the enumeration passed GraphQL validation and reached the varchar column — a database error
 * past its length, a stored row the apply step cannot interpret below it. The REST bodies refuse the same with
 * `@IsEnum`; the fields now answer 400 before anything is written. (`requestOrderEdit` is covered by
 * `OrderChangeService.create`, for every caller.)
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

import { OrderChangeActionType, OrderChangeType } from '@gauzy/contracts';
import { OrderChangeResolver } from './order-change.resolver';
import { ORDER_CHANGE_ACTION_TYPES, ORDER_CHANGE_TYPES, assertEnumMember } from './filters';

/** The request a versioned write runs against: what the version guard leaves on it. */
const REQUEST = { req: { versionExpectation: { wildcard: false, versions: [2] } } };

function resolverWith(changeService: Record<string, jest.Mock>, actionService: Record<string, jest.Mock>) {
	return new OrderChangeResolver(changeService as any, actionService as any, {} as any, {} as any, {} as any);
}

describe('R2-G24 — the change inputs are refused outside their enumeration', () => {
	it('lists every member of the two enumerations', () => {
		expect(ORDER_CHANGE_TYPES).toEqual(Object.values(OrderChangeType));
		expect(ORDER_CHANGE_ACTION_TYPES).toEqual(Object.values(OrderChangeActionType));
	});

	it('refuses updateOrderChange with an unknown changeType, and writes nothing', async () => {
		const changeService = { commitChange: jest.fn() };

		await expect(
			resolverWith(changeService, {}).updateOrderChange('change-1', { changeType: 'NOPE' }, 2, REQUEST)
		).rejects.toMatchObject({ status: 400, response: { code: 'ORDER_CHANGE_TYPE_INVALID' } });
		expect(changeService.commitChange).not.toHaveBeenCalled();
	});

	it('still amends a change whose type is a member, or that states none', async () => {
		const changeService = { commitChange: jest.fn().mockResolvedValue({ id: 'change-1' }) };
		const resolver = resolverWith(changeService, {});

		await resolver.updateOrderChange('change-1', { changeType: OrderChangeType.CREDIT }, 2, REQUEST);
		await resolver.updateOrderChange('change-1', { note: 'n' }, 2, REQUEST);

		expect(changeService.commitChange).toHaveBeenCalledTimes(2);
	});

	it('refuses updateOrderChangeAction with an unknown action, and writes nothing', async () => {
		const actionService = { update: jest.fn(), findOneByIdString: jest.fn() };

		await expect(
			resolverWith({}, actionService).updateOrderChangeAction('action-1', { action: 'ITEM_TELEPORT' })
		).rejects.toMatchObject({
			status: 400,
			response: { code: 'ORDER_CHANGE_ACTION_INVALID', details: { field: 'action', value: 'ITEM_TELEPORT' } }
		});
		expect(actionService.update).not.toHaveBeenCalled();
	});

	it('still amends an action that names a member', async () => {
		const actionService = {
			update: jest.fn().mockResolvedValue({ affected: 1 }),
			findOneByIdString: jest.fn().mockResolvedValue({ id: 'action-1' })
		};

		await resolverWith({}, actionService).updateOrderChangeAction('action-1', {
			action: OrderChangeActionType.ITEM_UPDATE
		});

		expect(actionService.update).toHaveBeenCalledWith('action-1', { action: OrderChangeActionType.ITEM_UPDATE });
	});

	it('treats an omitted member as not stated, and a non-string as not a member', () => {
		expect(() => assertEnumMember(undefined, ORDER_CHANGE_TYPES, 'changeType', 'X')).not.toThrow();
		expect(() => assertEnumMember(null, ORDER_CHANGE_TYPES, 'changeType', 'X')).not.toThrow();
		expect(() => assertEnumMember(3, ORDER_CHANGE_TYPES, 'changeType', 'X')).toThrow();
	});
});
