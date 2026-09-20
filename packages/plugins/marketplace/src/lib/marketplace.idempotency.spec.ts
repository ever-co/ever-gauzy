/**
 * The package's retry-safety adoption map.
 *
 * Adopting the convention is one `@Idempotent(...)` line per route, which is exactly what makes it easy
 * to state a scope that does not match the operation, to decorate a route twice under two names, or to
 * miss an unsafe route altogether. This specification pins the map itself: one entry per route the
 * package has adopted, the scope that route declares, and whether the key is required.
 *
 * It sits beside `marketplace.module.ts` rather than beside one controller because it spans five of
 * them, and because the map is the thing under test: `seller.create` is one operation whether it is
 * reached through the seller controller or read here, and a per-controller copy of this seam would be
 * the same assertions four more times over the same doubled application graph.
 *
 * The scopes themselves are the contract. A scope is part of a key's identity rather than a filter
 * applied afterwards, so two operations that share one would replay each other's responses — hence the
 * uniqueness assertion below, which is the one property a reader of the declarations cannot see.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which reading a decorator's metadata needs, so it is doubled
 * at the module boundary exactly as the package's other specifications do. The retry-safety declaration
 * is taken from its own modules, because that declaration is what is being read.
 */
jest.mock('@gauzy/core', () => {
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

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}
	}

	return {
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		BaseQueryDTO: class {},
		CrudService: class {},
		CrudController: class {},
		TenantAwareCrudService,
		MikroOrmBaseEntityRepository: class {},
		EventBus: class {},
		BaseEvent: class {},
		EventOutboxService: class {},
		EventOutboxModule: class {},
		RolePermissionModule: class {},
		SequenceService: class {},
		SequenceModule: class {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		},
		ColumnIndex: decorator,
		JsonColumn: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		IsSecret: decorator,
		Permissions: () => () => undefined,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		UseValidationPipe: () => () => undefined,
		UUIDValidationPipe: class {},
		Merchant: class {},
		OrganizationContact: class {},
		Product: class {},
		ProductVariant: class {},
		User: class {},
		Warehouse: class {},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		isUniqueViolation: (error: any) => Boolean(error?.code === '23505'),
		// The kernel is the subject here, so its own modules answer rather than a second copy of them.
		IDEMPOTENT_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy')
			.IDEMPOTENT_METADATA_KEY,
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent
	};
});

