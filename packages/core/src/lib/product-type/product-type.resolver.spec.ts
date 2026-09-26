/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ProductTypeController } from './product-type.controller';
import { ProductTypeResolver } from './product-type.resolver';
import { ProductTypeCreateCommand } from './commands';

/**
 * The operator-facing product classification over GraphQL.
 *
 * The delivered REST routes serve a type list, one type, a count, a declaration, a replacement, a
 * removal, and the withdrawal and restoration of a type. This suite pins the half of the two-protocol
 * doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST
 *   resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — including the node query, whose route inherits the controller's class-level edit
 *   permission because it declares none of its own;
 * - the translated members the REST surface merges onto the row are what the object type carries, and
 *   the members that reader cannot produce are not declared at all;
 * - a type that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const PHYSICAL = '00000000-0000-4000-8000-000000000010';
const DIGITAL = '00000000-0000-4000-8000-000000000011';

/**
 * The rows a scripted service answers with, in the order the delivered list method returns them, each
 * already carrying the translation the reader merged for the caller's language.
 */
const ROWS = [
	{
		id: PHYSICAL,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Physical',
		description: 'Goods that ship',
		icon: 'car-outline',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: DIGITAL,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Digital',
		description: 'Goods that download',
		icon: 'flash-outline',
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const productTypeService = {
		findProductTypes: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		updateProductType: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		productTypeService,
		commandBus,
		resolver: new ProductTypeResolver(productTypeService as never, commandBus as never)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return (
		error instanceof Error &&
		'getStatus' in error &&
		typeof (error as { getStatus(): number }).getStatus === 'function' &&
		(error as { getStatus(): number }).getStatus() >= 400 &&
		(error as { getStatus(): number }).getStatus() !== 404
	);
}

/**
 * The composed schema, as text: the domain's own documents plus every kernel and domain document the
 * boot loader globs, which is what makes a reference from this domain to another one resolvable.
 */
function composedSchema(): string {
	const root = join(__dirname, '..');
	const documents: string[] = [];

	const walk = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.name.endsWith('.gql') && directory.endsWith('schema')) {
				documents.push(readFileSync(path, 'utf8'));
			}
		}
	};

	walk(root);

	return documents.join('\n');
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
const schema = buildSchema(composedSchema());

