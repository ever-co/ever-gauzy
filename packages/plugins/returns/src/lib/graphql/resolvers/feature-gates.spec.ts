/**
 * The feature gates of this plugin's GraphQL surface, against the gates of its REST surface.
 *
 * Every controller of this plugin declares `@FeatureFlag(ReturnsFeatures.RETURNS)`, so a tenant that
 * switched returns off is answered 404 by `FeatureFlagGuard` on every route. The resolver classes
 * declared only `@FeatureFlag(FEATURE_GRAPHQL)`, so the same tenant could still run
 * `refundOrderReturn`, `receiveOrderReturn` or `deleteOrderReturn` over GraphQL: the money moved on the
 * surface the switch did not reach. What is pinned here, for all seven resolver classes against the
 * controller of the same resource:
 *
 * - the class declares the platform's `FEATURE_GRAPHQL` **and** every flag its controller class
 *   declares, read from the controller rather than restated, so the two surfaces cannot drift apart;
 * - no field declares a flag of its own, because the guard reads a handler's flags *instead of* the
 *   class's, and one field-level flag would take both class gates off that field.
 *
 * The decorator is recorded rather than evaluated: `@FeatureFlag` is the platform's and so is the guard,
 * and the rule this suite relies on is the platform's contract that several `@FeatureFlag` statements on
 * one target accumulate. The double records every statement on the target it was applied to, in order,
 * which is exactly the set the guard is required to evaluate — a double that kept only the last would
 * have hidden the defect this file exists for, as the no-op doubles of the other suites did.
 */
const mockDeclaredFlags = new Map<unknown, string[]>();

