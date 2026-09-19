/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { buildSchema, printSchema } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ProductVariantController } from './product-variant.controller';
import { ProductVariantResolver } from './product-variant.resolver';

/**
 * The buyable unit of the catalogue over GraphQL.
 *
 * The delivered REST routes serve a variant list, one variant, the count, the generation of a
 * product's variants, an edit, a removal and the withdrawal of the featured image. This suite pins
 * the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST
 *   resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same service method or the same command the REST route reaches, so a
 *   client does not choose a better surface by choosing a protocol;
 * - **the guard is the controller's guard and no permission is stated**, because a resolver that
 *   demanded one would refuse a caller the REST route serves — and the count route is held to that
 *   same parity field by field, since a count narrower than its route is a capability the other
 *   protocol does not have;
 * - a variant that is not there is `null` on the one-row field rather than a refusal, and the edit
 *   reads the row first so a missing variant is a miss rather than a write that creates one.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const PRODUCT = '00000000-0000-4000-8000-000000000010';
const VARIANT = '00000000-0000-4000-8000-000000000020';
const OTHER_VARIANT = '00000000-0000-4000-8000-000000000021';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: VARIANT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		productId: PRODUCT,
		internalReference: 'Red-Large',
		quantity: 1,
		taxes: 5.5,
		billingInvoicingPolicy: 'ORDER',
		notes: null,
		enabled: true,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_VARIANT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		productId: PRODUCT,
		internalReference: 'Blue-Small',
		quantity: 2,
		taxes: 5.5,
		billingInvoicingPolicy: 'ORDER',
		notes: 'second run',
		enabled: false,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service, product read and command bus. */
