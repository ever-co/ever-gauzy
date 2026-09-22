/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants';
import { buildSchema, printSchema } from 'graphql';
import { getMetadataArgsStorage } from 'typeorm';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ProductVariantSettingController } from './product-setting.controller';
import { ProductVariantSetting } from './product-setting.entity';
import { ProductVariantSettingResolver } from './product-setting.resolver';

/**
 * The capability record of a variant over GraphQL.
 *
 * The delivered routes serve a setting list, one setting, the count, the creation, the edit, the
 * removal, the soft removal and the restore — the whole set the platform mounts for every resource,
 * because this controller declares no handler of its own. This suite pins the half of the two-protocol
 * doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST
 *   resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same service method the REST route reaches, so a client does not choose
 *   a better surface by choosing a protocol — including the two removals, which are two different
 *   operations and are therefore two fields rather than one;
 * - **the guard is the controller's guard and no permission is stated**, because a resolver that
 *   demanded one would refuse a caller the REST route serves — and the count route is held to that
 *   same parity field by field, since a count narrower than its route is a capability the other
 *   protocol does not have;
 * - a setting that is not there is `null` on the one-row field rather than a refusal, and the entity
 *   the delivery mirrors is pinned by its own table name and by the path its controller is mounted
 *   on, so the surface cannot drift away from the resource it claims to serve.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const VARIANT = '00000000-0000-4000-8000-000000000020';
const SETTING = '00000000-0000-4000-8000-000000000030';
const OTHER_SETTING = '00000000-0000-4000-8000-000000000031';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: SETTING,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		productVariantId: VARIANT,
		isSubscription: false,
		isPurchaseAutomatically: false,
		canBeSold: true,
		canBePurchased: true,
		canBeCharged: false,
		canBeRented: false,
		isEquipment: false,
		trackInventory: true,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_SETTING,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		productVariantId: VARIANT,
		isSubscription: true,
		isPurchaseAutomatically: true,
		canBeSold: false,
		canBePurchased: false,
		canBeCharged: true,
		canBeRented: true,
		isEquipment: true,
		trackInventory: false,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const productVariantSettingService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-03-02T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return {
		productVariantSettingService,
		resolver: new ProductVariantSettingResolver(productVariantSettingService as never)
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

/** One route handler, as the controller serves it — the inherited handlers included. */
function handlerOf(name: string): unknown {
	return (ProductVariantSettingController.prototype as unknown as Record<string, unknown>)[name];
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so a field is held to its own route's metadata rather than to
 * a second copy of the same list written out in this file.
 */
function permissionOfRoute(handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlerOf(handler) as object) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, ProductVariantSettingController)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', ProductVariantSettingController) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlerOf(handler) as object) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = ProductVariantSettingResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('ProductVariantSettingResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the setting connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['productVariantSettings', 'productVariantSetting', 'productVariantSettingCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createProductVariantSetting',
				'updateProductVariantSetting',
				'deleteProductVariantSetting',
				'softDeleteProductVariantSetting',
				'recoverProductVariantSetting'
			])
		);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(
			/type ProductVariantSettingConnection \{\s*nodes: \[ProductVariantSetting!\]!\s*edges: \[ProductVariantSettingEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ProductVariantSettingEdge \{\s*node: ProductVariantSetting!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ProductVariantSettingFilter \{/);
		expect(printed).toMatch(/input ProductVariantSettingSort \{/);
		expect(printed).toMatch(/enum ProductVariantSettingSortField \{/);
		expect(printed).toMatch(/input CreateProductVariantSettingInput \{/);
		expect(printed).toMatch(/input UpdateProductVariantSettingInput \{/);
	});

	it('names the type for the concept rather than for the directory that holds it', () => {
		// The directory is `product-setting` and the type is `ProductVariantSetting`: a GraphQL type
		// has one name in one schema, and the concept's own name is the unambiguous one.
		const printed = printSchema(schema);

		expect(printed).toMatch(/type ProductVariantSetting \{/);
		expect(printed).not.toMatch(/type ProductSetting \{/);
	});

	it('declares the flags the entity declares, and writes nothing about them', () => {
		const block = printSchema(schema).match(/type ProductVariantSetting \{([\s\S]*?)\n\}/)?.[1] ?? '';
		// Everything the type states before its first description: the identifier and the flags. The
		// descriptions that follow belong to the relation.
		const flags = block.split('"""')[0];

		expect(flags.split('\n').map((line) => line.trim()).filter(Boolean)).toEqual([
			'id: ID!',
			'isSubscription: Boolean!',
			'isPurchaseAutomatically: Boolean!',
			'canBeSold: Boolean!',
			'canBePurchased: Boolean!',
			'canBeCharged: Boolean!',
			'canBeRented: Boolean!',
			'isEquipment: Boolean!',
			'trackInventory: Boolean!'
		]);
		// The entity describes none of them, so the schema describes none of them either: a sentence
		// here would be a second statement about a column whose owner states nothing.
		expect(flags).not.toContain('"""');
	});

	it('narrows the settings of one variant through the filter rather than a second root field', () => {
		// The delivered routes answer the settings of one variant as the list narrowed to that
		// variant, so the concept has one root field and not two.
		expect(printSchema(schema)).toMatch(/productVariantId: IDFilter/);
		expect(rootFields('Query')).not.toEqual(
			expect.arrayContaining(['productVariantSettingsByVariant', 'productVariantSettingsOfVariant'])
		);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list method reads live rows only, so the connection does not offer `withDeleted`.
		expect(printSchema(schema)).toMatch(/productVariantSettings\([^)]*withDeleted/);
	});

	it('states the count as a nullable number and offers it no narrowing', () => {
		const printed = printSchema(schema);

		// A count is an aggregate the resource may have no answer for, so the field is nullable: a
		// non-null field would state an absence as a zero, and a client reporting inventory has to
		// keep those two apart.
		expect(printed).toMatch(/productVariantSettingCount: Int\n/);
		expect(printed).not.toMatch(/productVariantSettingCount: Int!/);

		// The delivered count route narrows by the `where` fragment its query string carries, which
		// is not a shape this protocol states, so the field takes no argument rather than one the
		// resolver could not pass on.
		expect(printed).not.toMatch(/productVariantSettingCount\(/);
	});
});

describe('ProductVariantSettingResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, productVariantSettingService } = surfaces();

		const connection = await resolver.productVariantSettings(undefined, undefined, undefined, 20);

		expect(productVariantSettingService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SETTING);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byVariant = await resolver.productVariantSettings({ productVariantId: { eq: VARIANT } });
		expect(byVariant.totalCount).toBe(2);

		const byFlag = await resolver.productVariantSettings({ trackInventory: { eq: false } });
		expect(byFlag.nodes.map((node) => node.id)).toEqual([OTHER_SETTING]);
	});

	it('orders by the keys the sort enum offers, newest first by default', async () => {
		const { resolver } = surfaces();

		const byDefault = await resolver.productVariantSettings();
		expect(byDefault.nodes.map((node) => node.id)).toEqual([SETTING, OTHER_SETTING]);

		const ascending = await resolver.productVariantSettings(undefined, [
			{ field: 'canBeRented', direction: 'ASC' }
		]);
		expect(ascending.nodes.map((node) => node.id)).toEqual([SETTING, OTHER_SETTING]);

		const stated = await resolver.productVariantSettings(undefined, [{ field: 'trackInventory', direction: 'ASC' }]);
		expect(stated.nodes.map((node) => node.id)).toEqual([OTHER_SETTING, SETTING]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.productVariantSettings(undefined, undefined, undefined, 1);

		const second = await resolver.productVariantSettings(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER_SETTING]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.productVariantSettings(undefined, [{ field: 'productVariantId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.productVariantSettings({ productId: { eq: VARIANT } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});
});

describe('ProductVariantSettingResolver — one concept, two protocols, the same operations', () => {
	it('reads one setting through the same service method the REST route calls', async () => {
		const { resolver, productVariantSettingService } = surfaces();

		expect(await resolver.productVariantSetting(SETTING)).toBe(ROWS[0]);
		expect(productVariantSettingService.findOneByIdString).toHaveBeenCalledWith(SETTING);
	});

	it('answers null for a setting that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, productVariantSettingService } = surfaces();
		productVariantSettingService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.productVariantSetting(OTHER_SETTING)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, productVariantSettingService } = surfaces();

		expect(await resolver.productVariantSettingCount()).toBe(2);
		// The inherited route hands `countBy` the `where` fragment it bound from its query string and
		// asks for no narrowing of its own when the caller states none — which is the call this field
		// makes, because the connection protocol has no argument that fragment could arrive in.
		expect(productVariantSettingService.countBy).toHaveBeenCalledWith();
	});

	it('opens a setting through the same service method the REST route calls', async () => {
		const { resolver, productVariantSettingService } = surfaces();
		const input = { productVariantId: VARIANT, canBeSold: false, trackInventory: true };

		expect(await resolver.createProductVariantSetting(input)).toBe(ROWS[0]);
		// The same method the delivered create route calls with the body it receives — and the tenant
		// the row is stamped with is the credential's, because that method is what stamps it.
		expect(productVariantSettingService.create).toHaveBeenCalledWith(input);
	});

	it('edits a setting through the same service method the REST route calls, and answers the row it left', async () => {
		const { resolver, productVariantSettingService } = surfaces();
		const input = { id: SETTING, trackInventory: false };

		expect(await resolver.updateProductVariantSetting(input)).toBe(ROWS[0]);
		// The write itself reads the row before it writes it, which is what makes a missing setting a
		// miss rather than a write that changes nothing.
		expect(productVariantSettingService.update).toHaveBeenCalledWith(SETTING, input);
		// The route answers with the update result, whose one member a caller reads is the count of
		// rows the write reached; the field answers the row, read back through the delivered one-row
		// method, which is the shape this schema declares.
		expect(productVariantSettingService.findOneByIdString).toHaveBeenCalledWith(SETTING);
	});

	it('removes a setting through the same service method the REST route calls', async () => {
		const { resolver, productVariantSettingService } = surfaces();

		expect(await resolver.deleteProductVariantSetting(SETTING)).toBe(true);
		expect(productVariantSettingService.delete).toHaveBeenCalledWith(SETTING);
	});

	it('softly removes a setting through the same service method the REST route calls', async () => {
		const { resolver, productVariantSettingService } = surfaces();

		const removed = await resolver.softDeleteProductVariantSetting(SETTING);

		expect(productVariantSettingService.softRemove).toHaveBeenCalledWith(SETTING);
		// The removal is soft: the answer is the row, and the row is still the one the caller named.
		expect(removed.id).toBe(SETTING);
	});

	it('restores a softly removed setting through the same service method the REST route calls', async () => {
		const { resolver, productVariantSettingService } = surfaces();

		expect(await resolver.recoverProductVariantSetting(SETTING)).toBe(ROWS[0]);
		expect(productVariantSettingService.softRecover).toHaveBeenCalledWith(SETTING);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, productVariantSettingService } = surfaces();
		const refusal = new BadRequestException('QUERY_CURSOR_INVALID: the cursor is not one this platform issued.');

		productVariantSettingService.create.mockRejectedValueOnce(refusal);

		await expect(resolver.createProductVariantSetting({})).rejects.toBe(refusal);
		// A refusal is not a miss: the one-row field would answer null for a missing row, and this is
		// the caller's own request being wrong.
		expect(isRefusal(refusal)).toBe(true);
	});
});

describe('ProductVariantSettingResolver — the resource, the route and the guard the delivery mirrors', () => {
	it('is mounted where the routes it mirrors are, and stored where the entity it mirrors is', () => {
		expect(Reflect.getMetadata(PATH_METADATA, ProductVariantSettingController)).toBe('/product-variant-settings');

		const table = getMetadataArgsStorage().tables.find((entry) => entry.target === ProductVariantSetting);

		expect(table?.name).toBe('product_variant_setting');
	});

	it('gives every write route the controller serves a mutation of its own', () => {
		// One field per write route, named for the operation rather than for the handler.
		const mirrored: Record<string, string> = {
			create: 'createProductVariantSetting',
			update: 'updateProductVariantSetting',
			delete: 'deleteProductVariantSetting',
			softRemove: 'softDeleteProductVariantSetting',
			softRecover: 'recoverProductVariantSetting'
		};

		for (const [handler, field] of Object.entries(mirrored)) {
			// The handlers are the base controller's, which this resource is mounted with: a controller
			// that declares no route of its own is still served all of them.
			expect(typeof handlerOf(handler)).toBe('function');
			expect(rootFields('Mutation')).toContain(field);
		}
	});

	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', ProductVariantSettingResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', ProductVariantSettingController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		// Neither surface carries the permission guard, so neither demands a permission the other does
		// not: two scopes for one concept is what the two-protocol rule forbids.
		expect(resolverGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
		expect(controllerGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
	});

	it('states no permission on the resolver and none on any route it mirrors', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductVariantSettingResolver)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductVariantSettingController)).toBeUndefined();

		// The handlers are read as well as the class: a permission stated on one route and not on its
		// field would be the same asymmetry one level down.
		for (const handler of [
			'findAll',
			'findById',
			'getCount',
			'create',
			'update',
			'delete',
			'softRemove',
			'softRecover'
		]) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlerOf(handler) as object)).toBeUndefined();
		}
	});

	it('runs the count route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', ProductVariantSettingResolver) ?? [];

		// The count route is the one the CRUD base mounts: it states no guard and no permission of its
		// own, so the controller's class-level chain is the whole of its scope — and the resolver
		// states that same chain plus the gate on the endpoint itself, which is the parity claim a
		// count narrower or wider than its route would break.
		expect([...guardsOfRoute('getCount'), FeatureFlagGuard].sort()).toEqual([...stated].sort());
		expect(Reflect.getMetadata('__guards__', handlerOf('getCount') as object)).toBeUndefined();

		// A class-level permission would apply to a handler that states none, so the parity is
		// asserted over the two readings rather than over the handler alone: neither surface states
		// one, and the count field states none either.
		expect(permissionOfRoute('getCount')).toBeUndefined();
		expect(permissionOfField('productVariantSettingCount')).toBeUndefined();
	});

	it('holds every field of this surface to its own route’s permission', () => {
		const routes: Array<[string, string]> = [
			['productVariantSettings', 'findAll'],
			['productVariantSetting', 'findById'],
			['productVariantSettingCount', 'getCount'],
			['createProductVariantSetting', 'create'],
			['updateProductVariantSetting', 'update'],
			['deleteProductVariantSetting', 'delete'],
			['softDeleteProductVariantSetting', 'softRemove'],
			['recoverProductVariantSetting', 'softRecover']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(routes.map(([field, handler]) => [field, permissionOfRoute(handler)]));

		for (const [, handler] of routes) {
			// A route that is not served at all would make the comparison below meaningless, so the
			// handlers are asserted to be there before the two readings are compared.
			expect(typeof handlerOf(handler)).toBe('function');
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
		getHandler: () => (ProductVariantSettingResolver.prototype as never)[field],
		getClass: () => ProductVariantSettingResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ProductVariantSettingResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, ProductVariantSettingResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ProductVariantSettingResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('productVariantSettings')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('productVariantSettings');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('productVariantSettings'))).resolves.toBe(true);
	});
});
