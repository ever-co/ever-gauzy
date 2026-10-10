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
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { MerchantController } from './merchant.controller';
import { MerchantResolver } from './merchant.resolver';

/**
 * The store over GraphQL.
 *
 * The delivered `/api/merchants` routes serve a count, a page, a list, one store, a filing, an edit, a
 * removal and the withdrawal and restoration of a store. This suite pins the half of the
 * two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field, and the list is a connection with the platform's
 *   own cursor codec behind it;
 * - every field reaches the same `MerchantService` method the REST route reaches;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — the reads under the class's *view* override, the writes under the class's edit one;
 * - the two many-to-many pivots are written and never read, because the row carries no identifier for
 *   them and the delivered reads join neither;
 * - a store that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CONTACT = '00000000-0000-4000-8000-000000000030';
const TAG = '00000000-0000-4000-8000-000000000050';
const WAREHOUSE = '00000000-0000-4000-8000-000000000060';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Northwind',
		code: 'NW',
		email: 'hello@northwind.test',
		phone: null,
		description: 'The flagship store',
		active: true,
		currency: 'USD',
		contactId: CONTACT,
		logoId: null,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Acme',
		code: 'AC',
		email: 'shop@acme.test',
		phone: '+1 555 0100',
		description: null,
		active: false,
		currency: 'EUR',
		contactId: null,
		logoId: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const merchantService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findById: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return { merchantService, resolver: new MerchantResolver(merchantService as never) };
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

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input type, for the same reason. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof MerchantController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof MerchantController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof MerchantController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = MerchantResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The field-to-route correspondence this resource's parity claim is made of. */
const ROUTES: Array<[string, string]> = [
	['merchants', 'findAll'],
	['merchant', 'findById'],
	['merchantCount', 'getCount'],
	['createMerchant', 'create'],
	['updateMerchant', 'update'],
	['deleteMerchant', 'delete'],
	['softDeleteMerchant', 'softRemove'],
	['recoverMerchant', 'softRecover']
];

describe('MerchantResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['merchants', 'merchant', 'merchantCount']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createMerchant',
				'updateMerchant',
				'deleteMerchant',
				'softDeleteMerchant',
				'recoverMerchant'
			])
		);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type MerchantConnection \{\s*nodes: \[Merchant!\]!\s*edges: \[MerchantEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type MerchantEdge \{\s*node: Merchant!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input MerchantFilter \{/);
		expect(printed).toMatch(/enum MerchantSortField \{\s*createdAt\s*updatedAt\s*name\s*code\s*email\s*\}/);
	});

	it('carries the row’s own columns, the two owning-side identifiers and neither pivot', () => {
		const body = typeBody('Merchant');

		expect(body).toMatch(/name: String!/);
		expect(body).toMatch(/code: String!/);
		expect(body).toMatch(/email: String!/);
		expect(body).toMatch(/active: Boolean!/);
		// The currency is a code from the money layer's own vocabulary, carried as its value: the
		// value set is not this domain's to declare.
		expect(body).toMatch(/currency: String!/);
		expect(body).toMatch(/contactId: ID\b/);
		expect(body).toMatch(/logoId: ID\b/);
		expect(body).toMatch(/deletedAt: DateTime/);
		// The pivots are many-to-many: this row holds no identifier for them and the delivered reads
		// join neither, so an object member would be null on every row this surface answers.
		expect(body).not.toContain('tags');
		expect(body).not.toContain('warehouses');
		expect(body).not.toMatch(/\bcontact: /);
		expect(body).not.toMatch(/\blogo: /);
	});

	it('states the pivots on the writes as identifier lists and on the reads not at all', () => {
		expect(inputBody('CreateMerchantInput')).toMatch(/tagIds: \[ID!\]/);
		expect(inputBody('CreateMerchantInput')).toMatch(/warehouseIds: \[ID!\]/);
		expect(inputBody('UpdateMerchantInput')).toMatch(/tagIds: \[ID!\]/);
		// A many-to-many is a join rather than a column: a filter naming one would select nothing, so
		// the connection does not offer it.
		expect(inputBody('MerchantFilter')).not.toContain('tagIds');
		expect(inputBody('MerchantFilter')).not.toContain('warehouseIds');
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).not.toMatch(/merchantCount\(/);
	});
});

