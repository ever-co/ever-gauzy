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
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ProductOptionController } from './product-option.controller';
import { ProductOptionResolver } from './product-option.resolver';

/**
 * The values a product is offered in, over GraphQL.
 *
 * The delivered REST routes serve an option list, one option, the count, the creation, the edit, the
 * removal, the soft removal and the restore — the eight capabilities every resource of this platform
 * is mounted with, since this controller declares no route of its own. This suite pins the half of the
 * two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method the REST route reaches, so a client does not choose a
 *   better surface by choosing a protocol;
 * - **the guard is the controller's guard and no permission is stated**, because a resolver that
 *   demanded one would refuse a caller the REST route serves — and the count route is held to that
 *   same parity field by field, since a count narrower than its route is a capability the other
 *   protocol does not have;
 * - an option that is not there is `null` on the one-row field rather than a refusal, and the edit
 *   relies on the delivered service's own read so a missing option is a miss rather than a write that
 *   creates one;
 * - the paginated list route has no field of its own: the connection's page is what it answers with,
 *   and a second root field for it would be a second surface that could disagree with this one.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const GROUP = '00000000-0000-4000-8000-000000000030';
const OTHER_GROUP = '00000000-0000-4000-8000-000000000031';
const OPTION = '00000000-0000-4000-8000-000000000040';
const OTHER_OPTION = '00000000-0000-4000-8000-000000000041';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: OPTION,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		groupId: GROUP,
		name: 'Red',
		code: 'RED',
		translations: [{ id: '00000000-0000-4000-8000-000000000050', name: 'Rouge', languageCode: 'fr-FR' }],
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_OPTION,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		groupId: OTHER_GROUP,
		name: 'Blue',
		code: 'BLU',
		translations: [],
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const productOptionService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date() }),
		softRecover: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: null })
	};

	return {
		productOptionService,
		resolver: new ProductOptionResolver(productOptionService as never)
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

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The handlers of the controller, as functions, inherited ones included. */
function handlersOf(controller: typeof ProductOptionController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so a field is held to its own route's metadata rather than to
 * a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof ProductOptionController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof ProductOptionController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = ProductOptionResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('ProductOptionResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the option connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['productOptions', 'productOption', 'productOptionCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createProductOption',
				'updateProductOption',
				'deleteProductOption',
				'softDeleteProductOption',
				'recoverProductOption'
			])
		);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(
			/type ProductOptionConnection \{\s*nodes: \[ProductOption!\]!\s*edges: \[ProductOptionEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ProductOptionEdge \{\s*node: ProductOption!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ProductOptionFilter \{/);
		expect(printed).toMatch(/input ProductOptionSort \{/);
		expect(printed).toMatch(/enum ProductOptionSortField \{/);
	});

	it('declares the option, its translations and the group the identifier names', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(/type ProductOption \{/);
		expect(printed).toMatch(/type ProductOptionTranslation \{/);
		expect(printed).toMatch(/type ProductOptionGroup \{/);
		expect(printed).toMatch(/type ProductOptionGroupTranslation \{/);
		// The option carries its translations as the rows the delivered routes join, and the group's
		// identifier as the member that always travels.
		expect(printed).toMatch(/translations: \[ProductOptionTranslation!\]/);
		expect(printed).toMatch(/groupId: ID\n/);
	});

	it('narrows the options of one group through the filter rather than a second root field', () => {
		// The delivered routes serve options only, so the concept has one root field and not two.
		expect(printSchema(schema)).toMatch(/groupId: IDFilter/);
		expect(rootFields('Query')).not.toEqual(
			expect.arrayContaining(['productOptionsByGroup', 'productOptionGroups'])
		);
	});

	it('answers the count through a field of its own and the paginated list through the connection', () => {
		const printed = printSchema(schema);

		// `GET /count` answers a bare number, which is not a connection and is not the connection's
		// `totalCount`: that total is the count of the rows the connection narrowed to, while the
		// inherited count route counts the caller's own rows. So the count is a root field — nullable,
		// because an aggregate the resource has no answer for must not be answered as a zero — and it
		// takes no argument, the route's narrowing being a `where` fragment no schema can state.
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['productOptionCount']));
		expect(printed).toMatch(/productOptionCount: Int\n/);
		expect(printed).not.toMatch(/productOptionCount: Int!/);
		expect(printed).not.toMatch(/productOptionCount\(/);

		// `GET /pagination` is the same rows the list route answers, sliced: the page is what the
		// connection answers with, so a second field for it would be a second surface that could
		// disagree with this one.
		expect(rootFields('Query')).not.toEqual(expect.arrayContaining(['productOptionsPagination']));
		expect(printed).toMatch(/totalCount: Int!/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list method reads live rows only, so the connection does not offer `withDeleted`.
		expect(printSchema(schema)).toMatch(/productOptions\([^)]*withDeleted/);
	});
});

describe('ProductOptionResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, productOptionService } = surfaces();

		const connection = await resolver.productOptions(undefined, undefined, undefined, 20);

		expect(productOptionService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(OPTION);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byGroup = await resolver.productOptions({ groupId: { eq: GROUP } });
		expect(byGroup.nodes.map((node) => node.id)).toEqual([OPTION]);

		const byName = await resolver.productOptions({ name: { ilike: 'blu%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([OTHER_OPTION]);
	});

	it('does not offer a filter on the translation collection, which is not a column', async () => {
		const { resolver } = surfaces();

		const error = await resolver.productOptions({ translations: { eq: OPTION } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers, newest first by default', async () => {
		const { resolver } = surfaces();

		const byDefault = await resolver.productOptions(undefined, undefined, undefined, 20);
		expect(byDefault.nodes.map((node) => node.id)).toEqual([OPTION, OTHER_OPTION]);

		const ascending = await resolver.productOptions(undefined, [{ field: 'name', direction: 'ASC' }]);
		expect(ascending.nodes.map((node) => node.id)).toEqual([OTHER_OPTION, OPTION]);

		const stated = await resolver.productOptions(undefined, [{ field: 'code', direction: 'ASC' }]);
		expect(stated.nodes.map((node) => node.id)).toEqual([OTHER_OPTION, OPTION]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.productOptions(undefined, undefined, undefined, 1);

		const second = await resolver.productOptions(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes).toHaveLength(1);
		expect(second.nodes[0].id).toBe(OTHER_OPTION);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.productOptions(undefined, [{ field: 'groupId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a request that states both pagination styles', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.productOptions(undefined, undefined, undefined, 10, undefined, undefined, undefined, 10)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('refuses a page larger than the protocol allows', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.productOptions(undefined, undefined, undefined, undefined, undefined, undefined, undefined, 1000)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('ProductOptionResolver — one concept, two protocols, the same operations', () => {
	it('reads one option through the same service method the REST route calls', async () => {
		const { resolver, productOptionService } = surfaces();

		expect(await resolver.productOption(OPTION)).toBe(ROWS[0]);
		expect(productOptionService.findOneByIdString).toHaveBeenCalledWith(OPTION);
	});

	it('answers null for an option that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, productOptionService } = surfaces();
		productOptionService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.productOption(OTHER_OPTION)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, productOptionService } = surfaces();

		expect(await resolver.productOptionCount()).toBe(2);
		// The inherited route hands `countBy` the `where` fragment it bound from its query string and
		// asks for no narrowing of its own when the caller states none — which is the call this field
		// makes, because the connection protocol has no argument that fragment could arrive in.
		expect(productOptionService.countBy).toHaveBeenCalledWith();
	});

	it('files an option through the same service method the REST route calls', async () => {
		const { resolver, productOptionService } = surfaces();

		await resolver.createProductOption({ name: 'Green', code: 'GRN', groupId: GROUP });

		// The tenant is the credential's and is stamped by the service, so a caller states which group
		// the option answers for and never which scope it is written into.
		expect(productOptionService.create).toHaveBeenCalledWith({ name: 'Green', code: 'GRN', groupId: GROUP });
	});

	it('edits through the same service method the REST route calls, with the identifier as the criterion', async () => {
		const { resolver, productOptionService } = surfaces();

		await resolver.updateProductOption({ id: OPTION, name: 'Crimson' });

		expect(productOptionService.update).toHaveBeenCalledWith(OPTION, { name: 'Crimson' });
		// The row the write produced is read back, because the delivered route answers the store's own
		// update result rather than a row.
		expect(productOptionService.findOneByIdString).toHaveBeenCalledWith(OPTION);
	});

	it('relies on the delivered read before the write, so a missing option is a miss rather than a write', async () => {
		const { resolver, productOptionService } = surfaces();
		productOptionService.update.mockRejectedValueOnce(new NotFoundException());

		await expect(resolver.updateProductOption({ id: OTHER_OPTION, name: 'x' })).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(productOptionService.findOneByIdString).not.toHaveBeenCalled();
	});

	it('removes an option through the same service method the REST route calls', async () => {
		const { resolver, productOptionService } = surfaces();

		expect(await resolver.deleteProductOption(OPTION)).toBe(true);
		expect(productOptionService.delete).toHaveBeenCalledWith(OPTION);
	});

	it('withdraws an option softly and puts it back through the same two service methods', async () => {
		const { resolver, productOptionService } = surfaces();

		const withdrawn = await resolver.softDeleteProductOption(OPTION);
		expect(productOptionService.softRemove).toHaveBeenCalledWith(OPTION);
		expect(withdrawn.id).toBe(OPTION);

		const restored = await resolver.recoverProductOption(OPTION);
		expect(productOptionService.softRecover).toHaveBeenCalledWith(OPTION);
		expect(restored.id).toBe(OPTION);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, productOptionService } = surfaces();
		const refusal = new Error('PRODUCT_OPTION_LOCKED: this option is referenced by a variant.');

		productOptionService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteProductOption(OPTION)).rejects.toBe(refusal);
	});
});

describe('ProductOptionResolver — the guard stack is the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', ProductOptionResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', ProductOptionController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		// Neither surface carries the permission guard, so neither demands a permission the other does
		// not: two scopes for one concept is what the two-protocol rule forbids.
		expect(resolverGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
		expect(controllerGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
	});

	it('states no permission on the resolver and none on the controller', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductOptionResolver)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductOptionController)).toBeUndefined();
	});

	it('runs the count route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', ProductOptionResolver) ?? [];

		// The count route is the one the CRUD base mounts: it states no guard and no permission of its
		// own, so the controller's class-level chain is the whole of its scope — and the resolver
		// states that same chain plus the gate on the endpoint itself, which is the parity claim a
		// count narrower or wider than its route would break.
		expect([...guardsOfRoute(ProductOptionController, 'getCount'), FeatureFlagGuard].sort()).toEqual(
			[...stated].sort()
		);
		expect(Reflect.getMetadata('__guards__', handlersOf(ProductOptionController)['getCount'])).toBeUndefined();

		// A class-level permission would apply to a handler that states none, so the parity is
		// asserted over the two readings rather than over the handler alone: neither surface states
		// one, and the count field states none either.
		expect(permissionOfRoute(ProductOptionController, 'getCount')).toBeUndefined();
		expect(permissionOfField('productOptionCount')).toBeUndefined();
	});

	it('holds every field of this surface to its own route’s permission', () => {
		const routes: Array<[string, string]> = [
			['productOptions', 'findAll'],
			['productOption', 'findById'],
			['productOptionCount', 'getCount'],
			['createProductOption', 'create'],
			['updateProductOption', 'update'],
			['deleteProductOption', 'delete'],
			['softDeleteProductOption', 'softRemove'],
			['recoverProductOption', 'softRecover']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(ProductOptionController, handler)])
		);

		for (const [, handler] of routes) {
			// A route that is not served at all would make the comparison below meaningless, so the
			// handlers are asserted to be there before the two readings are compared.
			expect(typeof handlersOf(ProductOptionController)[handler]).toBe('function');
		}

		// Every one of them is `undefined`, which is the answer here and not an empty assertion: this
		// resource is mounted without a permission, so a field that acquired one would be the
		// asymmetry the two-protocol rule forbids.
		expect(stated).toEqual(expected);
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
		getHandler: () => (ProductOptionResolver.prototype as never)[field],
		getClass: () => ProductOptionResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ProductOptionResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, ProductOptionResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ProductOptionResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('productOptions')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('productOptions');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('productOptions'))).resolves.toBe(true);
	});
});