/**
 * The kernel barrel is doubled for the reason this package's other suites state — `@gauzy/core` boots the
 * whole application graph from its barrel — and with the same double as the soft-delete suite, which
 * loads the same fourteen classes.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata, UsePipes, ValidationPipe } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

	// The kernel's own declarations and its conditional write, so the classes under test are declared
	// with the platform's decorators rather than with no-ops.
	const idempotency = jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy');
	const versioned = jest.requireActual('@gauzy/core/src/lib/concurrency/versioned.decorator');
	const versionedWrite = jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/**
	 * The CRUD base, as the seven controllers extend it.
	 *
	 * The two inherited routes are the subject of this suite, so they are written as
	 * `packages/core/src/lib/core/crud/crud.controller.ts` writes them — the identifier, the rest
	 * parameter handed over as one array, and the service call — rather than omitted.
	 */
	class CrudController {
		constructor(protected readonly crudService: any) {}
		async softRemove(id: any, ...options: any[]): Promise<any> {
			return await this.crudService.softRemove(id, options);
		}
		async softRecover(id: any, ...options: any[]): Promise<any> {
			return await this.crudService.softRecover(id, options);
		}
	}

	class CrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}
	}

	return {
		CrudController,
		CrudService,
		TenantAwareCrudService: CrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		BaseQueryDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		VersionedColumn: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		BaseEvent: class {},
		EventBus: class {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		FeatureFlagGuard: class FeatureFlagGuard {},
		// The soft-delete and recover routes construct this pipe at class-definition time, so the
		// double has to export the class those routes build.
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		UUIDValidationPipe: class UUIDValidationPipe {},
		SequenceService: class SequenceService {},
		TenantSettingService: class TenantSettingService {},
		Warehouse: class Warehouse {},
		UseValidationPipe: (options: unknown) => UsePipes(new ValidationPipe(options as never)),
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: idempotency.IDEMPOTENT_METADATA_KEY,
		Versioned: versioned.Versioned,
		commitVersionedUpdate: versionedWrite.commitVersionedUpdate,
		versionExpectationOf: versionedWrite.versionExpectationOf,
		// The page window and the connection the list fields answer with are the kernel's own, so a
		// resolver that is loaded here is loaded with the platform's helpers rather than with holes.
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		paginateRows: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection').paginateRows,
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

/**
 * The feature-flag decorator is the only value these modules read from `@gauzy/common`, and it is
 * recorded: a class statement is kept against the class, a field statement against the field's function.
 */
jest.mock(
	'@gauzy/common',
	() => ({
		FeatureFlag:
			(feature: string) =>
			(target: unknown, _key?: string | symbol, descriptor?: PropertyDescriptor): void => {
				const holder = descriptor?.value ?? target;

				mockDeclaredFlags.set(holder, [...(mockDeclaredFlags.get(holder) ?? []), feature]);
			}
	})
);

import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { ReturnsFeatures } from '../../returns.features';
import { OrderClaimController } from '../../order-claim/order-claim.controller';
import { OrderClaimLineController } from '../../order-claim-line/order-claim-line.controller';
import { OrderExchangeController } from '../../order-exchange/order-exchange.controller';
import { OrderExchangeLineController } from '../../order-exchange-line/order-exchange-line.controller';
import { OrderReturnController } from '../../order-return/order-return.controller';
import { OrderReturnLineController } from '../../order-return-line/order-return-line.controller';
import { OrderReturnReasonController } from '../../order-return-reason/order-return-reason.controller';
import { OrderClaimLineResolver } from './order-claim-line.resolver';
import { OrderClaimResolver } from './order-claim.resolver';
import { OrderExchangeLineResolver } from './order-exchange-line.resolver';
import { OrderExchangeResolver } from './order-exchange.resolver';
import { OrderReturnLineResolver } from './order-return-line.resolver';
import { OrderReturnReasonResolver } from './order-return-reason.resolver';
import { OrderReturnResolver } from './order-return.resolver';
import { resolvers } from './index';

type Constructor = new (...args: any[]) => any;

/** Each resolver class, and the controller of the same resource whose gate it must carry. */
const SURFACES: Array<[string, Constructor, Constructor]> = [
	['OrderReturn', OrderReturnResolver, OrderReturnController],
	['OrderReturnLine', OrderReturnLineResolver, OrderReturnLineController],
	['OrderReturnReason', OrderReturnReasonResolver, OrderReturnReasonController],
	['OrderClaim', OrderClaimResolver, OrderClaimController],
	['OrderClaimLine', OrderClaimLineResolver, OrderClaimLineController],
	['OrderExchange', OrderExchangeResolver, OrderExchangeController],
	['OrderExchangeLine', OrderExchangeLineResolver, OrderExchangeLineController]
];

/**
 * @param type A class.
 * @returns Every method its prototype chain declares below `Object`, with the function each name holds.
 */
function methodsOf(type: Constructor): Array<[string, unknown]> {
	const methods: Array<[string, unknown]> = [];

	for (let prototype = type.prototype; prototype && prototype !== Object.prototype; prototype = Object.getPrototypeOf(prototype)) {
		for (const name of Object.getOwnPropertyNames(prototype)) {
			if (name !== 'constructor') {
				methods.push([name, Object.getOwnPropertyDescriptor(prototype, name)?.value]);
			}
		}
	}

	return methods;
}

describe('the returns resolvers carry the plugin’s own feature gate, as its controllers do', () => {
	it('covers every resolver the plugin contributes', () => {
		// A resolver added to the plugin without a row here would be a surface nobody measured.
		expect(new Set(SURFACES.map(([, resolver]) => resolver))).toEqual(new Set(resolvers));
	});

	it.each(SURFACES)('%s: the controller gates on the returns capability', (_name, _resolver, controller) => {
		// The reference the resolver is measured against is read from the controller, and it is the
		// plugin's own code: if a controller stopped declaring it, the parity below would be vacuous.
		expect(mockDeclaredFlags.get(controller)).toEqual([ReturnsFeatures.RETURNS]);
	});

	it.each(SURFACES)(
		'%s: the resolver class declares FEATURE_GRAPHQL and every flag its controller class declares',
		(_name, resolver, controller) => {
			const declared = mockDeclaredFlags.get(resolver) ?? [];

			expect(declared).toContain(FEATURE_GRAPHQL);

			for (const flag of mockDeclaredFlags.get(controller) ?? []) {
				expect(declared).toContain(flag);
			}
		}
	);

	it.each(SURFACES)('%s: no field declares a flag that would replace the class gates', (_name, resolver) => {
		const fieldFlags = methodsOf(resolver)
			.filter(([, method]) => mockDeclaredFlags.has(method))
			.map(([name]) => name);

		expect(fieldFlags).toEqual([]);
	});
});
