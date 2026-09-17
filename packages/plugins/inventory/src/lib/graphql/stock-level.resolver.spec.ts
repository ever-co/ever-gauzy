/**
 * Two module boundaries are doubled here, and the reason is the same for both.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a GraphQL resolver needs and none of which is available
 * outside a running application; its nested `uuid` is ESM-only, so reading one entity would fail under
 * jest. `@gauzy/config` reads the process environment at import time. Both are therefore doubled at the
 * module boundary, and **the resolvers under test are the real ones**, bound to a stubbed service so
 * what a field delegates to is asserted rather than inferred.
 *
 * The permission decorator is doubled with the platform’s own metadata key, read from the platform’s
 * constants, so the assertions below are made against the metadata a guard actually reads rather than
 * against the decorator’s prose.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

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
		RolePermissionModule: class RolePermissionModule {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		UUIDValidationPipe: class UUIDValidationPipe {},
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		UseValidationPipe: decorator,
		BaseEvent: class {},
		EventBus: class {},
		Product: class Product {},
		ProductVariant: class ProductVariant {},
		Warehouse: class Warehouse {},
		WarehouseProduct: class WarehouseProduct {},
		WarehouseProductVariant: class WarehouseProductVariant {},
		User: class User {},
		Sequence: class Sequence {},
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

jest.mock(
	'@gauzy/config',
	() => ({
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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { print } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { StockLevelController } from './../stock-level/stock-level.controller';
import { inventorySchemaExtensions } from './inventory.schema';
import { StockLevelResolver } from './stock-level.resolver';

/**
 * The stock level concept over GraphQL (doc 09 §10.4, §15.6).
 *
 * The programme’s API doctrine is one concept reachable over both protocols with the same scope, and
 * this suite pins the half of it that is easy to get quietly wrong:
 *
 * - the reconciliation the REST resource serves at its route is a **mutation** here, delegating to the
 *   same service method with the same scope, so a client is not choosing a better surface by choosing
 *   a protocol;
 * - it carries the reconciliation permission rather than the read permission the queries carry, so a
 *   role that may look at levels cannot correct them by asking GraphQL instead of REST;
 * - both protocols are tenant- and permission-guarded, asserted against the metadata a guard reads;
 * - the query takes the same filters its REST counterpart takes, because a query with fewer filters
 *   than the route it mirrors is the same defect in a quieter form;
 * - the schema document and the resolver decorators agree on every name, and the concept is spelled
 *   `stock*` on both sides.
 */

const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const VARIANT = '00000000-0000-4000-8000-000000000030';

/** The report a reconciliation answers with, so the two surfaces can be compared by identity. */
const REPORT = {
	scanned: 2,
	corrected: 1,
	corrections: [
		{
			levelId: 'level-1',
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			quantityBefore: 10,
			ledgerQuantity: 7,
			quantityAfter: 7
		}
	]
};

/**
 * Builds the two surfaces over one stubbed service.
 *
 * The service is the seam the doctrine is about: both protocols must reach the same method with the
 * same scope, and a stub is what makes that visible without a database behind it.
 */
function surfaces() {
	const service = {
		reconcile: jest.fn().mockResolvedValue(REPORT),
		findLevels: jest.fn().mockResolvedValue([{ levelId: 'level-1' }]),
		findLevel: jest.fn().mockResolvedValue({ levelId: 'level-1' }),
		availableQuantity: jest.fn().mockResolvedValue(7)
	};
	const eventBus = { ofType: () => ({ pipe: () => 'the level stream' }) };

	return {
		service,
		controller: new StockLevelController(service as never),
		resolver: new StockLevelResolver(service as never, eventBus as never)
	};
}

/** The composed schema document, as text, so a field can be asserted the way a client reads it. */
const schemaText = print(inventorySchemaExtensions);