/** The schema as text, printed once. */
const printed = printSchema(schema);

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('producttype'))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof ProductTypeController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof ProductTypeController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof ProductTypeController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = ProductTypeResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('ProductTypeResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['productTypes', 'productType', 'productTypeCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createProductType',
				'updateProductType',
				'deleteProductType',
				'softDeleteProductType',
				'recoverProductType'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would
		// be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual(['productType', 'productTypeCount', 'productTypes']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createProductType',
			'deleteProductType',
			'recoverProductType',
			'softDeleteProductType',
			'updateProductType'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type ProductTypeConnection \{\s*nodes: \[ProductType!\]!\s*edges: \[ProductTypeEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ProductTypeEdge \{\s*node: ProductType!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ProductTypeFilter \{/);
		expect(printed).toMatch(/input ProductTypeSort \{/);
		expect(printed).toMatch(/enum ProductTypeSortField \{\s*createdAt\s*updatedAt\s*name\s*icon\s*\}/);
	});

	it('carries the translated members the delivered reader merges, and not the collection it drops', () => {
		const body = typeBody('ProductType');

		expect(body).toMatch(/name: String/);
		expect(body).toMatch(/description: String/);
		expect(body).toMatch(/icon: String/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
		// The merge copies the members out of the translation collection and deletes it in the same
		// step, so a `translations` member would be absent from exactly the rows this surface answers.
		expect(body).not.toContain('translations');
		// The reverse side is loaded only when a REST caller names it in `relations`, which this
		// surface's read does not: the products of a type are reachable as `Product.productTypeId`.
		expect(body).not.toContain('products');
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list method reads live rows only, so the connection does not offer `withDeleted`.
		expect(printed).not.toMatch(/productTypes\([^)]*withDeleted/);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/productTypeCount\(/);
	});
});

describe('ProductTypeResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, productTypeService } = surfaces();

		const connection = await resolver.productTypes(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, in the language the same request names.
		expect(productTypeService.findProductTypes).toHaveBeenCalledWith({}, LanguagesEnum.ENGLISH);
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(PHYSICAL);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.productTypes();

		expect(connection.nodes.map((node) => node.id)).toEqual([PHYSICAL, DIGITAL]);
	});

	it('narrows by the fields the filter declares, including the merged name', async () => {
		const { resolver } = surfaces();

		const byIcon = await resolver.productTypes({ icon: { eq: 'flash-outline' } });
		expect(byIcon.nodes.map((node) => node.id)).toEqual([DIGITAL]);

		const byName = await resolver.productTypes({ name: { ilike: 'dig%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([DIGITAL]);

		// A type whose translation did not match carries neither merged member, which is what `isNull`
		// states and what an `eq` never matches.
		expect((await resolver.productTypes({ name: { isNull: true } })).totalCount).toBe(0);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.productTypes(undefined, [{ field: 'name', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([DIGITAL, PHYSICAL]);

		const byIcon = await resolver.productTypes(undefined, [{ field: 'icon', direction: 'ASC' }]);
		expect(byIcon.nodes.map((node) => node.id)).toEqual([PHYSICAL, DIGITAL]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.productTypes(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([PHYSICAL]);

		const second = await resolver.productTypes(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([DIGITAL]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.productTypes(undefined, undefined, undefined, 20);

		const last = await resolver.productTypes(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([PHYSICAL]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.productTypes(undefined, [{ field: 'products', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.productTypes({ products: { eq: PHYSICAL } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.productTypes(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('ProductTypeResolver — one concept, two protocols, the same operations', () => {
	it('reads one type through the same service method the REST route calls', async () => {
		const { resolver, productTypeService } = surfaces();

		expect(await resolver.productType(PHYSICAL)).toBe(ROWS[0]);
		expect(productTypeService.findOneByIdString).toHaveBeenCalledWith(PHYSICAL);
	});

	it('answers null for a type that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, productTypeService } = surfaces();
		productTypeService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.productType(DIGITAL)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, productTypeService } = surfaces();

		expect(await resolver.productTypeCount()).toBe(2);
		expect(productTypeService.countBy).toHaveBeenCalledWith();
	});

	it('declares a type through the command the REST route dispatches, in the caller’s language', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createProductType({
			organizationId: ORGANIZATION,
			icon: 'car-outline',
			translations: [{ languageCode: LanguagesEnum.ENGLISH, name: 'Physical' }]
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(ProductTypeCreateCommand);
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			icon: 'car-outline',
			translations: [{ languageCode: LanguagesEnum.ENGLISH, name: 'Physical' }]
		});
		expect(command.language).toBe(LanguagesEnum.ENGLISH);
	});

	it('replaces a type through the same service method the REST route calls', async () => {
		const { resolver, productTypeService } = surfaces();

		await resolver.updateProductType({ id: PHYSICAL, organizationId: ORGANIZATION, icon: 'home-outline' });

		expect(productTypeService.updateProductType).toHaveBeenCalledWith(
			PHYSICAL,
			expect.objectContaining({ id: PHYSICAL, icon: 'home-outline' })
		);
	});

	it('removes a type through the same service method the REST route calls', async () => {
		const { resolver, productTypeService } = surfaces();

		expect(await resolver.deleteProductType(PHYSICAL)).toBe(true);
		expect(productTypeService.delete).toHaveBeenCalledWith(PHYSICAL);
	});

	it('withdraws and restores a type through the same service methods the REST routes call', async () => {
		const { resolver, productTypeService } = surfaces();

		const withdrawn = await resolver.softDeleteProductType(PHYSICAL);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(productTypeService.softRemove).toHaveBeenCalledWith(PHYSICAL);

		expect(await resolver.recoverProductType(PHYSICAL)).toBe(ROWS[0]);
		expect(productTypeService.softRecover).toHaveBeenCalledWith(PHYSICAL);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, productTypeService } = surfaces();
		const refusal = new Error('PRODUCT_TYPE_STILL_REFERENCED: a product is still classified under this type.');

		productTypeService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteProductType(PHYSICAL)).rejects.toBe(refusal);
	});
});

describe('ProductTypeResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', ProductTypeResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', ProductTypeController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', ProductTypeResolver) ?? [];
		const routes = ['findAll', 'findById', 'getCount', 'create', 'update', 'delete', 'softRemove', 'softRecover'];

		for (const handler of routes) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that added a guard of its own would narrow
			// REST below GraphQL and is caught here.
			expect([...guardsOfRoute(ProductTypeController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductTypeResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, ProductTypeController)
		);
		expect(permissionOfField('createProductType')).toEqual([PermissionsEnum.ORG_PRODUCT_TYPES_EDIT]);
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['productTypes', 'findAll'],
			['productType', 'findById'],
			['productTypeCount', 'getCount'],
			['createProductType', 'create'],
			['updateProductType', 'update'],
			['deleteProductType', 'delete'],
			['softDeleteProductType', 'softRemove'],
			['recoverProductType', 'softRecover']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(ProductTypeController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the edit permission on the node query, because the route it mirrors does', () => {
		// The delivered `GET /:id` is inherited from the base controller without a permission of its
		// own, so it runs under the controller's class-level permission — and the field states the same
		// one rather than the view permission its read siblings carry. Reading one type and listing them
		// requiring different grants is the controller's asymmetry; widening it here, on one surface
		// only, is exactly what the two-protocol rule forbids.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductTypeController.prototype.findById)).toBeUndefined();
		expect(permissionOfField('productType')).toEqual([PermissionsEnum.ORG_PRODUCT_TYPES_EDIT]);
		expect(permissionOfRoute(ProductTypeController, 'findById')).toEqual([PermissionsEnum.ORG_PRODUCT_TYPES_EDIT]);

		// The read routes that do state the view permission state it here too, and never the edit one.
		for (const field of ['productTypes', 'productTypeCount']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_PRODUCT_TYPES_VIEW]);
		}
	});
});

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller’s scope.
 * @returns The guard and the service it resolves through.
 */
function gate(enabled: boolean) {
	const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
	const featureService = { isFeatureEnabled: jest.fn().mockResolvedValue(enabled) };

	return {
		guard: new FeatureFlagGuard(cache as never, new Reflector(), featureService as never),
		featureService
	};
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (ProductTypeResolver.prototype as never)[field],
		getClass: () => ProductTypeResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ProductTypeResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, ProductTypeResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ProductTypeResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('productTypes')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('productTypes');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('productTypes'))).resolves.toBe(true);
	});
});