jest.mock('@gauzy/config', () => ({
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

import { MODULE_METADATA } from '@nestjs/common/constants';
import { IDEMPOTENT_METADATA_KEY } from '@gauzy/core';
import { SellerController } from './seller/seller.controller';
import { SellerModule } from './seller/seller.module';
import { SellerOfferingController } from './seller-offering/seller-offering.controller';
import { SellerOfferingModule } from './seller-offering/seller-offering.module';
import { SellerPayoutController } from './seller-payout/seller-payout.controller';
import { SellerPayoutModule } from './seller-payout/seller-payout.module';
import { SellerPayoutLineModule } from './seller-payout-line/seller-payout-line.module';
import { SellerSettlementController } from './seller-settlement/seller-settlement.controller';
import { SellerSettlementModule } from './seller-settlement/seller-settlement.module';
import { SellerTransactionController } from './seller-transaction/seller-transaction.controller';
import { SellerTransactionModule } from './seller-transaction/seller-transaction.module';

/** What one route declared about retrying it. */
interface RetryDeclaration {
	scope: string;
	required?: boolean;
	resourceType?: string;
}

/**
 * One adopted route: the controller method, the scope it declares, whether a key is mandatory and what
 * the key was recorded as holding.
 */
interface AdoptedRoute {
	controller: any;
	route: string;
	scope: string;
	required: boolean;
	resourceType?: string;
	/** Why this route is unsafe to repeat, which is what the adoption is for. */
	because: string;
}

/**
 * Every controller the package registers.
 *
 * Read from the modules that declare them rather than listed by hand, so a controller added to the
 * package is covered by the completeness assertion below without anyone remembering to add it here.
 * The aggregate modules are the ones that own the controllers; the marketplace module imports them
 * rather than redeclaring what they host.
 */
const CONTROLLERS: readonly any[] = (
	[
		SellerModule,
		SellerOfferingModule,
		SellerTransactionModule,
		SellerPayoutModule,
		SellerPayoutLineModule,
		SellerSettlementModule
	] as const
).flatMap((module) => (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) ?? []) as any[]);

/**
 * Every route in the package that has adopted the convention.
 *
 * The list is the package's whole unsafe surface: the creates, the lifecycle acts, the payout pass and
 * the one route that instructs the provider. The read routes are absent because a read has nothing to
 * duplicate — the kernel ignores a key presented to one rather than refusing it — and the routes that
 * refuse a caller-authored write are absent because they have no side effect to repeat.
 */
const ADOPTED: readonly AdoptedRoute[] = [
	{
		controller: SellerController,
		route: 'create',
		scope: 'seller.create',
		required: false,
		resourceType: 'seller',
		because: 'a resubmitted application must answer with the seller it already created'
	},
	{
		controller: SellerController,
		route: 'verify',
		scope: 'seller.verify',
		required: false,
		resourceType: 'seller',
		because: 'a resent verdict must not stamp a fresh verification date over the recorded one'
	},
	{
		controller: SellerController,
		route: 'offboard',
		scope: 'seller.offboard',
		required: false,
		resourceType: 'seller',
		because: 'a re-sent lifecycle act must answer from its record rather than be attempted twice'
	},
	{
		controller: SellerOfferingController,
		route: 'create',
		scope: 'seller_offering.create',
		required: false,
		resourceType: 'seller_offering',
		because: 'a resent offer must answer with the offering it already created'
	},
	{
		controller: SellerOfferingController,
		route: 'publish',
		scope: 'seller_offering.publish',
		required: false,
		resourceType: 'seller_offering',
		because: 'publishing twice re-stamps the approval and announces a second publication'
	},
	{
		controller: SellerTransactionController,
		route: 'settle',
		scope: 'seller.transaction.settle',
		required: false,
		resourceType: 'seller_transaction',
		because: 'a resent advance must not announce the row again or move its settleable date'
	},
	{
		controller: SellerPayoutController,
		route: 'create',
		scope: 'seller.payout.create',
		required: false,
		resourceType: 'seller_payout',
		because: 'a resubmitted create must not build a second payout over the same ledger rows'
	},
	{
		controller: SellerPayoutController,
		route: 'run',
		scope: 'seller.payout.run',
		required: false,
		resourceType: 'seller_payout',
		because: 'a scheduler that re-sends a pass it never saw answered must not repeat the pass'
	},
	{
		controller: SellerPayoutController,
		route: 'pay',
		scope: 'seller.payout.pay',
		required: true,
		resourceType: 'seller_payout',
		because: 'a retried execution instructs the provider a second time and pays the seller twice'
	},
	{
		controller: SellerPayoutController,
		route: 'retry',
		scope: 'seller.payout.retry',
		required: false,
		resourceType: 'seller_payout',
		because: 'a resent re-drive clears a failure an operator may still be reading'
	},
	{
		controller: SellerSettlementController,
		route: 'create',
		scope: 'seller.settlement.record',
		required: false,
		resourceType: 'seller_settlement',
		because: 'a provider callback delivered twice must record one settlement, not two'
	},
	{
		controller: SellerSettlementController,
		route: 'reconcile',
		scope: 'seller.settlement.reconcile',
		required: false,
		resourceType: 'seller_settlement',
		because: 'a resent reconciliation stamps a second reconciled date over the first'
	}
];

/** Every controller of the package, so the map can be checked for completeness as well as for content. */
const CONTROLLER_NAMES = CONTROLLERS.map((controller) => controller.name);

/**
 * Every route of one controller that declares a retry scope.
 *
 * Read from the metadata the decorator wrote rather than from the source text, because the interceptor
 * decides from that metadata: a declaration a reader can see but the runtime cannot is not a
 * declaration.
 */
function adoptedRoutesOf(controller: any): Record<string, RetryDeclaration> {
	return Object.fromEntries(
		Object.getOwnPropertyNames(controller.prototype)
			.map((method) => [
				method,
				Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, controller.prototype[method]) as
					| RetryDeclaration
					| undefined
			])
			.filter(([, declaration]) => Boolean(declaration))
	) as Record<string, RetryDeclaration>;
}

/** The declarations the map states, grouped by the controller that owns them. */
function declaredByTheMap(): Record<string, Record<string, RetryDeclaration>> {
	const grouped = Object.fromEntries(
		CONTROLLERS.map((controller) => [controller.name, {}])
	) as Record<string, Record<string, RetryDeclaration>>;

	for (const adopted of ADOPTED) {
		grouped[adopted.controller.name][adopted.route] = {
			scope: adopted.scope,
			required: adopted.required,
			...(adopted.resourceType ? { resourceType: adopted.resourceType } : {})
		};
	}

	return grouped;
}

describe('the marketplace retry-safety adoption map', () => {
	it('reads the package’s controllers from the modules that register them', () => {
		// The completeness assertion below is only worth anything if this list is the package's real
		// surface, so the derivation is anchored: the six aggregate modules are what the marketplace
		// module imports, and the seller controller is the one they must all be read alongside.
		expect(CONTROLLER_NAMES).toHaveLength(6);
		expect(CONTROLLER_NAMES).toContain(SellerController.name);
		expect(CONTROLLER_NAMES).toContain(SellerPayoutController.name);
	});

	it.each(ADOPTED)('declares $scope, because $because', (adopted: AdoptedRoute) => {
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, adopted.controller.prototype[adopted.route])).toEqual({
			scope: adopted.scope,
			required: adopted.required,
			...(adopted.resourceType ? { resourceType: adopted.resourceType } : {})
		});
	});

	it('adopts the convention on exactly the routes the map names, and on no other route', () => {
		const observed = Object.fromEntries(
			CONTROLLERS.map((controller) => [controller.name, adoptedRoutesOf(controller)])
		);

		expect(observed).toEqual(declaredByTheMap());
	});

	it('gives every operation a scope of its own', () => {
		// Two operations sharing a scope would be one identity: a key presented to one of them would
		// replay the other's stored response instead of being refused as a key that was never its own.
		// The list is also anchored, so the uniqueness check cannot pass by being run over nothing.
		const scopes = ADOPTED.map((adopted) => adopted.scope);

		expect(scopes.length).toBeGreaterThan(0);
		expect(new Set(scopes).size).toBe(scopes.length);
	});

	it('requires a key on the one route that moves money, and on no other', () => {
		expect(ADOPTED.filter((adopted) => adopted.required).map((adopted) => adopted.scope)).toEqual([
			'seller.payout.pay'
		]);
	});

	it('records what the required key was holding, so an operator can find it', () => {
		const required = ADOPTED.find((adopted) => adopted.required)!;

		expect(required.resourceType).toBe('seller_payout');
		expect(
			Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, required.controller.prototype[required.route])
		).toMatchObject({ resourceType: 'seller_payout' });
	});
});