describe('MerchantResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, merchantService } = surfaces();

		const connection = await resolver.merchants(undefined, undefined, undefined, 20);

		expect(merchantService.findAll).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('orders by the resource’s own default when the caller states none', async () => {
		const { resolver } = surfaces();

		expect((await resolver.merchants()).nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		expect((await resolver.merchants({ code: { eq: 'AC' } })).nodes.map((node) => node.id)).toEqual([SECOND]);
		expect((await resolver.merchants({ active: { eq: false } })).nodes.map((node) => node.id)).toEqual([SECOND]);
		expect((await resolver.merchants({ contactId: { isNull: true } })).nodes.map((node) => node.id)).toEqual([
			SECOND
		]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		expect((await resolver.merchants(undefined, [{ field: 'name', direction: 'ASC' }])).nodes.map((n) => n.id)).toEqual(
			[SECOND, FIRST]
		);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.merchants(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.merchants(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.merchants(undefined, [{ field: 'logoId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.merchants({ tags: { eq: TAG } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.merchants(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('MerchantResolver — one concept, two protocols, the same operations', () => {
	it('reads one store through the same service method the REST route calls', async () => {
		const { resolver, merchantService } = surfaces();

		expect(await resolver.merchant(FIRST)).toBe(ROWS[0]);
		expect(merchantService.findById).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a store that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, merchantService } = surfaces();
		merchantService.findById.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.merchant(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, merchantService } = surfaces();

		expect(await resolver.merchantCount()).toBe(2);
		expect(merchantService.countBy).toHaveBeenCalledWith();
	});

	it('files a store, with its pivots, through the same service method the REST route calls', async () => {
		const { resolver, merchantService } = surfaces();

		await resolver.createMerchant({
			organizationId: ORGANIZATION,
			name: 'Northwind',
			code: 'NW',
			email: 'hello@northwind.test',
			contactId: CONTACT,
			tagIds: [TAG],
			warehouseIds: [WAREHOUSE]
		});

		expect(merchantService.create).toHaveBeenCalledWith(
			expect.objectContaining({
				organizationId: ORGANIZATION,
				code: 'NW',
				contactId: CONTACT,
				tagIds: [TAG],
				warehouseIds: [WAREHOUSE]
			})
		);
	});

	it('changes a store through the same service method the REST route calls, and answers the row it saved', async () => {
		const { resolver, merchantService } = surfaces();

		const updated = await resolver.updateMerchant({
			id: FIRST,
			organizationId: ORGANIZATION,
			name: 'Northwind',
			code: 'NW',
			email: 'hello@northwind.test',
			active: false
		});

		expect(merchantService.update).toHaveBeenCalledWith(FIRST, {
			organizationId: ORGANIZATION,
			name: 'Northwind',
			code: 'NW',
			email: 'hello@northwind.test',
			active: false
		});
		expect(updated).toBe(ROWS[0]);
	});

	it('removes a store through the same service method the REST route calls', async () => {
		const { resolver, merchantService } = surfaces();

		expect(await resolver.deleteMerchant(FIRST)).toBe(true);
		expect(merchantService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws and restores a store through the same service methods the REST routes call', async () => {
		const { resolver, merchantService } = surfaces();

		expect((await resolver.softDeleteMerchant(FIRST)).deletedAt).toBeInstanceOf(Date);
		expect(merchantService.softRemove).toHaveBeenCalledWith(FIRST);

		expect(await resolver.recoverMerchant(FIRST)).toBe(ROWS[0]);
		expect(merchantService.softRecover).toHaveBeenCalledWith(FIRST);
	});

	it('lets a refusal through rather than turning it into an answer', async () => {
		const { resolver, merchantService } = surfaces();
		const refusal = new Error('A store whose code is already taken cannot be filed.');

		merchantService.create.mockRejectedValueOnce(refusal);

		await expect(
			resolver.createMerchant({ organizationId: ORGANIZATION, name: 'x', code: 'NW', email: 'x@y.test' })
		).rejects.toBe(refusal);
	});
});

describe('MerchantResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', MerchantResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', MerchantController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', MerchantResolver) ?? [];

		for (const [, handler] of ROUTES) {
			expect([...guardsOfRoute(MerchantController, handler), FeatureFlagGuard].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, MerchantResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, MerchantController)
		);
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(MerchantController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the view permission on the four reads and the class’s edit one on every write', () => {
		for (const field of ['merchants', 'merchant', 'merchantCount']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_INVENTORY_VIEW]);
		}

		for (const field of [
			'createMerchant',
			'updateMerchant',
			'deleteMerchant',
			'softDeleteMerchant',
			'recoverMerchant'
		]) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT]);
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
		getHandler: () => (MerchantResolver.prototype as never)[field],
		getClass: () => MerchantResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('MerchantResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, MerchantResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', MerchantResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('merchants')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('merchants');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('merchants'))).resolves.toBe(true);
	});
});