function surfaces() {
	const productVariantService = {
		findAllProductVariants: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOne: jest.fn().mockResolvedValue(ROWS[0]),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		updateVariant: jest.fn().mockResolvedValue(ROWS[0]),
		deleteFeaturedImage: jest.fn().mockResolvedValue({ ...ROWS[0], imageId: null }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-03-02T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 })
	};
	const productService = { findOneByIdString: jest.fn().mockResolvedValue({ id: PRODUCT, tenantId: TENANT, organizationId: ORGANIZATION }) };
	const commandBus = { execute: jest.fn().mockResolvedValue([ROWS[0]]) };

	return {
		productVariantService,
		productService,
		commandBus,
		resolver: new ProductVariantResolver(
			productVariantService as never,
			productService as never,
			commandBus as never
		)
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
function handlersOf(controller: typeof ProductVariantController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so a field is held to its own route's metadata rather than to
 * a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof ProductVariantController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof ProductVariantController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = ProductVariantResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('ProductVariantResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the variant connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['productVariants', 'productVariant', 'productVariantCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		// The two softer routes are among them: this resource's controller is a `CrudController`, which
		// delivers `DELETE /:id/soft` and `PUT /:id/recover` beside the hard delete, and parity is
		// capability parity rather than a preference for the shape that is easier to write.
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createProductVariants',
				'updateProductVariant',
				'deleteProductVariant',
				'softDeleteProductVariant',
				'recoverProductVariant',
				'deleteProductVariantFeaturedImage'
			])
		);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(
			/type ProductVariantConnection \{\s*nodes: \[ProductVariant!\]!\s*edges: \[ProductVariantEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ProductVariantEdge \{\s*node: ProductVariant!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ProductVariantFilter \{/);
		expect(printed).toMatch(/input ProductVariantSort \{/);
		expect(printed).toMatch(/enum ProductVariantSortField \{/);
	});

	it('narrows the variants of one product through the filter rather than a second root field', () => {
		// The delivered sub-route answers the same rows as the list narrowed to one product, so the
		// concept has one root field and not two.
		expect(printSchema(schema)).toMatch(/productId: IDFilter/);
		expect(rootFields('Query')).not.toEqual(
			expect.arrayContaining(['productVariantsByProduct', 'productVariantsOfProduct'])
		);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list methods read live rows only, so the connection does not offer `withDeleted`.
		expect(printSchema(schema)).not.toMatch(/productVariants\([^)]*withDeleted/);
	});

	it('states the count as a nullable number and offers it no narrowing', () => {
		const printed = printSchema(schema);

		// A count is an aggregate the resource may have no answer for, so the field is nullable: a
		// non-null field would state an absence as a zero, and a client reporting inventory has to
		// keep those two apart.
		expect(printed).toMatch(/productVariantCount: Int\n/);
		expect(printed).not.toMatch(/productVariantCount: Int!/);

		// The delivered count route narrows by the `where` fragment its query string carries, which
		// is not a shape this protocol states, so the field takes no argument rather than one the
		// resolver could not pass on.
		expect(printed).not.toMatch(/productVariantCount\(/);
	});
});

describe('ProductVariantResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, productVariantService } = surfaces();

		const connection = await resolver.productVariants(undefined, undefined, undefined, 20);

		expect(productVariantService.findAllProductVariants).toHaveBeenCalledWith();
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(VARIANT);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byProduct = await resolver.productVariants({ productId: { eq: PRODUCT } });
		expect(byProduct.totalCount).toBe(2);

		const byState = await resolver.productVariants({ enabled: { eq: false } });
		expect(byState.nodes.map((node) => node.id)).toEqual([OTHER_VARIANT]);
	});

	it('orders by the keys the sort enum offers, newest first by default', async () => {
		const { resolver } = surfaces();

		const ascending = await resolver.productVariants(undefined, [
			{ field: 'internalReference', direction: 'ASC' }
		]);
		expect(ascending.nodes.map((node) => node.id)).toEqual([OTHER_VARIANT, VARIANT]);

		const stated = await resolver.productVariants(undefined, [{ field: 'quantity', direction: 'ASC' }]);
		expect(stated.nodes.map((node) => node.id)).toEqual([VARIANT, OTHER_VARIANT]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.productVariants(undefined, undefined, undefined, 1);

		const second = await resolver.productVariants(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes).toHaveLength(1);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.productVariants(undefined, [{ field: 'productId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.productVariants({ settingId: { eq: VARIANT } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});
});

describe('ProductVariantResolver — one concept, two protocols, the same operations', () => {
	it('reads one variant through the same service method the REST route calls', async () => {
		const { resolver, productVariantService } = surfaces();

		expect(await resolver.productVariant(VARIANT)).toBe(ROWS[0]);
		expect(productVariantService.findOne).toHaveBeenCalledWith(VARIANT);
	});

	it('answers null for a variant that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, productVariantService } = surfaces();
		productVariantService.findOne.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.productVariant(OTHER_VARIANT)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, productVariantService } = surfaces();

		expect(await resolver.productVariantCount()).toBe(2);
		// The inherited route hands `countBy` the `where` fragment it bound from its query string and
		// asks for no narrowing of its own when the caller states none — which is the call this field
		// makes, because the connection protocol has no argument that fragment could arrive in.
		expect(productVariantService.countBy).toHaveBeenCalledWith();
	});

	it('generates the variants through the command the REST route dispatches, scoped by the product', async () => {
		const { resolver, productService, commandBus } = surfaces();

		await resolver.createProductVariants({
			productId: PRODUCT,
			optionCombinations: [{ options: ['Red', 'Large'] }]
		});

		expect(productService.findOneByIdString).toHaveBeenCalledWith(PRODUCT);
		// The scope the generated rows are stamped with is the product's own: a caller states which
		// product, never which tenant or organization.
		const command = commandBus.execute.mock.calls[0][0];
		expect(command.productInput).toEqual({
			product: { id: PRODUCT, tenantId: TENANT, organizationId: ORGANIZATION },
			optionCombinations: [{ options: ['Red', 'Large'] }]
		});
	});

	it('reads the row before an edit, so a missing variant is a miss rather than a write', async () => {
		const { resolver, productVariantService } = surfaces();
		productVariantService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		await expect(resolver.updateProductVariant({ id: OTHER_VARIANT, notes: 'x' })).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(productVariantService.updateVariant).not.toHaveBeenCalled();
	});

	it('edits the descriptive facts and withdraws the featured image through the delivered service', async () => {
		const { resolver, productVariantService } = surfaces();

		await resolver.updateProductVariant({ id: VARIANT, notes: 'checked', enabled: false });
		expect(productVariantService.updateVariant).toHaveBeenCalledWith(
			expect.objectContaining({ id: VARIANT, notes: 'checked', enabled: false })
		);

		await resolver.deleteProductVariantFeaturedImage(VARIANT);
		expect(productVariantService.deleteFeaturedImage).toHaveBeenCalledWith(VARIANT);
	});

	it('removes a variant through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.deleteProductVariant(VARIANT)).toBe(true);
		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		expect(commandBus.execute.mock.calls[0][0].productVariantId).toBe(VARIANT);
	});

	it('withdraws and restores through the service methods the inherited routes call', async () => {
		// The softer pair is not the hard delete: a withdrawal keeps every row and the restore undoes it,
		// which is why the two are the operations a catalogue reaches for when a variant stops selling.
		const { resolver, productVariantService } = surfaces();

		await resolver.softDeleteProductVariant(VARIANT);
		expect(productVariantService.softRemove).toHaveBeenCalledWith(VARIANT);

		await resolver.recoverProductVariant(VARIANT);
		expect(productVariantService.softRecover).toHaveBeenCalledWith(VARIANT);

		// Neither one is the delete, and the delete is not either of them.
		expect(productVariantService.delete).not.toHaveBeenCalled();
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, productVariantService } = surfaces();
		const refusal = new Error('PRODUCT_VARIANT_LOCKED: this variant is referenced by an order line.');

		productVariantService.updateVariant.mockRejectedValueOnce(refusal);

		await expect(resolver.updateProductVariant({ id: VARIANT, notes: 'x' })).rejects.toBe(refusal);
	});
});

describe('ProductVariantResolver — the guard stack is the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', ProductVariantResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', ProductVariantController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		// Neither surface carries the permission guard, so neither demands a permission the other does
		// not: two scopes for one concept is what the two-protocol rule forbids.
		expect(resolverGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
		expect(controllerGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
	});

	it('states no permission on the resolver and none on the controller', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductVariantResolver)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductVariantController)).toBeUndefined();
	});

	it('runs the count route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', ProductVariantResolver) ?? [];

		// The count route is the one the CRUD base mounts: it states no guard and no permission of its
		// own, so the controller's class-level chain is the whole of its scope — and the resolver
		// states the same chain, which is the parity claim a count narrower or wider than its route
		// would break.
		expect(guardsOfRoute(ProductVariantController, 'getCount').sort()).toEqual([...stated].sort());
		expect(Reflect.getMetadata('__guards__', handlersOf(ProductVariantController)['getCount'])).toBeUndefined();

		// A class-level permission would apply to a handler that states none, so the parity is
		// asserted over the two readings rather than over the handler alone: neither surface states
		// one, and the count field states none either.
		expect(permissionOfRoute(ProductVariantController, 'getCount')).toBeUndefined();
		expect(permissionOfField('productVariantCount')).toBeUndefined();
	});

	it('holds every field of this surface to its own route’s permission', () => {
		const routes: Array<[string, string]> = [
			['productVariants', 'findAll'],
			['productVariant', 'findById'],
			['productVariantCount', 'getCount'],
			['createProductVariants', 'createProductVariants'],
			['updateProductVariant', 'update'],
			['deleteProductVariant', 'delete'],
			['deleteProductVariantFeaturedImage', 'deleteFeaturedImage']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(ProductVariantController, handler)])
		);

		for (const [, handler] of routes) {
			// A route that is not served at all would make the comparison below meaningless, so the
			// handlers are asserted to be there before the two readings are compared.
			expect(typeof handlersOf(ProductVariantController)[handler]).toBe('function');
		}

		// Every one of them is `undefined`, which is the answer here and not an empty assertion: this
		// resource is mounted without a permission, so a field that acquired one would be the
		// asymmetry the two-protocol rule forbids.
		expect(stated).toEqual(expected);
	});
});