describe('StockLevelResolver — the reconciliation over GraphQL (doc 09 §10.4)', () => {
	it('reconciles through the same service method the REST route calls, with the same scope', async () => {
		const { service, controller, resolver } = surfaces();
		const scope = { warehouseId: WAREHOUSE, variantId: VARIANT, take: 10 };

		const overRest = await controller.reconcile(scope);
		const overGraphql = await resolver.reconcileStockLevels(scope);

		expect(service.reconcile).toHaveBeenNthCalledWith(1, scope);
		expect(service.reconcile).toHaveBeenNthCalledWith(2, scope);
		// One answer, one implementation: the two protocols are not two ways of doing the same thing.
		expect(overRest).toBe(overGraphql);
		expect(overGraphql).toBe(REPORT);
	});

	it('accepts a run that states no scope, because the scope is optional on both surfaces', async () => {
		const { service, resolver } = surfaces();

		await resolver.reconcileStockLevels(undefined);

		expect(service.reconcile).toHaveBeenCalledWith({
			warehouseId: undefined,
			variantId: undefined,
			take: undefined
		});
	});

	it('is not reachable with the permission that only reads levels', () => {
		// What a guard reads: the handler’s own metadata when it declares one, the class’s metadata
		// otherwise. The class carries the read permission, so the mutation has to state the
		// reconciliation permission itself — a caller holding only `STOCK_VIEW` is refused here exactly
		// as it is refused at the REST route.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, StockLevelResolver)).toEqual(['STOCK_VIEW']);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, StockLevelResolver.prototype.reconcileStockLevels)).toEqual([
			'STOCK_RECONCILE'
		]);
		// Every query states the read permission, and none of them states the reconciliation one.
		for (const read of ['stockLevels', 'stockLevel', 'availableQuantity'] as const) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, StockLevelResolver.prototype[read])).toEqual(['STOCK_VIEW']);
		}
	});

	it('guards both surfaces with the tenant and permission guards', () => {
		for (const surface of [StockLevelResolver, StockLevelController]) {
			const guards = Reflect.getMetadata('__guards__', surface) ?? [];

			expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		}
	});
});

describe('StockLevelResolver — one concept, two protocols, the same names (doc 09 §11)', () => {
	it('declares the reconciliation as a mutation with its input and its report', () => {
		expect(schemaText).toMatch(/reconcileStockLevels\(input: StockLevelReconciliationInput\): StockLevelReconciliation!/);
		expect(schemaText).toMatch(/input StockLevelReconciliationInput \{\s*warehouseId: ID\s+variantId: ID\s+take: Int\s*\}/);
		expect(schemaText).toMatch(/type StockLevelReconciliation \{\s*scanned: Int!\s*corrected: Int!\s*corrections: \[StockLevelCorrection!\]!\s*\}/);
		expect(schemaText).toMatch(/type StockLevelCorrection \{/);
		// The mutation block is where a write belongs: the queries stay queries.
		expect(schemaText).toMatch(/type Mutation \{[\s\S]*reconcileStockLevels/);
	});

	it('gives the level query the same filters the REST list accepts', async () => {
		const { service, resolver } = surfaces();

		await resolver.stockLevels(WAREHOUSE, VARIANT, 25);

		expect(service.findLevels).toHaveBeenCalledWith({ warehouseId: WAREHOUSE, variantId: VARIANT, take: 25 });
		expect(schemaText).toMatch(/stockLevels\(warehouseId: ID, variantId: ID, take: Int\): \[StockLevel!\]!/);
	});

	it('spells the concept `stock*` on both halves of the schema', () => {
		// The names the two protocols are joined by. A root field named for the package rather than for
		// the concept is how the same resource ends up reachable under two names, and how half of it goes
		// missing behind one of them.
		const resolverSource = readFileSync(join(__dirname, 'stock-level.resolver.ts'), 'utf8');

		for (const half of [schemaText, resolverSource]) {
			expect(half).not.toMatch(/inventoryLevel/);
		}
		expect(schemaText).toMatch(/stockLevel\(warehouseId: ID!, variantId: ID!\): StockLevel/);
		expect(schemaText).toMatch(/stockLevelChanged\(warehouseId: ID, variantId: ID\): StockLevel!/);
		expect(resolverSource).toMatch(/@Query\('stockLevels'\)/);
		expect(resolverSource).toMatch(/@Query\('stockLevel'\)/);
		expect(resolverSource).toMatch(/@Mutation\('reconcileStockLevels'\)/);
		expect(resolverSource).toMatch(/@Subscription\('stockLevelChanged'\)/);
		// The availability a level derives stays a computation over the level rather than a level of its
		// own: it is named for what it answers.
		expect(resolverSource).toMatch(/@Query\('availableQuantity'\)/);
	});
});
